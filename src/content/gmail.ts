import { vendors } from "../config/vendors";
import { runAfterRender } from "./common/wrap-run-after-render";
import {
  startEditorObserver,
  type EditorObserver,
} from "./controller/editor-handler";
import { createEditorRouter, listenEditorRouter } from "./editor-router";

const vendor = vendors.find((item) => item.script === "gmail")!;

function startGmailEditorObserver(): EditorObserver | null {
  return startEditorObserver({
    vendorName: vendor.id,
    selector: vendor.editorSelector,
    observerType: "COMBINED",
    shouldInitialize: () => true,
  });
}

runAfterRender(() => {
  const observer = startGmailEditorObserver();

  if (observer) {
    listenEditorRouter(
      createEditorRouter({
        vendorName: vendor.id,
        getEditor: () => observer.getEditor(),
        getEditorStatus: () => observer.getEditorStatus(),
      }),
    );
  }
});
