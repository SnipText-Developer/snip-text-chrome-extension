import type { EditorStatus } from "../core/data-types";

export function isEditorStatus(value: unknown): value is EditorStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const status = value as Partial<EditorStatus>;
  return (
    (status.vendorName === "GOOGLE" || status.vendorName === "NAVER") &&
    typeof status.isEditable === "boolean" &&
    typeof status.text === "string" &&
    Array.isArray(status.prevTexts) &&
    status.prevTexts.every((text) => typeof text === "string")
  );
}

