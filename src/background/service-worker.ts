import { listenMessage } from "../common/message-bus";
import type { MessageRequest, MessageResponse } from "../core/message-types";
import { router as authRouter } from "./auth/router";
import { router as editorRouter } from "./editor/router/router";
import { router as templateRouter } from "./template/router";
import { router as aiRouter } from "./ai/router";

import { apiConfig } from "../config/api";
import { service as templateService } from "./template/service";

const templatesReady = templateService.syncTemplates(apiConfig.templatesUrl).catch((error: unknown) => {
  console.warn("템플릿 초기 조회에 실패하여 로컬 템플릿을 사용합니다.", error);
});

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
      await templatesReady;
      return await templateRouter(req, sender);
    }

    if (req.path.startsWith("/editor/")) {
      return await editorRouter(req, sender);
    }

    if (req.path.startsWith("/ai/")) {
      return await aiRouter(req, sender);
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
