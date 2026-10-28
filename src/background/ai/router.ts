import {
  getContentVendor,
  isContentSender,
  isPageSender,
} from "../common/message-sender";
import type { MessageRequest, MessageResponse } from "../../core/message-types";
import { service, AiValidationError } from "./service";

export async function router(
  req: MessageRequest,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse | void> {
  if (
    req.dst !== "BACKGROUND" ||
    req.method !== "POST" ||
    req.path !== "/ai/tone-correction"
  )
    return;
  if (!isContentSender(req, sender) && !isPageSender(req, sender)) return;

  try {
    const data = Array.isArray(req.data) ? undefined : req.data;
    const result = await service.correctTone({
      vendorName: req.src === "CONTENT" ? getContentVendor(sender) : data?.vendorName,
      tone: data?.tone,
      removeCommand: req.src === "CONTENT",
    });
    return result
      ? { statusCode: 200, data: result }
      : { statusCode: 404, data: { msg: "에디터 상태를 찾을 수 없습니다." } };
  } catch (error) {
    return error instanceof AiValidationError
      ? { statusCode: 400, data: { msg: error.message } }
      : {
          statusCode: 500,
          data: { msg: "톤 교정 요청을 처리하지 못했습니다." },
        };
  }
}
