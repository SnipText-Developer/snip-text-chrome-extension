export function formatShortcut(shortcut: string): string {
  return shortcut.replace(/^\//, "\\");
}

export function matchesShortcut(shortcut: string, normalizedQuery: string): boolean {
  const normalizedShortcut = formatShortcut(shortcut).replace(/^\\/, "").normalize("NFC").toLocaleLowerCase();
  return normalizedShortcut.startsWith(normalizedQuery);
}
