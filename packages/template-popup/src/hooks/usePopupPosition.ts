import { useCallback, useEffect, useLayoutEffect } from "react";
import type { RefObject } from "react";
import type { EditorAnchor } from "./useEditor";

export function usePopupPosition(
  host: HTMLElement,
  popup: RefObject<HTMLDivElement | null>,
  anchor: RefObject<EditorAnchor | null>,
  open: boolean,
) {
  const position = useCallback(() => {
    const match = anchor.current;
    if (!open || !match || !popup.current) return;
    const rect = match.trigger.getBoundingClientRect();
    const bounds = rect.height ? rect : match.editor.getBoundingClientRect();
    host.style.display = "block";
    const { width, height } = popup.current.getBoundingClientRect();
    host.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8))}px`;
    host.style.top = `${Math.max(8, bounds.bottom + height + 6 <= window.innerHeight ? bounds.bottom + 6 : bounds.top - height - 6)}px`;
  }, [host, popup, anchor, open]);

  useLayoutEffect(() => {
    if (open) position();
    else host.style.display = "none";
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
