export interface EditorAnchor {
  editor: HTMLElement;
  trigger: Range;
  query: string;
  text: string;
}

function containsRange(editor: HTMLElement, range: Range): boolean {
  return editor.isConnected && editor.contains(range.startContainer) && editor.contains(range.endContainer);
}

function moveCaret(editor: HTMLElement, range: Range) {
  editor.focus({ preventScroll: true });
  const selection = editor.ownerDocument.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function findEditorAnchor(selector: string, isComposing: boolean): EditorAnchor | null {
  const selection = document.getSelection();
  if (!selection?.rangeCount || (!isComposing && !selection.isCollapsed)) return null;

  const caret = selection.getRangeAt(0).cloneRange();
  caret.collapse(false);
  const element = caret.endContainer.nodeType === Node.ELEMENT_NODE
    ? caret.endContainer as Element
    : caret.endContainer.parentElement;
  const editor = element?.closest<HTMLElement>(selector);
  if (!editor || !editor.contains(document.activeElement) || !containsRange(editor, caret)) return null;

  const prefix = editor.ownerDocument.createRange();
  prefix.selectNodeContents(editor);
  prefix.setEnd(caret.endContainer, caret.endOffset);
  const text = prefix.toString();
  const match = /(?:^|\s)(\/([^\s/]*))$/.exec(text);
  if (!match) return null;

  // Map the text offset back to the original DOM, including nested formatting.
  let remaining = text.length - match[1].length;
  const walker = editor.ownerDocument.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (remaining >= length) {
      remaining -= length;
      continue;
    }
    const trigger = caret.cloneRange();
    trigger.setStart(node, remaining);
    return { editor, trigger, text: trigger.toString(), query: match[2].normalize("NFC").toLocaleLowerCase() };
  }
  return null;
}

export interface EditorSnapshot {
  editor: HTMLElement;
  range: Range;
}

export function snapshotEditor(anchor: EditorAnchor | null): EditorSnapshot | null {
  if (!anchor || !containsRange(anchor.editor, anchor.trigger)) return null;
  // Mail pages may rewrite the DOM and move live ranges after opening the popup.
  if (anchor.trigger.toString() !== anchor.text) return null;
  return { editor: anchor.editor, range: anchor.trigger.cloneRange() };
}

export function restoreEditorFocus({ editor, range }: EditorSnapshot): void {
  if (!containsRange(editor, range)) return;
  range.collapse(false);
  moveCaret(editor, range);
}
