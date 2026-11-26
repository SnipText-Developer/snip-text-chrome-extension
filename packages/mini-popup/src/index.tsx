import { createRoot } from "react-dom/client";
import { createMiniPopupActions } from "./actions";
import type { ConnectedPopupOptions, StartPopupOptions } from "./types";
import { MiniPopup } from "./components/MiniPopup";

export { getTemplateVariables } from "./utils/text";

// One React root per content-script document; effects manage editor events.
export function startPopup(options: StartPopupOptions | ConnectedPopupOptions): () => void {
  const { selector } = options;
  const { getTemplates, insertText, correctTone, getEditorText } =
    "vendorName" in options ? createMiniPopupActions(options) : options;
  const host = document.createElement("div");
  host.id = "snip-text-mini-popup";
  document.documentElement.append(host);
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
