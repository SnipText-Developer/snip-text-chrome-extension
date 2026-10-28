import { sendMessage } from "../../common/message-bus";

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
