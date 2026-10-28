import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { StartPopupOptions } from "./types";
import { MiniPopup } from "./components/MiniPopup";

export { getTemplateVariables } from "./utils/text";

// One React root per content-script document; effects manage editor events.
export function startPopup({ selector, getTemplates, insertText }: StartPopupOptions): () => void {
  const host = document.createElement("div");
  host.id = "snip-text-mini-popup";
  document.documentElement.append(host);
  const root = createRoot(host);
  root.render(createElement(MiniPopup, { selector, getTemplates, insertText, host }));
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    root.unmount();
    host.remove();
  };
}

export type { Template, StartPopupOptions } from "./types";

export { useTemplateContent } from "./hooks/useTemplateContent";
