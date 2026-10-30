import { useEffect, useState } from "react";
import "./NotificationToast.css";

interface Props {
  notification: { message: string; id: number } | null;
}

export default function NotificationToast({ notification }: Props) {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!notification) {
      setVisible(false);
      return;
    }

    setMessage(notification.message);
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  return (
    <div
      className={`notification-region${visible ? " is-visible" : ""}`}
      aria-hidden={!visible}
      inert={!visible}>
      <div className="notification-clip">
        <div className="notification-toast">
          <span role="status" aria-live="polite" aria-atomic="true">
            {message}
          </span>
          <button type="button" aria-label="알림 닫기" onClick={() => setVisible(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
