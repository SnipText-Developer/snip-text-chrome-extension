import { isContentSender, isDashboardSender, isPageSender } from "../common/message-sender";
import type { MessageRequest, MessageResponse } from "../../core/message-types";
import { service, TemplateValidationError } from "./service";
import { ApiError } from "../common/api-client";
import { service as authService } from "../auth/service";

type TemplateRequest = Pick<MessageRequest, "method" | "path"> &
  Partial<Pick<MessageRequest, "src" | "data">>;

export async function router(
  req: TemplateRequest,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse | void> {
  const pageSender = isPageSender(req, sender);
  const dashboardSender = isDashboardSender(sender);
  const contentSender = isContentSender(req, sender);

  try {
    if (req.path === "/template/refresh" && req.method === "POST") {
      if (!pageSender && !dashboardSender) return;
      if (!(await service.syncTemplates())) {
        return { statusCode: 400, data: { msg: "템플릿 API URL이 설정되지 않았습니다." } };
      }
      return { statusCode: 200, data: { refreshed: true } };
    }

    if (req.path === "/template/list" && req.method === "GET") {
      if (!pageSender && !contentSender) return;
      if (contentSender && !(await authService.readLatest())) {
        return { statusCode: 401, data: { msg: "로그인 후 다시 시도해주세요." } };
      }

      return {
        statusCode: 200,
        data: { templates: await service.listTemplates() },
      };
    }

    if (req.path === "/template/replace" && req.method === "PUT") {
      if (!pageSender) return;
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
          data: { msg: "템플릿 요청을 처리하지 못했습니다." },
        };
  }
}
