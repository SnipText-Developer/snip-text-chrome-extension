import type { Template } from "../../core/data-types";

const defaults: Template[] = [
  { templateId: 1, title: "템플릿 1", shortcut: "/1", content: "template1" },
  { templateId: 2, title: "템플릿 2", shortcut: "/2", content: "template2" },
  { templateId: 3, title: "템플릿 3", shortcut: "/3", content: "template3" },
  {
    templateId: 4,
    title: "문의 접수 안내",
    shortcut: "/4",
    content: "안녕하세요, {{이름}}님.\n\n{{문의사항}} 문의가 접수되었습니다.\n확인 후 {{이름}}님께 안내드리겠습니다. {{끝인사말}}",
  },
  { templateId: 5, title: "템플릿 5", shortcut: "/11", content: "template5" },
  { templateId: 6, title: "템플릿 6", shortcut: "/111", content: "template6" },
  { templateId: 7, title: "템플릿 7", shortcut: "/1111", content: "template7" },
  {
    templateId: 12,
    title: "프로젝트 견적 안내",
    shortcut: "/견적",
    content: "안녕하세요 {{고객명}}님,\n문의 주신 프로젝트 견적은 {{금액}}원입니다.\n{{고객명}}님의 일정에 맞춰 진행 가능합니다.",
  },
].map((template) => ({
  ...template,
  variables: [...new Set([...template.content.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((match) => match[1].trim()))],
  lastUsedAt: "2026-10-07T09:12:00+09:00",
  createdAt: "2026-09-20T14:03:00+09:00",
  editedAt: "2026-10-01T11:40:00+09:00",
}));

const STORAGE_KEY = "snip.templates";

const readAll = async (): Promise<Template[]> => {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  type StoredTemplate = Partial<Template> & {
    id?: string;
    name?: string;
    command?: string;
    text?: string;
  };
  const templates: StoredTemplate[] = (stored[STORAGE_KEY] as StoredTemplate[] | undefined) ?? defaults;
  const usedIds = new Set(templates.map((item) => item.templateId ?? Number(item.id))
    .filter((id) => Number.isSafeInteger(id) && id > 0));
  let nextId = 1;
  return templates.map((template) => {
    let templateId = template.templateId ?? Number(template.id);
    if (!Number.isSafeInteger(templateId) || templateId <= 0) {
      while (usedIds.has(nextId)) nextId++;
      templateId = nextId++;
      usedIds.add(templateId);
    }
    const content = template.content ?? template.text ?? "";
    // Old records have no timestamp information; use the epoch rather than inventing dates.
    const createdAt = template.createdAt ?? "1970-01-01T00:00:00.000Z";
    return {
      templateId,
      title: template.title ?? template.name ?? "",
      shortcut: template.shortcut ?? template.command ?? "",
      content,
      variables: template.variables ? [...template.variables] : [...new Set(
        [...content.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((match) => match[1].trim()),
      )],
      lastUsedAt: template.lastUsedAt ?? createdAt,
      createdAt,
      editedAt: template.editedAt ?? createdAt,
    };
  });
};

// Serialize read-modify-write operations to preserve concurrent changes.
let pending: Promise<unknown> = Promise.resolve();

const replace = (
  template: Template,
): Promise<Template | null> => {
  const operation = pending.then(async () => {
    const templates = await readAll();
    const index = templates.findIndex((item) => item.templateId === template.templateId);
    if (index === -1) return null;
    if (
      templates.some((item) => item.templateId !== template.templateId && item.shortcut === template.shortcut)
    ) {
      throw new DuplicateShortcutError();
    }
    const updated = { ...template, variables: [...template.variables] };
    templates[index] = updated;
    await chrome.storage.local.set({ [STORAGE_KEY]: templates });
    return { ...updated, variables: [...updated.variables] };
  });
  pending = operation.catch(() => {});
  return operation;
};

export class DuplicateShortcutError extends Error {}

export const repository = { readAll, replace };
