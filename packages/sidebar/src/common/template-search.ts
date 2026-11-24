import type { Template } from "../core/data-types";

export function searchTemplates(templates: Template[], query: string): Template[] {
  const searchQuery = query.trim().toLowerCase();
  return templates.filter(({ title, shortcut }) =>
    title.toLowerCase().includes(searchQuery)
    || (shortcut ?? "").toLowerCase().includes(searchQuery),
  );
}
