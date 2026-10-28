import { useCallback, useEffect, useMemo, useRef } from "react";
import { preserveEditorSpaces } from "../utils/text";

export interface EditorAnchor {
  editor: HTMLElement;
  trigger: Range;
  query: string;
}

function selectRange(range: Range) {
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function createTriggerRange(editor: HTMLElement, caret: Range, startOffset: number): Range | null {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const length = node.textContent?.length ?? 0;
    if (startOffset < offset + length) {
      const trigger = caret.cloneRange();
      trigger.setStart(node, startOffset - offset);
      return trigger;
    }
    offset += length;
  }
  return null;
}

function insertTextAtRange(editor: HTMLElement, range: Range, text: string) {
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selectRange(range);
  editor.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    composed: true,
    inputType: "insertText",
    data: text,
  }));
}

export function useEditor(selector: string) {
  const anchor = useRef<EditorAnchor | null>(null);
  const clear = useCallback(() => {
    anchor.current = null;
  }, []);

  const findTrigger = useCallback((isComposing = false): EditorAnchor | null => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || (!selection.isCollapsed && !isComposing)) return null;
    // IMEs may select the composing syllable instead of exposing a collapsed caret.
    const caret = selection.getRangeAt(0).cloneRange();
    caret.collapse(false);
    const element =
      caret.startContainer.nodeType === Node.ELEMENT_NODE
        ? (caret.startContainer as Element)
        : caret.startContainer.parentElement;
    const editor = element?.closest<HTMLElement>(selector) ?? null;
    if (!editor || document.activeElement !== editor) return null;
    const prefix = caret.cloneRange();
    prefix.selectNodeContents(editor);
    prefix.setEnd(caret.startContainer, caret.startOffset);
    const text = prefix.toString();
    const queryMatch = /(?:^|\s)(\/([^\s/]*))$/.exec(text);
    if (!queryMatch) return null;
    const trigger = createTriggerRange(editor, caret, text.length - queryMatch[1].length);
    if (!trigger) return null;
    const match: EditorAnchor = {
      editor,
      trigger,
      query: queryMatch[2].normalize("NFC").toLocaleLowerCase(),
    };
    anchor.current = match;
    return match;
  }, [selector]);

  const insertText = useCallback(
    (text: string, beforeInsert: () => void): boolean => {
      const match = anchor.current;
      if (!match?.editor.isConnected) return false;
      const target = match.editor;
      const range = match.trigger.cloneRange();
      // Snapshot the range before closing the popup clears the anchor.
      beforeInsert();
      const insertionText = preserveEditorSpaces(text);
      target.focus();
      insertTextAtRange(target, range, insertionText);
      return true;
    },
    [],
  );

  const restoreFocus = useCallback((beforeRestore: () => void) => {
    const match = anchor.current;
    const caret = match?.trigger.cloneRange();
    beforeRestore();
    if (!match?.editor.isConnected) return;
    match.editor.focus();
    if (!caret) return;
    caret.collapse(false);
    selectRange(caret);
  }, []);

  useEffect(() => clear, [clear]);
  return useMemo(
    () => ({ anchor, findTrigger, insertText, restoreFocus, clear }),
    [findTrigger, insertText, restoreFocus, clear],
  );
}
