// Preserve repeated and line-edge spaces in HTML editors while allowing word wrapping.
export function encodeEditorText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/^ +| +$| {2,}/gm, (spaces) => "\u00a0".repeat(spaces.length));
}

// Normalize editor status text without changing whitespace or emoji joiners.
export function normalizeEditorText(text: string | null | undefined): string {
  return (text ?? "").replace(/\u200B/g, "").normalize("NFC");
}
