import type { MessageResponse } from "../../core/message-types";
import { router as authRouter } from "../auth/router";
import { isDashboardSender } from "../common/message-sender";
import { router as templateRouter } from "../template/router";

export async function routeDashboardMessage(
  request: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse> {
  if (!isDashboardSender(sender)) {
    return { statusCode: 403, data: { msg: "허용되지 않은 발신자입니다." } };
  }

  if (!request || typeof request !== "object") {
    return { statusCode: 400, data: { msg: "잘못된 요청입니다." } };
  }

  if ("dst" in request && request.dst === "BACKGROUND" && "path" in request && "method" in request) {
    const { path, method } = request;
    if (path === "/template/refresh" && method === "POST") {
      const response = await templateRouter({ path, method }, sender);
      if (response) return response;
    }

    if ((path === "/auth/status" || path === "/auth/token") && typeof method === "string") {
      const response = await authRouter({
        path, method, data: "data" in request ? request.data : undefined,
      }, sender);
      if (response) return response;
    }
  }

  return { statusCode: 404, data: { msg: "지원하지 않는 요청입니다." } };
}
