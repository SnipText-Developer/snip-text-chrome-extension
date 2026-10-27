import { isPageSender, isContentSender } from "../common/message-sender";
import type { MessageRequest, MessageResponse } from "../../core/message-types";
import { service, TemplateValidationError } from "./service";

export const router = async (
  req: MessageRequest,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse | void> => {
  try {
    if (req.method === "GET" && req.path === "/template/list") {
      if (!isPageSender(req, sender) && !isContentSender(req, sender)) {
        return;
      }

      return {
        statusCode: 200,
        data: { templates: await service.listTemplates() },
      };
    }

    if (req.method === "PUT" && req.path === "/template/replace") {
      if (!isPageSender(req, sender)) {
        return;
      }

      const template = await service.replaceTemplate(req.data);
      return template
        ? { statusCode: 200, data: { template } }
        : { statusCode: 404, data: { msg: "템플릿을 찾을 수 없습니다." } };
    }
  } catch (error) {
    return error instanceof TemplateValidationError
      ? { statusCode: 400, data: { msg: error.message } }
      : {
          statusCode: 500,
          data: { msg: "템플릿 요청을 처리하지 못했습니다." },
        };
  }
};
