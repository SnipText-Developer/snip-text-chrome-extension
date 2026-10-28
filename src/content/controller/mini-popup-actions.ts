import type { StartPopupOptions, Template } from "@snip-text/mini-popup";
import type { EditorVendorName, EditorStatus } from "../../core/data-types";
import { sendMessage } from "../../common/message-bus";

export async function getEditorText(): Promise<string> {
  const response = await sendMessage({
    src: "CONTENT", dst: "BACKGROUND", method: "GET", path: "/editor/text", data: {},
  });
  if (response?.statusCode !== 200 || typeof response.data?.text !== "string") {
    throw new Error("메일 본문을 불러오지 못했습니다.");
  }
  return response.data.text;
}

export async function insertTemplate(text: string): Promise<void> {
  const response = await sendMessage({
    src: "CONTENT",
    dst: "BACKGROUND",
    path: "/editor/insert-text",
    method: "PUT",
    data: { text },
  });
  if (response?.statusCode !== 200) throw new Error("템플릿 삽입 실패");
}

export async function getTemplates(): Promise<Template[]> {
  const response = await sendMessage({
    src: "CONTENT",
    dst: "BACKGROUND",
    method: "GET",
    path: "/template/list",
    data: {},
  });
  if (
    response?.statusCode !== 200 ||
    !Array.isArray(response.data?.templates)
  ) {
    throw new Error("템플릿을 불러오지 못했습니다.");
  }
  return response.data.templates;
}

export function createMiniPopupActions(
  vendorName: EditorVendorName,
  getEditorStatus: () => Partial<EditorStatus> | null,
): Omit<StartPopupOptions, "selector"> {
  return {
    insertText: insertTemplate,
    getEditorText,
    getTemplates,
    correctTone: async (tone) => {
      const status = getEditorStatus();
      if (!status?.text?.replace(/\/톤(?:교(?:정)?)?\s*$/, "").trim()) {
        throw new Error("교정할 본문을 작성해주세요.");
      }
      // Synchronize this editor before asking BACKGROUND to read its body.
      const update = await sendMessage({
        src: "CONTENT", dst: "BACKGROUND", method: "PUT", path: "/editor/update-status",
        data: { vendorName, status: { text: status.text, isEditable: status.isEditable } },
      });
      if (update?.statusCode !== 200) throw new Error("메일 본문을 불러오지 못했습니다.");
      const response = await sendMessage({
        src: "CONTENT", dst: "BACKGROUND", method: "POST", path: "/ai/tone-correction",
        data: { tone },
      });
      if (response?.statusCode !== 200 || typeof response.data?.text !== "string" || !response.data.text.trim()) {
        throw new Error(response?.data?.msg ?? "교정 결과를 받지 못했습니다.");
      }
      return response.data.text;
    },
  };
}
