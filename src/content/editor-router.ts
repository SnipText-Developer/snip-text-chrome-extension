import { listenMessage } from "../common/message-bus";
import type { MessageRequest, MessageResponse } from "../core/message-types";
import { insertTextToEditor } from "./controller/insert-text";
import { normalizeEditorText } from "./utils/editor-text";
import type { EditorVendorName } from "../core/data-types";
import type { EditorStatus } from "../core/data-types";

export interface EditorMessageRouterOptions {
  vendorName: EditorVendorName;
  getEditor: () => HTMLElement | null | undefined;
  getEditorStatus: () => Partial<EditorStatus> | null;
}

export function createEditorRouter({
  vendorName,
  getEditor,
  getEditorStatus,
}: EditorMessageRouterOptions) {
  return async (req: MessageRequest): Promise<MessageResponse | void> => {
    if (req.src !== "BACKGROUND" || req.dst !== "CONTENT") {
      return;
    }

    if (req.method === "PUT" && req.path === "/editor/insert-text") {
      if (!req.data || typeof req.data.text !== "string" || !req.data.text) {
        return {
          statusCode: 400,
          data: { msg: "Invalid data field" },
        };
      }

      const text = normalizeEditorText(req.data.text);
      if (!text)
        return { statusCode: 400, data: { msg: "Invalid data field" } };
      if (/\{\{[\s\S]*?\}\}/.test(text)) {
        return {
          statusCode: 400,
          data: { msg: "템플릿의 변수를 모두 입력해 주세요." },
        };
      }
      const editor = getEditor();
      const { prevText, isInserted } = insertTextToEditor(editor, text);

      if (!isInserted) {
        return {
          statusCode: 404,
          data: { msg: `${vendorName} 에디터가 실행되지 않았습니다.` },
        };
      }

      return {
        statusCode: 200,
        data: {
          prevText,
          text: getEditorStatus()?.text ?? "",
          isInserted,
          vendorName,
        },
      };
    }
  };
}

export function listenEditorRouter(
  route: (req: MessageRequest) => Promise<MessageResponse | void>,
): void {
  listenMessage(route);
}
