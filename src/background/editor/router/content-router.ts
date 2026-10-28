import type {
  MessageRequest,
  MessageResponse,
} from "../../../core/message-types";
import { getContentVendor } from "../../common/message-sender";
import { service } from "../service";
import { insertEditorText, notifyEditorStatus } from "./router-actions";

export async function contentRouter(
  req: MessageRequest,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse | void> {
  if (req.method === "GET" && req.path === "/editor/text") {
    const status = await service.getEditorStatus(getContentVendor(sender));
    return status
      ? { statusCode: 200, data: { text: status.text } }
      : { statusCode: 404, data: { msg: "에디터 상태를 찾을 수 없습니다." } };
  }

  if (req.method === "PUT" && req.path === "/editor/update-status") {
    if (getContentVendor(sender) !== req.data?.vendorName) return;
    if (!req.data?.vendorName || !req.data.status) {
      return { statusCode: 400, data: { msg: "Invalid data field" } };
    }
    const result = await service.updateEditorStatus(
      req.data.vendorName,
      req.data.status,
    );
    if (result) await notifyEditorStatus(result);
    return { statusCode: 200, data: result };
  }

  if (req.method === "PUT" && req.path === "/editor/insert-text") {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    return insertEditorText(req.data?.text, (message) =>
      chrome.tabs.sendMessage(tabId, message, { frameId: sender.frameId ?? 0 }),
    );
  }
}
