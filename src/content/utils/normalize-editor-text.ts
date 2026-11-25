// Normalize editor status text without changing whitespace or emoji joiners.
export function normalizeEditorText(text: string | null | undefined): string {
  return (text ?? "").replace(/\u200B/g, "").normalize("NFC");
}
