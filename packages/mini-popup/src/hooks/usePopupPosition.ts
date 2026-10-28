import { useCallback, useEffect, useLayoutEffect } from "react";
import type { RefObject } from "react";
import type { MiniPopupDom } from "../dom/index";

export function usePopupPosition(
  dom: MiniPopupDom,
  popup: RefObject<HTMLDivElement | null>,
  open: boolean,
) {
  const position = useCallback(() => {
    if (open && popup.current) dom.position(popup.current);
  }, [dom, popup, open]);

  useLayoutEffect(() => {
    if (open) position();
    else dom.popup.hide();
  });
  useEffect(() => dom.observeViewport(position), [dom, position]);
}
