import { tryCatch, tryCatchAsync } from "./wrapper";
import type { MessageRequest, MessageResponse } from "./message-types";

async function sendMessage(
  req: MessageRequest,
): Promise<MessageResponse | void> {
  return await tryCatchAsync(async () => {
    const response = await chrome.runtime.sendMessage(req);

    return response;
  });
}

async function sendToActiveTab(
  req: MessageRequest,
): Promise<MessageResponse | void> {
  return await tryCatchAsync(async () => {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const tabId = tabs[0]?.id;

    if (tabId === undefined) {
      return;
    }

    const response = await chrome.tabs.sendMessage(tabId, req);

    return response;
  });
}

function listenMessage(
  callback: (
    req: MessageRequest,
    sender: chrome.runtime.MessageSender,
  ) => Promise<MessageResponse | void>,
): void {
  const _callback = (
    req: MessageRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ) => {
    Promise.resolve().then(() => callback(req, sender)).then((res) => {
      if (res) {
        sendResponse(res);
      }
    }).catch(() => {
      sendResponse({ statusCode: 500, data: { msg: "메시지 처리에 실패했습니다." } });
    });

    return true;
  };

  tryCatch(() => {
    chrome.runtime.onMessage.addListener(_callback);
  });
}

export { sendMessage, sendToActiveTab, listenMessage };
