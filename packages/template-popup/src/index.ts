import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { StartPopupOptions } from "./types";
import { TemplatePopup } from "./components/TemplatePopup";

export { getTemplateVariables, preserveEditorSpaces } from "./utils/text";

// One React root per content-script document; effects manage editor events.
export function startPopup({ selector, getTemplates }: StartPopupOptions): () => void {
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "closed" });
  document.documentElement.append(host);
  const root = createRoot(shadow);
  root.render(createElement(TemplatePopup, { selector, getTemplates, host, shadow }));
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
