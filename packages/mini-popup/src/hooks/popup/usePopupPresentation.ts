import { useLayoutEffect, useRef, useState } from "react";
import { usePopupPosition } from "./usePopupPosition";

export function usePopupPresentation<T extends { getEditorBounds: () => DOMRect | null; open: boolean }>(state: T) {
  const ref = useRef<HTMLDivElement>(null);
  const [lastOpenState, setLastOpenState] = useState<T | null>(null);
  // Keep the last screen mounted for the CSS exit transition.
  useLayoutEffect(() => {
    if (state.open) setLastOpenState(state);
  }, [state]);

  const style = usePopupPosition(ref, state);
  return {
    view: state.open ? state : lastOpenState,
    panelProps: { ref, style, inert: !state.open, "data-open": state.open },
  };
}
