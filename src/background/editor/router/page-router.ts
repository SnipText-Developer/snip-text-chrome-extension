import type {
  MessageRequest,
  MessageResponse,
} from "../../../core/message-types";
import { sendToActiveTab } from "../../../common/message-bus";
import { service } from "../service";
import { insertEditorText } from "./router-actions";

export async function pageRouter(
  req: MessageRequest,
): Promise<MessageResponse | void> {
  if (req.method === "GET" && req.path === "/editor/text") {
    const status = await service.getEditorStatus(req.data?.vendorName);
    return status
      ? { statusCode: 200, data: { text: status.text } }
      : { statusCode: 404, data: { msg: "에디터 상태를 찾을 수 없습니다." } };
  }

  if (req.method === "GET" && req.path === "/editor/status") {
    if (!req.data?.vendorName) {
      return { statusCode: 400, data: { msg: "Invalid data field" } };
    }
    const result = await service.getEditorStatus(req.data.vendorName);
    return result ? { statusCode: 200, data: result } : undefined;
  }

  if (req.method === "PUT" && req.path === "/editor/insert-text") {
    return insertEditorText(req.data?.text, sendToActiveTab);
  }
}
