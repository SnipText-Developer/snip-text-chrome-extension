import { createRoot } from "react-dom/client";
import { createMiniPopupActions } from "./actions";
import type { ConnectedPopupOptions, StartPopupOptions } from "./types";
import { MiniPopup } from "./components/MiniPopup";
import { createPopupHost } from "./dom/index";
import { ensurePretendardFont } from "./dom/font";

export { getTemplateVariables } from "./utils/text";

// One React root per content-script document; effects manage editor events.
export function startPopup(options: StartPopupOptions | ConnectedPopupOptions): () => void {
  const { selector } = options;
  const { getTemplates, insertText, correctTone, getEditorText } =
    "vendorName" in options ? createMiniPopupActions(options) : options;
  const { element: host, remove } = createPopupHost();
  ensurePretendardFont(host.ownerDocument);
  const root = createRoot(host);
  root.render(
    <MiniPopup
      selector={selector}
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
    remove();
  };
}

export type { Template, StartPopupOptions, ConnectedPopupOptions, PopupConnection } from "./types";

export { useTemplateContent } from "./hooks/useTemplateContent";
