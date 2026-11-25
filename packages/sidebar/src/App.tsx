import { useCallback, useEffect, useRef, useState } from "react";
import LoginPage from "./components/LoginPage";
import NotificationToast from "./components/NotificationToast";
import SidebarContent from "./components/SidebarContent";
import { EditorStatusProvider } from "./context/EditorStatusProvider";
import { sendMessage } from "./common/message-bus";
import type { MessageRequest } from "./core/message-types";
import "./App.css";

type AuthStatus = "checking" | "authenticated" | "signedOut" | "error";

function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const authRequest = useRef(0);
  const [notification, setNotification] = useState<{ message: string; id: number } | null>(null);
  const [showToneCorrection, setShowToneCorrection] = useState(false);
  const notify = useCallback((message: string) => {
    setNotification((previous) => message ? { message, id: (previous?.id ?? 0) + 1 } : null);
  }, []);
  const showTemplates = () => setShowToneCorrection(false);
  const openToneCorrection = () => setShowToneCorrection(true);

  const logout = async () => {
    try {
      const response = await sendMessage({
        src: "PAGE", dst: "BACKGROUND", method: "POST", path: "/auth/logout", data: {},
      });
      if (response?.statusCode !== 200) throw new Error("Logout failed");

      authRequest.current++;
      setShowToneCorrection(false);
      setAuthStatus("signedOut");
      notify("");
    } catch {
      notify("로그아웃하지 못했습니다. 다시 시도해주세요.");
    }
  };

  const checkAuth = useCallback(async () => {
    const request = ++authRequest.current;
    let status: Exclude<AuthStatus, "checking"> = "error";
    try {
      const response = await sendMessage({
        src: "PAGE", dst: "BACKGROUND", method: "GET", path: "/auth/status", data: {},
      });
      if (response?.statusCode === 200 && typeof response.data?.authenticated === "boolean") {
        status = response.data.authenticated ? "authenticated" : "signedOut";
      }
    } catch {
      // Treat a failed message as an unavailable status check.
    }
    if (request === authRequest.current) setAuthStatus(status);
  }, []);

  useEffect(() => {
    const recheck = () => { void checkAuth(); };
    const onAuthChanged = (message: MessageRequest, sender: chrome.runtime.MessageSender) => {
      if (sender.id === chrome.runtime.id && message?.src === "BACKGROUND" &&
          message.dst === "PAGE" && message.method === "NOTIFY" && message.path === "/auth/status") {
        recheck();
      }
    };
    chrome.runtime.onMessage.addListener(onAuthChanged);
    recheck();
    window.addEventListener("focus", recheck);
    return () => {
      authRequest.current++;
      chrome.runtime.onMessage.removeListener(onAuthChanged);
      window.removeEventListener("focus", recheck);
    };
  }, [checkAuth]);

  useEffect(() => {
    if (authStatus === "signedOut") {
      void checkAuth();
    }
  }, [authStatus, checkAuth]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;

    let active = true;
    async function refreshTemplates() {
      try {
        const response = await sendMessage({
          src: "PAGE", dst: "BACKGROUND", method: "POST", path: "/template/refresh", data: {},
        });
        if (response?.statusCode === 200) return;
      } catch {
        // The template list can still use the local cache.
      }
      if (active) notify("템플릿을 새로고침하지 못했습니다.");
    }

    void refreshTemplates();
    return () => { active = false; };
  }, [authStatus, notify]);

  return (
    <EditorStatusProvider>
      <div className="sidebar-shell">
        <main className="sidebar">
          {authStatus === "checking" ? (
            <p role="status">로그인 상태를 확인하는 중…</p>
          ) : authStatus === "authenticated" ? (
            <SidebarContent
              showToneCorrection={showToneCorrection}
              onNotify={notify}
              onOpenToneCorrection={openToneCorrection}
              onShowTemplates={showTemplates}
              onLogout={logout}
            />
          ) : authStatus === "error" ? (
            <section>
              <p role="alert">로그인 상태를 확인하지 못했습니다.</p>
              <button type="button" onClick={() => {
                setAuthStatus("checking");
                void checkAuth();
              }}>다시 확인</button>
            </section>
          ) : (
            <LoginPage />
          )}
        </main>
        <NotificationToast notification={notification} />
      </div>
    </EditorStatusProvider>
  );
}

export default App;
