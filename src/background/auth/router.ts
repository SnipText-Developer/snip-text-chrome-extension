import { isPageSender } from "../common/message-sender";
import type { MessageRequest, MessageResponse } from "../../core/message-types";
import { service, AuthError } from "./service";

export const router = async (
  req: MessageRequest,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse | void> => {
  if (!isPageSender(req, sender)) return;

  try {
    if (req.path !== "/auth/token") return;
    if (req.method === "POST") {
      return { statusCode: 200, data: service.create(req.data) };
    }
    if (req.method === "GET" || req.method === "PUT") {
      const token =
        req.method === "GET"
          ? service.read(req.data?.vendor)
          : service.update(req.data);
      return token
        ? { statusCode: 200, data: token }
        : { statusCode: 404, data: { msg: "인증 토큰이 없습니다." } };
    }
    if (req.method === "DELETE") {
      return {
        statusCode: 200,
        data: { deleted: service.deleteOne(req.data?.vendor) },
      };
    }
  } catch (error) {
    return error instanceof AuthError
      ? { statusCode: 400, data: { msg: error.message } }
      : {
          statusCode: 500,
          data: { msg: "인증 토큰 요청을 처리하지 못했습니다." },
        };
  }
};
