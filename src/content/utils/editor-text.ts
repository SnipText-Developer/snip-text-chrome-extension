// Preserve repeated and line-edge spaces in HTML editors while allowing word wrapping.
export function encodeEditorText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/^ +| +$| {2,}/gm, (spaces) => "\u00a0".repeat(spaces.length));
}

const lineBlocks = new Set([
  "ADDRESS", "BLOCKQUOTE", "DIV", "H1", "H2", "H3", "H4", "H5", "H6",
  "LI", "OL", "P", "PRE", "UL",
]);

function readLines(element: Element): string {
  let text = "";
  let previousBlock = false;

  for (const node of element.childNodes) {
    if (node.nodeType === 3) {
      const value = node.nodeValue ?? "";
      if (!value) continue;
      if (previousBlock) text += "\n";
      text += value;
      previousBlock = false;
    } else if (node.nodeType === 1) {
      const child = node as Element;
      const block = lineBlocks.has(child.tagName);
      const emptyBlock = block && child.childNodes.length === 1 &&
        child.firstChild?.nodeName === "BR";
      const value = child.tagName === "BR" ? "\n" : emptyBlock ? "" : readLines(child);
      if (!value && !block) continue;
      if (previousBlock || (block && text && !text.endsWith("\n"))) text += "\n";
      text += value;
      previousBlock = block;
    }
  }
  return text;
}

export function readEditorText(editor: HTMLElement | null | undefined): string {
  return editor ? readLines(editor) : "";
}
