import type { Template } from "../../core/data-types";

import { storage } from "../common/storage";

const STORAGE_KEY = "snip.templates";

const readAll = async (): Promise<Template[]> =>
  (await storage.get<Template[]>(STORAGE_KEY)) ?? [];

// Serialize read-modify-write operations to preserve concurrent changes.
let pending: Promise<unknown> = Promise.resolve();

const replace = (template: Template, insertIfMissing = false): Promise<Template | null> => {
  const operation = pending.then(async () => {
    const templates = await readAll();
    const index = templates.findIndex(
      (item) => item.templateId === template.templateId,
    );
    if (index === -1 && !insertIfMissing) return null;
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
    if (index === -1) templates.push(updated);
    else templates[index] = updated;
    await storage.set(STORAGE_KEY, templates);
    return { ...updated, variables: [...updated.variables] };
  });
  pending = operation.catch(() => {});
  return operation;
};

export class DuplicateShortcutError extends Error {}

const replaceAll = (templates: Template[]): Promise<void> => {
  const operation = pending.then(async () => {
    await storage.set(STORAGE_KEY, templates);
  });
  pending = operation.catch(() => {});
  return operation;
};

export const repository = { readAll, replace, replaceAll };
