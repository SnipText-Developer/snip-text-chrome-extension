import { useEffect, useState } from "react";
import styles from "./LoadingIndicator.css?inline";

export function LoadingIndicator({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    if (!active) return;
    const timer = setTimeout(() => setVisible(true), 250);
    return () => clearTimeout(timer);
  }, [active]);

  if (!active || !visible) return null;
  return (
    <>
      <style>{styles}</style>
      <div className="popup-loading" role="status" aria-label="톤 교정 중">
        <span className="popup-spinner" aria-hidden="true" />
      </div>
    </>
  );
}
