import { useEffect } from "react";
import { tryCatch } from "../common/wrapper";
import type { MessageRequest, MessageResponse } from "../core/message-types";

const EDITOR_NOTIFY_STATUS_PATH = "/editor/notify-status";

function useMessageListener(
  callback: (
    req: MessageRequest,
  ) => Promise<MessageResponse | void> | MessageResponse | void,
): void {
  useEffect(() => {
    const _callback = (
      req: MessageRequest,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: MessageResponse) => void,
    ) => {
      // Other extension contexts own these requests and their responses.
      if (req.dst !== "PAGE") {
        return false;
      }

      Promise.resolve().then(() => callback(req)).then((res) => {
        if (res) {
          sendResponse(res);
          return;
        }

      }).catch(() => {
        sendResponse({
          statusCode: 500,
          data: { msg: "메시지 처리에 실패했습니다." },
        });
      });

      return true;
    };

    tryCatch(() => {
      chrome.runtime.onMessage.addListener(_callback);
    });

    return () => {
      tryCatch(() => {
        chrome.runtime.onMessage.removeListener(_callback);
      });
    };
  }, [callback]);
}

export { useMessageListener, EDITOR_NOTIFY_STATUS_PATH };
