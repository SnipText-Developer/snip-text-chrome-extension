export interface PopupEventHandlers {
  input: (event: Event) => void;
  selectionchange: () => void;
  compositionstart: (event: CompositionEvent) => void;
  compositionend: (event: CompositionEvent) => void;
  keydown: (event: KeyboardEvent) => boolean | void;
  pointerdown: (event: PointerEvent) => void;
}

export function createEventDom(host: HTMLElement) {
  return {
    subscribe(handlers: PopupEventHandlers): () => void {
      const doc = host.ownerDocument;
      const listeners = new AbortController();
      const { signal } = listeners;
      const insidePopup = (event: Event) => event.composedPath().includes(host);
      const stopPopupKey = (event: KeyboardEvent) => {
        if (insidePopup(event)) event.stopImmediatePropagation();
      };
      doc.addEventListener("input", handlers.input, { signal });
      doc.addEventListener("selectionchange", handlers.selectionchange, { signal });
      doc.addEventListener("compositionstart", handlers.compositionstart, { signal });
      doc.addEventListener("compositionend", handlers.compositionend, { signal });
      // Capture before mail editors stop key events from bubbling.
      doc.defaultView?.addEventListener("keydown", (event) => {
        const inside = insidePopup(event);
        const handled = handlers.keydown(event);
        // Keep native text entry and button activation, but isolate popup keys.
        if (inside || handled) event.stopImmediatePropagation();
      }, { capture: true, signal });
      doc.defaultView?.addEventListener("keyup", stopPopupKey, { capture: true, signal });
      doc.defaultView?.addEventListener("keypress", stopPopupKey, { capture: true, signal });
      doc.addEventListener("pointerdown", handlers.pointerdown, { signal });
      return () => listeners.abort();
    },
  };
}

export function preserveEditorSelection(event: { target: EventTarget | null; preventDefault(): void }) {
  const target = event.target;
  if (target instanceof Element && target.closest("input, button, label, textarea, select, a")) return;
  event.preventDefault();
}

export function preventDefault(event: { preventDefault(): void }) { event.preventDefault(); }
