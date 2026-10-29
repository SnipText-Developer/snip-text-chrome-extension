export interface PopupEventHandlers {
  input: (event: Event) => void;
  selectionchange: () => void;
  compositionstart: (event: CompositionEvent) => void;
  compositionend: (event: CompositionEvent) => void;
  pointerdown: (event: PointerEvent) => void;
}

export interface PopupKeyboardContext {
  events: ReturnType<typeof createEventDom>;
  isEditorEvent: (event: Event) => boolean;
}

export function createEventDom(host: HTMLElement) {
  let keyboard: { handle: (event: KeyboardEvent) => boolean | void } | null = null;
  let composing = false;
  return {
    // Keep one capture listener for the popup's lifetime. Switching screens
    // replaces its delegate without moving behind the mail page's listeners.
    connectKeyboard(handle: (event: KeyboardEvent) => boolean | void) {
      const binding = { handle };
      keyboard = binding;
      return () => {
        if (keyboard === binding) {
          keyboard = null;
          composing = false;
        }
      };
    },
    isComposing: () => composing,
    subscribe(handlers: PopupEventHandlers): () => void {
      const doc = host.ownerDocument;
      const listeners = new AbortController();
      const { signal } = listeners;
      const insidePopup = (event: Event) => host.dataset.open === "true" && event.composedPath().includes(host);
      const stopPopupKey = (event: KeyboardEvent) => {
        if (insidePopup(event)) event.stopImmediatePropagation();
      };
      doc.addEventListener("input", handlers.input, { signal });
      doc.addEventListener("selectionchange", handlers.selectionchange, { signal });
      doc.addEventListener("compositionstart", (event) => {
        composing = true;
        handlers.compositionstart(event);
      }, { signal });
      doc.addEventListener("compositionend", (event) => {
        composing = false;
        handlers.compositionend(event);
      }, { signal });
      // Capture before mail editors stop key events from bubbling.
      doc.defaultView?.addEventListener("keydown", (event) => {
        const inside = insidePopup(event);
        const handled = host.dataset.open === "true" ? keyboard?.handle(event) : false;
        // Keep native text entry and button activation, but isolate popup keys.
        if (inside || handled) event.stopImmediatePropagation();
      }, { capture: true, signal });
      doc.defaultView?.addEventListener("keyup", stopPopupKey, { capture: true, signal });
      doc.defaultView?.addEventListener("keypress", stopPopupKey, { capture: true, signal });
      doc.addEventListener("pointerdown", handlers.pointerdown, { signal });
      return () => { listeners.abort(); composing = false; };
    },
  };
}

export function preserveEditorSelection(event: { target: EventTarget | null; preventDefault(): void }) {
  const target = event.target;
  if (target instanceof Element && target.closest("input, button, label, textarea, select, a")) return;
  event.preventDefault();
}

export function preventDefault(event: { preventDefault(): void }) { event.preventDefault(); }
