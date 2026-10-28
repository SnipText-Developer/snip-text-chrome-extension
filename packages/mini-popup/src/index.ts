import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { createMiniPopupActions } from "./actions";
import type { ConnectedPopupOptions, StartPopupOptions } from "./types";
import { MiniPopup } from "./components/MiniPopup";
import { createPopupHost } from "./dom/index";

export { getTemplateVariables } from "./utils/text";

// One React root per content-script document; effects manage editor events.
export function startPopup(options: StartPopupOptions | ConnectedPopupOptions): () => void {
  const { selector } = options;
  const { getTemplates, insertText, correctTone, getEditorText } =
    "vendorName" in options ? createMiniPopupActions(options) : options;
  const { element: host, remove } = createPopupHost();
  const root = createRoot(host);
  root.render(createElement(MiniPopup, { selector, getTemplates, insertText, correctTone, getEditorText, host }));
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    root.unmount();
    remove();
  };
}

export type { Template, StartPopupOptions, ConnectedPopupOptions, PopupConnection } from "./types";

export { useTemplateContent } from "./hooks/useTemplateContent";
