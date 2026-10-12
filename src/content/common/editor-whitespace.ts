// HTML editors can collapse consecutive spaces and hide line-edge spaces.
// Keep ordinary single word separators so text can still wrap naturally.
export function preserveEditorSpaces(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/^ +| +$| {2,}/gm, spaces =>
    "\u00a0".repeat(spaces.length));
}
