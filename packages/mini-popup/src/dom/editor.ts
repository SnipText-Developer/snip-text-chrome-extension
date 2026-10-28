interface EditorAnchor {
  editor: HTMLElement;
  trigger: Range;
  query: string;
  text: string;
}

function containsRange(editor: HTMLElement, range: Range): boolean {
  return editor.isConnected && editor.contains(range.startContainer) && editor.contains(range.endContainer);
}

function findEditorAnchor(selector: string, isComposing: boolean, doc: Document): EditorAnchor | null {
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
  const suffix = /(\/([^\s/]+))$/.exec(text);
  const toneMatch = suffix && "톤교정".startsWith(suffix[2].normalize("NFC")) ? suffix : null;
  const match = /(?:^|\s)(\/([^\s/]*))$/.exec(text) ?? toneMatch;
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

function isValidAnchor(anchor: EditorAnchor | null): boolean {
  // Mail pages can rewrite the DOM and move live ranges while the popup is open.
  return !!anchor && containsRange(anchor.editor, anchor.trigger)
    && anchor.trigger.toString() === anchor.text;
}

/** Selection state belongs to the editor adapter, never to React state. */
export function createEditorDom(selector: string, doc: Document) {
  let anchor: EditorAnchor | null = null;
  return {
    clear() { anchor = null; },
    matches(target: EventTarget | null): boolean {
      return target instanceof Element && target.closest(selector) !== null;
    },
    hasSlash(target: EventTarget | null): boolean {
      const editor = target instanceof Element ? target.closest(selector) : null;
      return editor?.textContent?.includes("/") === true;
    },
    findTrigger(composing = false) {
      const found = findEditorAnchor(selector, composing, doc);
      if (!found) return null;
      anchor = found;
      return { query: found.query, editorId: found.editor as object };
    },
    isInsertionValid(): boolean { return isValidAnchor(anchor); },
    getBounds(): DOMRect | null {
      if (!anchor?.editor.isConnected) return null;
      const rect = anchor.trigger.getBoundingClientRect();
      return rect.height ? rect : anchor.editor.getBoundingClientRect();
    },
  };
}
