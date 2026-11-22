import { snipTextApiOrigin } from "../../config/api";
import { requestApi } from "../common/api-client";
import { isVendorName } from "../../config/vendors";
import { service as editorService } from "../editor/service";

export class AiValidationError extends Error {}

const toneStyles = new Map([
  ["상사/외부용", "BOSS_EXTERNAL"],
  ["보고/공문용", "REPORT_OFFICIAL"],
  ["마케팅/설득", "MARKETING"],
  ["공지/안내", "NOTICE"],
  ["부드러운 존댓말", "SOFT_POLITE"],
  ["편한 반말", "CASUAL"],
]);

interface ToneCorrectionInput {
  vendorName: unknown;
  tone: unknown;
  text?: unknown;
  removeCommand?: boolean;
}

async function correctTone({ vendorName, tone, text: inputText, removeCommand = false }: ToneCorrectionInput): Promise<{ text: string } | null> {
  if (typeof tone !== "string" || !tone.trim()) {
    throw new AiValidationError("교정할 문체를 입력해주세요.");
  }
  const style = toneStyles.get(tone);
  if (!style) throw new AiValidationError("지원하지 않는 문체입니다.");
  if (!isVendorName(vendorName)) {
    throw new AiValidationError("지원하지 않는 메일 서비스입니다.");
  }

  if (inputText !== undefined && typeof inputText !== "string") {
    throw new AiValidationError("교정할 본문은 문자열이어야 합니다.");
  }

  const status = await editorService.getEditorStatus(vendorName);
  if (!status) return null;
  const text = removeCommand
    ? status.text.replace(/[\\₩]톤(?:교(?:정)?)?\s*$/, "")
    : typeof inputText === "string" ? inputText : status.text;
  if (!text.trim()) throw new AiValidationError("교정할 본문을 작성해주세요.");

  const result = await requestApi(`${snipTextApiOrigin}/api/v1/ai/tone-corrections`, "POST", { style, text });
  if (!result || typeof result !== "object" || !("correctedText" in result) ||
      typeof result.correctedText !== "string" || !result.correctedText.trim()) {
    throw new Error("AI 톤 교정 응답에 교정 본문이 없습니다.");
  }
  return { text: result.correctedText };
}

export const service = { correctTone };
