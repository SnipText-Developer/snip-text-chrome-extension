export interface EditorAnchor {
  editor: HTMLElement;
  trigger: Range;
  query: string;
  text: string;
}

function containsRange(editor: HTMLElement, range: Range): boolean {
  return editor.isConnected && editor.contains(range.startContainer) && editor.contains(range.endContainer);
}

export function findEditorAnchor(selector: string, isComposing: boolean, doc: Document): EditorAnchor | null {
  const selection = doc.getSelection();
  if (!selection?.rangeCount || (!isComposing && !selection.isCollapsed)) return null;

  const caret = selection.getRangeAt(0).cloneRange();
  caret.collapse(false);
  const element = caret.endContainer.nodeType === Node.ELEMENT_NODE
    ? caret.endContainer as Element
    : caret.endContainer.parentElement;
  const editor = element?.closest<HTMLElement>(selector);
  if (!editor || !editor.contains(doc.activeElement) || !containsRange(editor, caret)) return null;

  const prefix = editor.ownerDocument.createRange();
  prefix.selectNodeContents(editor);
  prefix.setEnd(caret.endContainer, caret.endOffset);
  const text = prefix.toString();
  const suffix = /[\\₩]([^\s\\₩]*)$/.exec(text);
  if (!suffix) return null;
  const startsAfterWhitespace = suffix.index === 0 || /\s/.test(text[suffix.index - 1]);
  const query = suffix[1].normalize("NFC");
  const trailingBackslash = text.endsWith("\\") && text.length === editor.textContent?.length;
  const isToneCommand = query !== "" && "톤교정".startsWith(query);
  if (!startsAfterWhitespace && !trailingBackslash && !isToneCommand) return null;

  // Map the text offset back to the original DOM, including nested formatting.
  let remaining = suffix.index;
  const walker = editor.ownerDocument.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (remaining >= length) {
      remaining -= length;
      continue;
    }
    const trigger = caret.cloneRange();
    trigger.setStart(node, remaining);
    return { editor, trigger, text: trigger.toString(), query: query.toLocaleLowerCase() };
  }
  return null;
}

export function isValidAnchor(anchor: EditorAnchor | null): boolean {
  // Mail pages can rewrite the DOM and move live ranges while the popup is open.
  return !!anchor && containsRange(anchor.editor, anchor.trigger)
    && anchor.trigger.toString() === anchor.text;
}

export function getEditorAnchorBounds(anchor: EditorAnchor | null): DOMRect | null {
  if (!anchor?.editor.isConnected) return null;
  // The trigger starts at the backslash; the animation must meet its caret end.
  const caret = anchor.trigger.cloneRange();
  caret.collapse(false);
  const rect = caret.getBoundingClientRect();
  return rect.height ? rect : anchor.editor.getBoundingClientRect();
}
