import { useCallback, useState } from "react";
import NotificationToast from "./components/NotificationToast";
import SidebarContent from "./components/SidebarContent";
import SidebarHeader from "./components/SidebarHeader";
import { EditorStatusProvider } from "./context/EditorStatusProvider";
import "./App.css";

function App() {
  const [notification, setNotification] = useState<{ message: string; id: number } | null>(null);
  const [showToneCorrection, setShowToneCorrection] = useState(false);
  const notify = useCallback((message: string) => {
    setNotification((previous) => message ? { message, id: (previous?.id ?? 0) + 1 } : null);
  }, []);
  const showTemplates = () => setShowToneCorrection(false);
  const openToneCorrection = () => setShowToneCorrection(true);

  return (
    <EditorStatusProvider>
      <div className="sidebar-shell">
        <main className="sidebar">
          <SidebarHeader onShowTemplates={showTemplates} />
          <SidebarContent
            showToneCorrection={showToneCorrection}
            onNotify={notify}
            onOpenToneCorrection={openToneCorrection}
            onShowTemplates={showTemplates}
          />
        </main>
        <NotificationToast notification={notification} />
      </div>
    </EditorStatusProvider>
  );
}

export default App;
