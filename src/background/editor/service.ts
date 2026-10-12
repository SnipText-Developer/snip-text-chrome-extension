import type { EditorStatus, EditorVendorName } from "../../core/data-types";
import { repository } from "./repository";

const getEditorStatus = async (
  vendorName: EditorVendorName,
): Promise<EditorStatus | void> => {
  const res = await repository.read(vendorName);
  if (!res) {
    return;
  }

  return res;
};

const updateEditorStatus = async (
  vendorName: EditorVendorName,
  status: Partial<EditorStatus>,
): Promise<EditorStatus | void> => {
  const res = await repository.update(vendorName, status);
  if (!res) {
    return;
  }

  return res;
};

const addPrevText = async (
  vendorName: EditorVendorName,
  prevText: string,
): Promise<EditorStatus | void> => {
  if (prevText === "") {
    return;
  }

  const res = await repository.appendPrevTexts(vendorName, prevText);
  if (!res) {
    return;
  }

  return res;
};

const updateText = async (
  vendorName: EditorVendorName,
  text: string,
  prevText: string,
): Promise<EditorStatus | void> => {
  if (prevText && prevText.length > 0) {
    await addPrevText(vendorName, prevText);
  }

  const response = await repository.update(vendorName, { text });
  if (!response) {
    return;
  }

  return response;
};

// Replace this catalog with a backend repository when an API is available.
const templates = [
  { id: "1", name: "템플릿 1", command: "/1", text: "template1" },
  { id: "2", name: "템플릿 2", command: "/2", text: "template2" },
  { id: "3", name: "템플릿 3", command: "/3", text: "template3" },
  { id: "4", name: "문의 접수 안내", command: "/4",
    text: "안녕하세요, {{이름}}님.\n\n{{문의사항}} 문의가 접수되었습니다.\n확인 후 {{이름}}님께 안내드리겠습니다." },
];
const listTemplates = () => templates;

export const service = {
  getEditorStatus,
  updateEditorStatus,
  addPrevText,
  updateText,
  listTemplates,
};
