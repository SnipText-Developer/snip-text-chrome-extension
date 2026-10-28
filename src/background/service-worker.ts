import { listenMessage } from "../common/message-bus";
import type { MessageRequest, MessageResponse } from "../core/message-types";
import { router as authRouter } from "./auth/router";
import { router as editorRouter } from "./editor/router/router";
import { router as templateRouter } from "./template/router";

listenMessage(
  async (
    req: MessageRequest,
    sender: chrome.runtime.MessageSender,
  ): Promise<MessageResponse | void> => {
    if (req.dst !== "BACKGROUND") return;

    if (req.path.startsWith("/auth/")) {
      return await authRouter(req, sender);
    }

    if (req.path.startsWith("/template/")) {
      return await templateRouter(req, sender);
    }

    if (req.path.startsWith("/editor/")) {
      return await editorRouter(req, sender);
    }

    return {
      statusCode: 404,
      data: { msg: "router not founded" },
    };
  },
);

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});
