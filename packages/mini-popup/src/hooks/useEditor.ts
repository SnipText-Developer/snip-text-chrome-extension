import { useMemo, useRef } from "react";
import {
  findEditorAnchor,
  snapshotEditor,
  restoreEditorFocus,
} from "../dom/editor";
import type { EditorAnchor } from "../dom/editor";

export function useEditor(selector: string) {
  const anchor = useRef<EditorAnchor | null>(null);

  return useMemo(() => ({
    anchor,
    clear() {
      anchor.current = null;
    },
    findTrigger(isComposing = false): EditorAnchor | null {
      const found = findEditorAnchor(selector, isComposing);
      if (found) anchor.current = found;
      return found;
    },
    isInsertionValid(): boolean {
      return snapshotEditor(anchor.current) !== null;
    },
    restoreFocus(beforeRestore: () => void) {
      const saved = snapshotEditor(anchor.current);
      beforeRestore();
      if (saved) restoreEditorFocus(saved);
    },
  }), [selector]);
}
