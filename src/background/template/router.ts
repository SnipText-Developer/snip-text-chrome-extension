import { isPageSender, isContentSender, isDashboardSender } from "../common/message-sender";
import type { MessageRequest, MessageResponse } from "../../core/message-types";
import { service, TemplateValidationError } from "./service";
import { ApiError } from "../common/api-client";

type TemplateRequest = Pick<MessageRequest, "method" | "path"> &
  Partial<Pick<MessageRequest, "src" | "data">>;

export const router = async (
  req: TemplateRequest,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse | void> => {
  try {
    if (req.method === "POST" && req.path === "/template/refresh") {
      if (!isPageSender(req, sender) && !isDashboardSender(sender)) {
        return;
      }
      if (!(await service.syncTemplates())) {
        return { statusCode: 400, data: { msg: "템플릿 API URL이 설정되지 않았습니다." } };
      }
      return { statusCode: 200, data: { refreshed: true } };
    }

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
    if (error instanceof ApiError) {
      const statusCode = error.status === 401 || error.status === 403 || error.status === 404 || error.status === 400
        ? error.status : 500;
      return { statusCode, data: { msg: error.message } };
    }
    return error instanceof TemplateValidationError
      ? { statusCode: 400, data: { msg: error.message } }
      : {
          statusCode: 500,
          data: {
            msg: "템플릿 요청을 처리하지 못했습니다.",
          },
        };
  }
};
