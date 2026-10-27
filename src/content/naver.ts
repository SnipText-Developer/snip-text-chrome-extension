import { UrlObserver } from "./controller/editor-handler/observer/url-observer";
import { runAfterRender } from "./common/wrap-run-after-render";
import { sendMessage } from "../common/message-bus";
import {
  startEditorObserver,
  type EditorObserver,
} from "./controller/editor-handler";
import { createEditorRouter, listenEditorRouter } from "./editor-router";

const NAVER_EDITOR_URL = "mail.naver.com/v2/new";
const NAVER_EDITOR_SELECTOR =
  'div.workseditor-content[class="workseditor-content"][contenteditable="true"]';

function startNaverObserver(): void {
  if (window.self !== window.top) {
    return;
  }

  if (!window.location.href.includes(NAVER_EDITOR_URL)) {
    return;
  }

  const naverObserver = new UrlObserver(async () => {
    const isEditable = naverObserver.getUrl()?.includes(NAVER_EDITOR_URL);
    await sendMessage({
      src: "CONTENT",
      dst: "BACKGROUND",
      path: "/editor/update-status",
      method: "PUT",
      data: {
        vendorName: "NAVER",
        status: { isEditable },
      },
    });
  }, 100);

  naverObserver.start();
}

function startNaverEditorObserver(): EditorObserver | null {
  return startEditorObserver({
    vendorName: "NAVER",
    selector: NAVER_EDITOR_SELECTOR,
    observerType: "COMBINED",
    shouldInitialize: () => {
      if (window.self === window.top) {
        return false;
      }

      if (!document.querySelector(NAVER_EDITOR_SELECTOR)) {
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
        vendorName: "NAVER",
        getEditor: () => observer.getEditor(),
        getEditorStatus: () => observer.getEditorStatus(),
      }),
    );
  }
});
