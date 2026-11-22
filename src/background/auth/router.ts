import { isDashboardSender, isPageSender } from "../common/message-sender";
import type { MessageRequest, MessageResponse } from "../../core/message-types";
import { service, AuthError } from "./service";

type AuthRequest = Partial<Pick<MessageRequest, "src">> & {
  path: string;
  method: string;
  data?: unknown;
};

export async function router(
  req: AuthRequest,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse | void> {
  const pageSender = isPageSender(req, sender);
  if (!pageSender && !isDashboardSender(sender)) return;

  const vendor = req.data && typeof req.data === "object" && "vendor" in req.data ? req.data.vendor : undefined;
  try {
    if (req.path === "/auth/status" && req.method === "GET") {
      return {
        statusCode: 200,
        data: { authenticated: service.readLatest() !== null },
      };
    }

    if (req.path === "/auth/token") {
      if (req.method === "GET" && pageSender) {
        const token = service.read(vendor);
        return token
          ? { statusCode: 200, data: token }
          : { statusCode: 404, data: { msg: "인증 토큰이 없습니다." } };
      }
      if (req.method === "PUT") {
        const token = service.update(req.data);
        return { statusCode: 200, data: pageSender ? token : { vendor: token.vendor } };
      }
      if (req.method === "DELETE") {
        return {
          statusCode: 200,
          data: { deleted: service.deleteOne(vendor) },
        };
      }
    }
  } catch (error) {
    return error instanceof AuthError
      ? { statusCode: 400, data: { msg: error.message } }
      : {
          statusCode: 500,
          data: { msg: "인증 요청을 처리하지 못했습니다." },
        };
  }
}
