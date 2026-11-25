import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { calculatePopupPosition } from "../../utils/popup-position";

export function usePopupPosition(
  popup: RefObject<HTMLDivElement | null>,
  view: { getEditorBounds: () => DOMRect | null; open: boolean },
): CSSProperties | undefined {
  const { getEditorBounds, open } = view;
  const [position, setPosition] = useState<ReturnType<typeof calculatePopupPosition>>();
  const measure = useCallback(() => {
    const element = popup.current;
    const viewport = element?.ownerDocument.defaultView;
    if (!element || !viewport) return;
    const bounds = getEditorBounds();
    if (!bounds) return;
    // Layout width stays stable while the CSS transition scales the popup.
    const next = calculatePopupPosition(bounds, element.offsetWidth, viewport.innerWidth, viewport.innerHeight);
    setPosition((previous) =>
      previous && Object.keys(next).every((key) => {
        const property = key as keyof typeof next;
        return previous[property] === next[property];
      }) ? previous : next,
    );
  }, [getEditorBounds, popup]);

  // A new view can change the popup's width even with a stationary caret.
  useLayoutEffect(() => {
    if (view.open) measure();
  }, [view, measure]);
  useEffect(() => {
    const doc = popup.current?.ownerDocument;
    if (!open || !doc) return;
    const viewport = doc.defaultView;
    viewport?.addEventListener("resize", measure);
    doc.addEventListener("scroll", measure, true);
    return () => {
      viewport?.removeEventListener("resize", measure);
      doc.removeEventListener("scroll", measure, true);
    };
  }, [open, popup, measure]);

  return position;
}
