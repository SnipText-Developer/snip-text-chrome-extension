import type { Template } from "./types";

export const toneCommand: Template = {
  templateId: -1, title: "톤교정", shortcut: "/톤교정",
  content: "AI를 통해 작성한 글의 문체를 다듬을 수 있습니다.",
  variables: [], lastUsedAt: "", createdAt: "", editedAt: "",
};
export const toneOptions = [
  "상사/외부용", "보고/공문용", "마케팅/설득", "공지/안내",
  "부드러운 존댓말", "편한 반말", "감성/에세이",
].map((title, index) => ({ ...toneCommand, templateId: -index - 2, title }));
