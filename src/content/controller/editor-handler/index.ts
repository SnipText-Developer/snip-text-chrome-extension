import { startPopup } from "@snip-text/mini-popup";
import { EditorMutationObserver } from "./observer/editor-mutation-observer";
import { EditorPollingObserver } from "./observer/editor-polling-observer";
import { EditorCombinedObserver } from "./observer/editor-combined-observer";
import type {
  EditorObserver,
  EditorObserverFactory,
} from "./observer/editor-observer";
import { sendMessage } from "../../../common/message-bus";
import type { EditorVendorName } from "../../../core/data-types";

export type EditorObserverType = "MUTATION" | "POLLING" | "COMBINED";

export interface StartEditorObserverOptions {
  vendorName: EditorVendorName;
  selector: string;
  observerType?: EditorObserverType;
  shouldInitialize?: () => boolean;
}

function createEditorObserver(
  selector: string,
  observerType: EditorObserverType,
  changedCallback: () => Promise<void>,
): EditorObserver {
  if (observerType === "POLLING") {
    return new EditorPollingObserver(selector, changedCallback);
  }

  if (observerType === "MUTATION") {
    return new EditorMutationObserver(selector, changedCallback);
  }

  return new EditorCombinedObserver(selector, changedCallback);
}

function startEditorObserver({
  vendorName,
  selector,
  observerType = "COMBINED",
  shouldInitialize = () => true,
}: StartEditorObserverOptions): EditorObserver | null {
  if (!shouldInitialize()) {
    return null;
  }

  const observer = createEditorObserver(selector, observerType, async () => {
    const status = observer.getEditorStatus();
    const isEditable = status?.isEditable ?? false;
    const text = status?.text ?? "";

    await sendMessage({
      src: "CONTENT",
      dst: "BACKGROUND",
      path: "/editor/update-status",
      method: "PUT",
      data: {
        vendorName: vendorName,
        status: { isEditable, text },
      },
    });
  });

  observer.start();
  startPopup({
    selector,
    vendorName,
    getEditorStatus: () => observer.getEditorStatus(),
  });

  return observer;
}

export { startEditorObserver };
export type { EditorObserverFactory, EditorObserver };
