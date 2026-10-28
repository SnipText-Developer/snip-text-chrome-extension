import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { StartPopupOptions } from "./types";
import { MiniPopup } from "./components/MiniPopup";
import { createPopupHost } from "./dom/index";

export { getTemplateVariables } from "./utils/text";

// One React root per content-script document; effects manage editor events.
export function startPopup({ selector, getTemplates, insertText, correctTone, getEditorText }: StartPopupOptions): () => void {
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

export type { Template, StartPopupOptions } from "./types";

export { useTemplateContent } from "./hooks/useTemplateContent";
