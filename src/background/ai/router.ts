import { getContentVendor, isContentSender, isPageSender } from "../common/message-sender";
import type { MessageRequest, MessageResponse } from "../../core/message-types";
import { service as editorService, EditorValidationError } from "../editor/service";

export async function router(
  req: MessageRequest,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse | void> {
  if (req.dst !== "BACKGROUND" || req.method !== "POST" || req.path !== "/ai/tone-correction") return;
  if (!isContentSender(req, sender) && !isPageSender(req, sender)) return;

  const data = req.data;
  if (
    !data || Array.isArray(data) ||
    typeof data.tone !== "string" || !data.tone.trim()
  ) {
    return { statusCode: 400, data: { msg: "교정할 문체를 입력해주세요." } };
  }

  try {
    const vendorName = req.src === "CONTENT" ? getContentVendor(sender) : data.vendorName;
    const status = await editorService.getEditorStatus(vendorName);
    if (!status) return { statusCode: 404, data: { msg: "에디터 상태를 찾을 수 없습니다." } };
    if (!status.text.trim()) {
      return { statusCode: 400, data: { msg: "교정할 본문을 작성해주세요." } };
    }

    // TODO: Replace the prefix with the actual tone-correction API result.
    return { statusCode: 200, data: { text: `(톤교정)${status.text}` } };
  } catch (error) {
    return error instanceof EditorValidationError
      ? { statusCode: 400, data: { msg: error.message } }
      : { statusCode: 500, data: { msg: "톤 교정 요청을 처리하지 못했습니다." } };
  }
}
