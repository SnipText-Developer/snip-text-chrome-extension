import { isVendorName } from "../../config/vendors";
import { service as editorService } from "../editor/service";

export class AiValidationError extends Error {}

interface ToneCorrectionInput {
  vendorName: unknown;
  tone: unknown;
  removeCommand?: boolean;
}

async function correctTone({ vendorName, tone, removeCommand = false }: ToneCorrectionInput): Promise<{ text: string } | null> {
  if (typeof tone !== "string" || !tone.trim()) {
    throw new AiValidationError("교정할 문체를 입력해주세요.");
  }
  if (!isVendorName(vendorName)) {
    throw new AiValidationError("지원하지 않는 메일 서비스입니다.");
  }

  const status = await editorService.getEditorStatus(vendorName);
  if (!status) return null;
  const text = removeCommand
    ? status.text.replace(/\/톤(?:교(?:정)?)?\s*$/, "")
    : status.text;
  if (!text.trim()) throw new AiValidationError("교정할 본문을 작성해주세요.");

  // TODO: Replace the prefix with the actual tone-correction API result.
  return { text: `(톤교정)${text}` };
}

export const service = { correctTone };
