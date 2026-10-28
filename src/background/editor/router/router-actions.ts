import type { EditorStatus } from "../../../core/data-types";
import type {
  MessageRequest,
  MessageResponse,
} from "../../../core/message-types";
import { sendMessage } from "../../../common/message-bus";
import { service } from "../service";

export async function notifyEditorStatus(
  status: EditorStatus | void,
): Promise<void> {
  await sendMessage({
    src: "BACKGROUND",
    dst: "PAGE",
    method: "PUT",
    path: "/editor/notify-status",
    data: status,
  });
}

export async function insertEditorText(
  text: unknown,
  send: (message: MessageRequest) => Promise<MessageResponse | void>,
): Promise<MessageResponse | void> {
  if (typeof text !== "string" || !text) {
    return { statusCode: 400, data: { msg: "Invalid data field" } };
  }
  const response = await send({
    src: "BACKGROUND",
    dst: "CONTENT",
    method: "PUT",
    path: "/editor/insert-text",
    data: { text },
  });
  if (!response || response.statusCode !== 200) return response;
  const result = await service.updateText(
    response.data.vendorName,
    response.data.text,
    response.data.prevText,
  );
  await notifyEditorStatus(result);
  return { statusCode: 200, data: result };
}
