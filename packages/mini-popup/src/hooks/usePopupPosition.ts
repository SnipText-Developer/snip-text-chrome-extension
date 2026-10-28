import { useCallback, useEffect, useLayoutEffect } from "react";
import type { RefObject } from "react";
import type { EditorAnchor } from "../dom/editor";
import { positionPopup, hidePopup } from "../dom/popup";

export function usePopupPosition(
  host: HTMLElement,
  popup: RefObject<HTMLDivElement | null>,
  anchor: RefObject<EditorAnchor | null>,
  open: boolean,
) {
  const position = useCallback(() => {
    if (open && anchor.current && popup.current) {
      positionPopup(host, popup.current, anchor.current);
    }
  }, [host, popup, anchor, open]);

  useLayoutEffect(() => {
    if (open) position();
    else hidePopup(host);
  });
  useEffect(() => {
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
    };
  }, [position]);
}
