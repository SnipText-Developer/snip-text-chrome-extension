import type { Template } from "../../core/data-types";

const STORAGE_KEY = "snip.templates";

const readAll = async (): Promise<Template[]> => {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  type StoredTemplate = Partial<Template> & {
    id?: string;
    name?: string;
    command?: string;
    text?: string;
  };
  const templates: StoredTemplate[] =
    (stored[STORAGE_KEY] as StoredTemplate[] | undefined) ?? [];
  const usedIds = new Set(
    templates
      .map((item) => item.templateId ?? Number(item.id))
      .filter((id) => Number.isSafeInteger(id) && id > 0),
  );
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
      variables: template.variables
        ? [...template.variables]
        : [
            ...new Set(
              [...content.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((match) =>
                match[1].trim(),
              ),
            ),
          ],
      lastUsedAt: template.lastUsedAt ?? createdAt,
      createdAt,
      editedAt: template.editedAt ?? createdAt,
    };
  });
};

// Serialize read-modify-write operations to preserve concurrent changes.
let pending: Promise<unknown> = Promise.resolve();

const replace = (template: Template): Promise<Template | null> => {
  const operation = pending.then(async () => {
    const templates = await readAll();
    const index = templates.findIndex(
      (item) => item.templateId === template.templateId,
    );
    if (index === -1) return null;
    if (
      templates.some(
        (item) =>
          item.templateId !== template.templateId &&
          item.shortcut === template.shortcut,
      )
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

const replaceAll = (templates: Template[]): Promise<void> => {
  const operation = pending.then(async () => {
    await chrome.storage.local.set({ [STORAGE_KEY]: templates });
  });
  pending = operation.catch(() => {});
  return operation;
};

export const repository = { readAll, replace, replaceAll };
