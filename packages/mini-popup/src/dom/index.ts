import { createEditorDom } from "./editor";
import { createPopupDom } from "./popup";
import { createEventDom } from "./events";
import { positionPopup, observeViewport } from "./position";

export { createPopupHost } from "./host";
export { preserveEditorSelection, preventDefault } from "./events";

/** Single entry point for imperative browser operations in the mini popup. */
export function createMiniPopupDom(selector: string, host: HTMLElement) {
  const editor = createEditorDom(selector, host.ownerDocument);
  const popup = createPopupDom(host);
  const events = createEventDom(host);
  return {
    editor, popup, events,
    isEditorEvent(event: Event): boolean {
      return !popup.contains(event.target) && editor.matches(event.target);
    },
    position(element: HTMLElement) {
      const bounds = editor.getBounds();
      if (bounds) positionPopup(host, element, bounds);
    },
    observeViewport(callback: () => void) { return observeViewport(host, callback); },
  };
}

export type MiniPopupDom = ReturnType<typeof createMiniPopupDom>;
