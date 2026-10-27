import type { Template } from "../../core/data-types";
import { DuplicateShortcutError, repository } from "./repository";

export class TemplateValidationError extends Error {}

const listTemplates = async (): Promise<Template[]> => {
  return await repository.readAll();
};

const replaceTemplate = async (input: unknown): Promise<Template | null> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TemplateValidationError("수정할 템플릿 정보를 입력해주세요.");
  }
  const data = input as Record<string, unknown>;
  if (typeof data.templateId !== "number" || !Number.isSafeInteger(data.templateId) || data.templateId <= 0) {
    throw new TemplateValidationError("템플릿 ID가 필요합니다.");
  }
  if (Object.keys(data).some((key) => !["templateId", "title", "shortcut", "content", "variables", "lastUsedAt", "createdAt", "editedAt"].includes(key))) {
    throw new TemplateValidationError("수정할 수 없는 항목이 포함되어 있습니다.");
  }
  const template: Template = {
    templateId: data.templateId as number, title: "", shortcut: "", content: "",
    variables: [], lastUsedAt: "", createdAt: "", editedAt: "",
  };
  for (const field of ["title", "shortcut", "content"] as const) {
    const value = data[field];
    if (typeof value !== "string" || !value.trim()) {
      throw new TemplateValidationError("이름, 단축어, 본문은 비워둘 수 없습니다.");
    }
    template[field] = field === "content" ? value : value.trim();
  }
  if (!/^\/[^\s/]+$/.test(template.shortcut)) {
    throw new TemplateValidationError("단축어는 /로 시작하고 공백 없이 입력해주세요.");
  }
  if (
    !Array.isArray(data.variables) ||
    !data.variables.every((value) => typeof value === "string" && value.trim() && value === value.trim()) ||
    new Set(data.variables).size !== data.variables.length
  ) throw new TemplateValidationError("변수는 중복 없는 문자열 배열이어야 합니다.");
  template.variables = [...data.variables];
  const placeholders = [...new Set(
    [...template.content.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((match) => match[1].trim()),
  )];
  if (placeholders.length !== template.variables.length || placeholders.some((name) => !template.variables.includes(name))) {
    throw new TemplateValidationError("변수 목록이 본문의 변수와 일치하지 않습니다.");
  }
  for (const field of ["lastUsedAt", "createdAt", "editedAt"] as const) {
    const value = data[field];
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
      throw new TemplateValidationError("날짜는 시간대가 포함된 ISO 8601 문자열이어야 합니다.");
    }
    template[field] = value;
  }
  try {
    return await repository.replace(template);
  } catch (error) {
    if (error instanceof DuplicateShortcutError) {
      throw new TemplateValidationError("이미 사용 중인 단축어입니다.");
    }
    throw error;
  }
};

export const service = { listTemplates, replaceTemplate };
