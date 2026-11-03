import type { Template } from "../../core/data-types";

export interface TemplateApiIssue {
  path: string;
  expected: string;
  received: string;
}

export class TemplateApiValidationError extends Error {
  readonly issues: TemplateApiIssue[];

  constructor(issues: TemplateApiIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.expected} 필요 (받은 타입: ${issue.received})`).join("\n"));
    this.name = "TemplateApiValidationError";
    this.issues = issues;
  }
}

const typeOf = (value: unknown): string =>
  value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

// JSON은 외부 입력이므로 타입 단언 대신 각 필드를 검사합니다.
export const validateTemplateApiResponse = (input: unknown): Template[] => {
  const issues: TemplateApiIssue[] = [];
  const add = (path: string, expected: string, value: unknown) => {
    issues.push({ path, expected, received: typeOf(value) });
  };
  const items = Array.isArray(input) ? input
    : input && typeof input === "object" && "templates" in input ? input.templates : undefined;
  if (!Array.isArray(items)) {
    throw new TemplateApiValidationError([{ path: "$", expected: "템플릿 배열 또는 { templates: 배열 }", received: typeOf(input) }]);
  }
  const ids = new Set<number>();
  const shortcuts = new Set<string>();
  const templates: Template[] = [];
  items.forEach((item: unknown, index) => {
    const path = `templates[${index}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      add(path, "템플릿 객체", item);
      return;
    }
    const dto = item as Record<string, unknown>;
    const id = typeof dto.templateId === "string" && /^[1-9]\d*$/.test(dto.templateId)
      ? Number(dto.templateId) : dto.templateId;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
      add(`${path}.templateId`, "양의 안전한 정수 또는 해당 정수 문자열", dto.templateId);
    } else {
      if (ids.has(id)) add(`${path}.templateId`, "중복되지 않는 ID", dto.templateId);
      ids.add(id);
    }
    for (const field of ["title", "shortcut", "content"] as const) {
      if (typeof dto[field] !== "string" || !dto[field].trim()) {
        add(`${path}.${field}`, "공백이 아닌 문자열", dto[field]);
      }
    }
    const shortcut = typeof dto.shortcut === "string" ? dto.shortcut.trim() : "";
    if (typeof dto.shortcut === "string") {
      if (!/^\/[^\s/]+$/.test(shortcut)) add(`${path}.shortcut`, "/로 시작하며 공백과 추가 /가 없는 단축어", dto.shortcut);
      if (shortcuts.has(shortcut)) add(`${path}.shortcut`, "중복되지 않는 단축어", dto.shortcut);
      shortcuts.add(shortcut);
    }
    const placeholders = typeof dto.content === "string"
      ? [...new Set([...dto.content.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((match) => match[1].trim()))] : [];
    const variables = dto.variables === undefined ? placeholders : dto.variables;
    if (!Array.isArray(variables)) {
      add(`${path}.variables`, "문자열 배열", variables);
    } else {
      variables.forEach((value: unknown, variableIndex) => {
        if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
          add(`${path}.variables[${variableIndex}]`, "양끝 공백 없는 비어 있지 않은 문자열", value);
        }
      });
      if (new Set(variables).size !== variables.length) add(`${path}.variables`, "중복 없는 변수 목록", variables);
      if (variables.length !== placeholders.length || placeholders.some((name) => !variables.includes(name))) {
        add(`${path}.variables`, "본문의 {{변수}}와 일치하는 목록", variables);
      }
    }
    const dates: Record<string, unknown> = {};
    for (const field of ["createdAt", "editedAt", "lastUsedAt"] as const) {
      const value = dto[field] === undefined
        ? (field === "createdAt" ? "1970-01-01T00:00:00.000Z" : dto.createdAt ?? "1970-01-01T00:00:00.000Z")
        : dto[field];
      dates[field] = value;
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
        add(`${path}.${field}`, "시간대를 포함한 ISO 8601 날짜 문자열", value);
      }
    }
    // 모든 항목 검증을 마친 뒤 오류가 하나라도 있으면 결과 전체를 폐기합니다.
    templates.push({
      templateId: id, title: typeof dto.title === "string" ? dto.title.trim() : dto.title,
      shortcut, content: dto.content, variables, ...dates,
    } as Template);
  });
  if (issues.length) throw new TemplateApiValidationError(issues);
  return templates;
};
