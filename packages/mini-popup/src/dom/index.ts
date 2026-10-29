import { createEditorDom } from "./editor";
import { createPopupDom, positionPopup, observeViewport } from "./popup";
import { createEventDom } from "./events";
import {
  connectTemplateList, connectToneMenu, connectTemplateInput,
  type OptionListHandlers, type TemplateInputHandlers,
} from "./controls";

export { createPopupHost } from "./popup";
export { preserveEditorSelection, preventDefault } from "./events";

/** Single entry point for imperative browser operations in the mini popup. */
export function createMiniPopupDom(selector: string, host: HTMLElement) {
  const editor = createEditorDom(selector, host.ownerDocument);
  const popup = createPopupDom(host);
  const events = createEventDom(host);
  const isEditorEvent = (event: Event) => !popup.contains(event.target) && editor.matches(event.target);
  const keyboardContext = { events, isEditorEvent };
  return {
    editor, popup, events, isEditorEvent,
    connectTemplateList(root: HTMLElement, read: () => OptionListHandlers) {
      return connectTemplateList(root, keyboardContext, read);
    },
    connectToneMenu(root: HTMLElement, read: () => OptionListHandlers) {
      return connectToneMenu(root, keyboardContext, read);
    },
    connectTemplateInput(root: HTMLElement, read: () => TemplateInputHandlers) {
      return connectTemplateInput(root, keyboardContext, read);
    },
    position(element: HTMLElement) {
      const bounds = editor.getBounds();
      if (bounds) positionPopup(host, element, bounds);
    },
    observeViewport(callback: () => void) { return observeViewport(host, callback); },
  };
}

export type MiniPopupDom = ReturnType<typeof createMiniPopupDom>;
