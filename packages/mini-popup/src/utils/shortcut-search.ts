export function matchesShortcut(shortcut: string, normalizedQuery: string): boolean {
  const normalizedShortcut = shortcut.replace(/^\//, "").normalize("NFC").toLocaleLowerCase();
  return normalizedShortcut.startsWith(normalizedQuery);
}
