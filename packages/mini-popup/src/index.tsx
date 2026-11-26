import { createRoot } from "react-dom/client";
import { createMiniPopupActions } from "./actions";
import type { ConnectedPopupOptions, StartPopupOptions } from "./types";
import { MiniPopup } from "./components/MiniPopup";

export { getTemplateVariables } from "./utils/text";

const pretendardStylesheet =
  "https://cdnjs.cloudflare.com/ajax/libs/pretendard/1.3.9/static/pretendard.min.css";

function ensurePretendardFont(document: Document): void {
  let hasPretendard = false;
  document.fonts?.forEach((font) => {
    if (font.family.replace(/["']/g, "").trim().toLowerCase() === "pretendard") {
      hasPretendard = true;
    }
  });
  if (hasPretendard) return;

  const existingLink = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .some((link) => link.getAttribute("href") === pretendardStylesheet);
  if (existingLink) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = pretendardStylesheet;
  link.type = "text/css";
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}

// One React root per content-script document; effects manage editor events.
export function startPopup(options: StartPopupOptions | ConnectedPopupOptions): () => void {
  const { selector } = options;
  const { getTemplates, insertText, correctTone, getEditorText } =
    "vendorName" in options ? createMiniPopupActions(options) : options;
  const host = document.createElement("div");
  host.id = "snip-text-mini-popup";
  document.documentElement.append(host);
  ensurePretendardFont(host.ownerDocument);
  const root = createRoot(host);
  root.render(
    <MiniPopup
      selector={selector}
      googleLogoUrl={options.googleLogoUrl}
      logoUrl={options.logoUrl}
      loginUrl={options.loginUrl}
      newTemplateUrl={options.newTemplateUrl}
      getTemplates={getTemplates}
      insertText={insertText}
      correctTone={correctTone}
      getEditorText={getEditorText}
      host={host}
    />,
  );
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    root.unmount();
    host.remove();
  };
}

export type { Template, StartPopupOptions, ConnectedPopupOptions, PopupConnection } from "./types";

export { useTemplateContent } from "./hooks/template/useTemplateContent";
