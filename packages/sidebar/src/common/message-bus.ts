import { tryCatchAsync } from "../common/wrapper";
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

export { sendMessage, sendToActiveTab };
