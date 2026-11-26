import { useMemo, useRef } from "react";
import { findEditorAnchor, getEditorAnchorBounds, isValidAnchor, type EditorAnchor } from "./editor-anchor";

export function useEditorAnchor(selector: string, doc: Document) {
  const anchor = useRef<{ doc: Document; selector: string; match: EditorAnchor } | null>(null);

  return useMemo(() => {
    function readAnchor() {
      const current = anchor.current;
      return current?.doc === doc && current.selector === selector ? current.match : null;
    }

    return {
      clear() {
        if (readAnchor()) anchor.current = null;
      },
      matches(target: EventTarget | null): boolean {
        return target instanceof Element && target.closest(selector) !== null;
      },
      hasTrigger(target: EventTarget | null): boolean {
        const editor = target instanceof Element ? target.closest(selector) : null;
        return /[\\₩]/.test(editor?.textContent ?? "");
      },
      findTrigger(composing = false) {
        const match = findEditorAnchor(selector, composing, doc);
        if (!match) return null;
        anchor.current = { doc, selector, match };
        return { query: match.query, editorId: match.editor };
      },
      restoreEditorFocus() {
        const match = readAnchor();
        if (!match?.editor.isConnected) return;
        match.editor.focus({ preventScroll: true });
        if (isValidAnchor(match)) {
          doc.getSelection()?.collapse(match.trigger.endContainer, match.trigger.endOffset);
        }
      },
      isInsertionValid(): boolean {
        return isValidAnchor(readAnchor());
      },
      getBounds(): DOMRect | null {
        return getEditorAnchorBounds(readAnchor());
      },
    };
  }, [doc, selector]);
}
