import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import "../components/NotificationToast.css";

const NotificationContext = createContext<(message: string) => void>(() => {});

export function useNotification() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<{ message: string; id: number } | null>(null);
  const notify = useCallback((message: string) => {
    setNotification((previous) => message ? { message, id: (previous?.id ?? 0) + 1 } : null);
  }, []);

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <div className="notification-region" role="status" aria-live="polite" aria-atomic="true">
        {notification && (
          <div className="notification-toast" key={notification.id}>
            <span>{notification.message}</span>
            <button type="button" aria-label="알림 닫기" onClick={() => setNotification(null)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </NotificationContext.Provider>
  );
}
