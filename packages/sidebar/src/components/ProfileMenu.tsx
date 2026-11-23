import { useId, useRef, useState } from "react";
import { pageConfig } from "../config";

export default function ProfileMenu({ onLogout }: { onLogout?: () => Promise<void> }) {
  const menuId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  async function logout() {
    if (!onLogout || loggingOut) return;
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div
      className="profile-menu"
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}>
      <button
        ref={trigger}
        type="button"
        className="icon-button profile-menu-trigger"
        aria-label="프로필 메뉴"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        onClick={() => setOpen(!open)}>
        <img className="template-brand" src="./favicon.svg" alt="" />
      </button>
      {open && (
        <>
          <div className="profile-menu-backdrop" aria-hidden="true" onClick={close} />
          <div className="profile-menu-panel" id={menuId}>
            <a href={pageConfig.dashboardUrl} target="_blank" rel="noopener noreferrer" onClick={close}>
              대시보드 열기
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4v16h16v-7M14 4h6v6m0-6-9 9" />
              </svg>
            </a>
            {onLogout && (
              <button type="button" disabled={loggingOut} onClick={() => void logout()}>
                {loggingOut ? "로그아웃 중…" : "로그아웃"}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 4H4v16h6M10 12h11m-5-5 5 5-5 5" />
                </svg>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
