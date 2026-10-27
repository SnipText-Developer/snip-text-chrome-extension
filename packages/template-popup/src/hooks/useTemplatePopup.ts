import { useCallback, useEffect, useRef, useState } from "react";
import type { Template, StartPopupOptions } from "../types";
import { useEditor } from "./useEditor";

interface PopupState {
  open: boolean;
  templates: Template[];
  active: number;
  selectedTemplate: Template | null;
  message?: string;
}
const initialState: PopupState = { open: false, templates: [], active: 0, selectedTemplate: null };
interface Actions {
  choose: (template: Template) => void;
  select: (index: number) => void;
  cancel: () => void;
  insert: (text: string) => void;
}

export function useTemplatePopup(selector: string, getTemplates: StartPopupOptions["getTemplates"], host: HTMLElement, shadow: ShadowRoot) {
  const [state, setState] = useState(initialState);
  // Native key events may arrive within the same React batch.
  const currentState = useRef(state);
  const editor = useEditor(selector);
  const { anchor } = editor;
  const composing = useRef(false);
  const actions = useRef<Actions | null>(null);

  useEffect(() => {
    let generation = 0;
    let disposed = false;
    let dismissed = false;
    function publish(next: PopupState) {
      currentState.current = next;
      setState(next);
    }
    function close() {
      generation++;
      editor.clear();
      host.style.display = "none";
      publish(initialState);
    }
    function insert(text: string) {
      if (!editor.insertText(text, close)) close();
    }

    function choose(template: Template) {
      generation++;
      if (!anchor.current?.editor.isConnected) return close();
      if (!template.variables.length) return insert(template.content);
      publish({ ...currentState.current, selectedTemplate: template });
    }
    function select(index: number) {
      publish({ ...currentState.current, active: index });
    }
    function cancel() {
      dismissed = true;
      editor.restoreFocus(close);
    }

    async function update() {
      if (disposed || dismissed || composing.current || currentState.current.selectedTemplate || document.activeElement === host) return;
      const match = editor.findTrigger();
      if (!match) return close();
      const request = ++generation;
      publish({ ...initialState, open: true, message: "템플릿 불러오는 중…" });
      try {
        const result = await getTemplates();
        if (disposed || request !== generation) return;
        if (!Array.isArray(result)) throw new Error("Invalid template list");
        const templates = result.filter((template) =>
          `${template.title} ${template.shortcut} ${template.content}`.toLocaleLowerCase().includes(match.query),
        );
        publish({ ...initialState, open: true, templates });
      } catch {
        if (disposed || request !== generation) return;
        publish({ ...currentState.current, message: "템플릿을 불러오지 못했습니다. 다시 입력해주세요." });
      }
    }
    function onInput() { dismissed = false; void update(); }
    function onSelectionChange() { void update(); }
    function onCompositionStart() {
      composing.current = true;
      if (!currentState.current.selectedTemplate) close();
    }
    function onCompositionEnd() { composing.current = false; void update(); }
    function onKeyDown(event: KeyboardEvent) {
      if (!anchor.current || composing.current || event.isComposing) return;
      const snapshot = currentState.current;
      if (snapshot.selectedTemplate) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          cancel();
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        dismissed = true;
        close();
      } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && snapshot.templates.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        select((snapshot.active + (event.key === "ArrowDown" ? 1 : -1) + snapshot.templates.length) % snapshot.templates.length);
      } else if (event.key === "Enter" && snapshot.templates.length && !event.shiftKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        choose(snapshot.templates[snapshot.active]);
      }
    }
    function onMouseDown(event: MouseEvent) {
      if (!event.composedPath().includes(host)) close();
    }
    function onFocusOut() {
      queueMicrotask(() => {
        if (disposed) return;
        const activeElement = document.activeElement;
        const editorElement = anchor.current?.editor;
        const focusedInEditor = activeElement === editorElement ||
          (activeElement !== null && editorElement?.contains(activeElement));
        const focusedInPopup = activeElement === host || shadow.activeElement !== null;
        if (!focusedInEditor && !focusedInPopup) close();
      });
    }
    actions.current = { choose, select, cancel, insert };
    document.addEventListener("input", onInput);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("compositionstart", onCompositionStart);
    document.addEventListener("compositionend", onCompositionEnd);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      disposed = true;
      generation++;
      actions.current = null;
      editor.clear();
      composing.current = false;
      host.style.display = "none";
      document.removeEventListener("input", onInput);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("compositionstart", onCompositionStart);
      document.removeEventListener("compositionend", onCompositionEnd);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [editor, anchor, getTemplates, host, shadow]);

  return {
    ...state, anchor,
    onChoose: useCallback((template: Template) => actions.current?.choose(template), []),
    onActiveChange: useCallback((index: number) => actions.current?.select(index), []),
    onCancel: useCallback(() => actions.current?.cancel(), []),
    onInsert: useCallback((text: string) => actions.current?.insert(text), []),
    isComposing: useCallback(() => composing.current, []),
  };
}
