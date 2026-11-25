import { useEffect } from "react";

interface EditorEventHandlers {
  input: (event: Event) => void;
  selectionchange: () => void;
  compositionstart: (event: CompositionEvent) => void;
  compositionend: (event: CompositionEvent) => void;
  pointerdown: (event: PointerEvent) => void;
}

export function useEditorEvents(doc: Document, handlers: EditorEventHandlers) {
  useEffect(() => {
    const listeners = new AbortController();
    const { signal } = listeners;
    doc.addEventListener("input", handlers.input, { signal });
    doc.addEventListener("selectionchange", handlers.selectionchange, { signal });
    doc.addEventListener("compositionstart", handlers.compositionstart, { capture: true, signal });
    doc.addEventListener("compositionend", handlers.compositionend, { capture: true, signal });
    doc.addEventListener("pointerdown", handlers.pointerdown, { signal });
    return () => listeners.abort();
  }, [doc, handlers]);
}
