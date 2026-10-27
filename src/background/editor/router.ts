import {
  isPageSender,
  isContentSender,
  getContentVendor,
} from "../common/message-sender";
import type { MessageRequest, MessageResponse } from "../../core/message-types";
import { sendToActiveTab, sendMessage } from "../../common/message-bus";
import { service, EditorValidationError } from "./service";

export const router = async (
  req: MessageRequest,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse | void> => {
  try {
    if (req.method === "GET" && req.path === "/editor/status") {
      if (!isPageSender(req, sender)) {
        return;
      }

      if (!req.data || !req.data.vendorName) {
        return {
          statusCode: 400,
          data: { msg: "Invalid data field" },
        };
      }

      const result = await service.getEditorStatus(req.data.vendorName);
      return result ? { statusCode: 200, data: result } : undefined;
    }

    if (req.method === "PUT" && req.path === "/editor/update-status") {
      if (
        !isContentSender(req, sender) ||
        getContentVendor(sender) !== req.data?.vendorName
      ) {
        return;
      }

      if (!req.data || !req.data.vendorName || !req.data.status) {
        return {
          statusCode: 400,
          data: { msg: "Invalid data field" },
        };
      }

      const result = await service.updateEditorStatus(
        req.data.vendorName,
        req.data.status,
      );
      if (result) {
        await sendMessage({
          src: "BACKGROUND",
          dst: "PAGE",
          method: "PUT",
          path: "/editor/notify-status",
          data: result,
        });
      }

      return { statusCode: 200, data: result };
    }

    if (req.method === "PUT" && req.path === "/editor/insert-text") {
      if (!isPageSender(req, sender)) {
        return;
      }

      if (!req.data || !req.data.text) {
        return {
          statusCode: 400,
          data: { msg: "Invalid data field" },
        };
      }

      const res = await sendToActiveTab({
        src: "BACKGROUND",
        dst: "CONTENT",
        path: "/editor/insert-text",
        method: "PUT",
        data: { text: req.data.text },
      });
      if (!res || res.statusCode !== 200) {
        return res;
      }

      const result = await service.updateText(
        res.data.vendorName,
        res.data.text,
        res.data.prevText,
      );

      await sendMessage({
        src: "BACKGROUND",
        dst: "PAGE",
        method: "PUT",
        path: "/editor/notify-status",
        data: result,
      });

      return { statusCode: 200, data: result };
    }
  } catch (error) {
    return error instanceof EditorValidationError
      ? { statusCode: 400, data: { msg: error.message } }
      : {
          statusCode: 500,
          data: { msg: "에디터 요청을 처리하지 못했습니다." },
        };
  }
};
