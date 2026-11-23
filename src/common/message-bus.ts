import { tryCatch, tryCatchAsync } from "./wrapper";
import type { MessageRequest, MessageResponse } from "../core/message-types";

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

type MessageHandler<Request> = (
  req: Request,
  sender: chrome.runtime.MessageSender,
) => Promise<MessageResponse | void>;

function createMessageListener<Request>(handler: MessageHandler<Request>) {
  return (
    req: Request,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ): true => {
    void Promise.resolve().then(() => handler(req, sender)).then((response) => {
      if (response) sendResponse(response);
    }).catch(() => {
      sendResponse({ statusCode: 500, data: { msg: "메시지 처리에 실패했습니다." } });
    });

    return true;
  };
}

function listenMessage(handler: MessageHandler<MessageRequest>): void {
  tryCatch(() => chrome.runtime.onMessage.addListener(createMessageListener(handler)));
}

function listenExternalMessage(handler: MessageHandler<unknown>): void {
  chrome.runtime.onMessageExternal.addListener(createMessageListener(handler));
}

export { sendMessage, sendToActiveTab, listenMessage, listenExternalMessage };
