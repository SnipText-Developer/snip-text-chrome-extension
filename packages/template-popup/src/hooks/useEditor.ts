import { useCallback, useEffect, useMemo, useRef } from "react";
import { preserveEditorSpaces } from "../utils/text";

export interface EditorAnchor {
  editor: HTMLElement;
  trigger: Range;
  query: string;
}

export function useEditor(selector: string) {
  const anchor = useRef<EditorAnchor | null>(null);
  const clear = useCallback(() => {
    anchor.current = null;
  }, []);

  const findTrigger = useCallback((): EditorAnchor | null => {
    const selection = window.getSelection();
    if (!selection?.isCollapsed || !selection.rangeCount) return null;
    const caret = selection.getRangeAt(0);
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
    const start = text.length - queryMatch[1].length;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let node: Node | null;
    let trigger: Range | null = null;
    while ((node = walker.nextNode())) {
      const length = node.textContent?.length ?? 0;
      if (start < offset + length) {
        trigger = caret.cloneRange();
        trigger.setStart(node, start - offset);
        break;
      }
      offset += length;
    }
    if (!trigger) return null;
    const match = { editor, trigger, query: queryMatch[2].toLocaleLowerCase() };
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
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      // Native editing preserves the host editor's input handling and undo history.
      if (!document.execCommand("insertText", false, insertionText)) {
        range.deleteContents();
        const node = document.createTextNode(insertionText);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
        target.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: insertionText,
          }),
        );
      }
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
    if (caret) {
      caret.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(caret);
    }
  }, []);

  useEffect(() => clear, [clear]);
  return useMemo(
    () => ({ anchor, findTrigger, insertText, restoreFocus, clear }),
    [findTrigger, insertText, restoreFocus, clear],
  );
}
