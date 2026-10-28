import { vendors, isComposeUrl } from "../config/vendors";
import { UrlObserver } from "./controller/editor-handler/observer/url-observer";
import { runAfterRender } from "./common/wrap-run-after-render";
import { sendMessage } from "../common/message-bus";
import {
  startEditorObserver,
  type EditorObserver,
} from "./controller/editor-handler";
import { createEditorRouter, listenEditorRouter } from "./editor-router";

const vendor = vendors.find((item) => item.script === "naver")!;

function startNaverObserver(): void {
  if (window.self !== window.top) {
    return;
  }

  if (!isComposeUrl(vendor.id, window.location.href)) {
    return;
  }

  const naverObserver = new UrlObserver(async () => {
    const isEditable = isComposeUrl(vendor.id, naverObserver.getUrl());
    await sendMessage({
      src: "CONTENT",
      dst: "BACKGROUND",
      path: "/editor/update-status",
      method: "PUT",
      data: {
        vendorName: vendor.id,
        status: { isEditable },
      },
    });
  }, 100);

  naverObserver.start();
}

function startNaverEditorObserver(): EditorObserver | null {
  return startEditorObserver({
    vendorName: vendor.id,
    selector: vendor.editorSelector,
    observerType: "COMBINED",
    shouldInitialize: () => {
      if (window.self === window.top) {
        return false;
      }

      if (!document.querySelector(vendor.editorSelector)) {
        return false;
      }

      return true;
    },
  });
}

startNaverObserver();

runAfterRender(() => {
  const observer = startNaverEditorObserver();

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
