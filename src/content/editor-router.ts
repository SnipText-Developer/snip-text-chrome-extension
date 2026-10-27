import { listenMessage } from "../common/message-bus";
import type { MessageRequest, MessageResponse } from "../core/message-types";
import { insertTextToEditor } from "./controller/insert-text";
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
      if (!req.data || !req.data.text) {
        return {
          statusCode: 400,
          data: { msg: "Invalid data field" },
        };
      }

      const editor = getEditor();
      const { prevText, isInserted } = insertTextToEditor(
        editor,
        req.data.text,
      );

      if (!isInserted) {
        return {
          statusCode: 404,
          data: { msg: `${vendorName} editor not found.` },
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
