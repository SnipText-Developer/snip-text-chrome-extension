import type { Template } from "../core/data-types";

export function formatShortcut(shortcut: string): string {
  return shortcut.replace(/^\//, "\\");
}

export function searchTemplates(templates: Template[], query: string): Template[] {
  const searchQuery = query.trim().toLowerCase();
  const shortcutQuery = formatShortcut(searchQuery);
  return templates.filter(({ title, shortcut }) =>
    title.toLowerCase().includes(searchQuery)
    || formatShortcut(shortcut ?? "").toLowerCase().includes(shortcutQuery),
  );
}
