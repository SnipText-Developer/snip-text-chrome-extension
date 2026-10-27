import type { EditorStatus, EditorVendorName } from "../../core/data-types";
import { repository } from "./repository";

export class EditorValidationError extends Error {}

function assertVendorName(value: unknown): asserts value is EditorVendorName {
  if (value !== "GOOGLE" && value !== "NAVER") {
    throw new EditorValidationError("지원하지 않는 메일 서비스입니다.");
  }
}

function assertText(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new EditorValidationError("본문은 문자열이어야 합니다.");
  }
}

function assertStatus(
  value: unknown,
  vendorName: EditorVendorName,
): asserts value is Partial<EditorStatus> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EditorValidationError("에디터 상태는 객체여야 합니다.");
  }
  const status = value as Record<string, unknown>;
  for (const key of Object.keys(status)) {
    switch (key) {
      case "isEditable":
        if (typeof status[key] !== "boolean") {
          throw new EditorValidationError(
            "편집 가능 여부는 boolean이어야 합니다.",
          );
        }
        break;
      case "text":
        assertText(status[key]);
        break;
      case "prevTexts":
        if (
          !Array.isArray(status[key]) ||
          !status[key].every((text) => typeof text === "string")
        ) {
          throw new EditorValidationError(
            "이전 본문은 문자열 배열이어야 합니다.",
          );
        }
        break;
      case "vendorName":
        assertVendorName(status[key]);
        if (status[key] !== vendorName) {
          throw new EditorValidationError(
            "에디터 상태의 메일 서비스가 일치하지 않습니다.",
          );
        }
        break;
      default:
        throw new EditorValidationError(
          "지원하지 않는 에디터 상태 항목입니다.",
        );
    }
  }
}

const getEditorStatus = async (
  vendorName: unknown,
): Promise<EditorStatus | void> => {
  assertVendorName(vendorName);
  const res = await repository.read(vendorName);
  if (!res) {
    return;
  }

  return res;
};

const updateEditorStatus = async (
  vendorName: unknown,
  status: unknown,
): Promise<EditorStatus | void> => {
  assertVendorName(vendorName);
  assertStatus(status, vendorName);
  const res = await repository.update(vendorName, status);
  if (!res) {
    return;
  }

  return res;
};

const addPrevText = async (
  vendorName: unknown,
  prevText: unknown,
): Promise<EditorStatus | void> => {
  assertVendorName(vendorName);
  assertText(prevText);
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
  vendorName: unknown,
  text: unknown,
  prevText: unknown,
): Promise<EditorStatus | void> => {
  assertVendorName(vendorName);
  assertText(text);
  assertText(prevText);
  if (prevText.length > 0) {
    await addPrevText(vendorName, prevText);
  }

  const response = await repository.update(vendorName, { text });
  if (!response) {
    return;
  }

  return response;
};

export const service = {
  getEditorStatus,
  updateEditorStatus,
  addPrevText,
  updateText,
};
