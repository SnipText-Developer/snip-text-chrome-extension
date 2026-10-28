import { isPageSender, isContentSender } from "../../common/message-sender";
import type {
  MessageRequest,
  MessageResponse,
} from "../../../core/message-types";
import { EditorValidationError } from "../service";
import { contentRouter } from "./content-router";
import { pageRouter } from "./page-router";

export const router = async (
  req: MessageRequest,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse | void> => {
  try {
    if (isContentSender(req, sender)) return await contentRouter(req, sender);
    if (isPageSender(req, sender)) return await pageRouter(req);
  } catch (error) {
    return error instanceof EditorValidationError
      ? { statusCode: 400, data: { msg: error.message } }
      : {
          statusCode: 500,
          data: { msg: "에디터 요청을 처리하지 못했습니다." },
        };
  }
};
