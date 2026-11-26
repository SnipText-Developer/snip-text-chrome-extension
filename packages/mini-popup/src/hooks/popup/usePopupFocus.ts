import { useMemo } from "react";

export function usePopupFocus(host: HTMLElement) {
  return useMemo(() => ({
    contains(target: EventTarget | null): boolean {
      return target instanceof Node && host.contains(target);
    },
    hasFocus(): boolean {
      return host.contains(host.ownerDocument.activeElement);
    },
  }), [host]);
}
