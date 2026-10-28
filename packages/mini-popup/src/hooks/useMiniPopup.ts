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

function matchesQuery(template: Template, query: string) {
  const searchableText = `${template.title} ${template.shortcut} ${template.content}`;
  return searchableText.normalize("NFC").toLocaleLowerCase().includes(query);
}

function consumeKey(event: KeyboardEvent) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

interface Actions {
  choose: (template: Template) => void;
  select: (index: number) => void;
  cancel: () => void;
  insert: (text: string) => void;
}

export function useMiniPopup(selector: string, getTemplates: StartPopupOptions["getTemplates"], host: HTMLElement, shadow: ShadowRoot) {
  const [state, setState] = useState(initialState);
  // Native key events may arrive within the same React batch.
  const currentState = useRef(state);
  const editor = useEditor(selector);
  const { anchor } = editor;
  const composing = useRef(false);
  const actions = useRef<Actions | null>(null);

  useEffect(() => {
    let requestVersion = 0;
    let disposed = false;
    let dismissed = false;
    let pendingEnter = false;
    function setPopupState(next: PopupState) {
      currentState.current = next;
      setState(next);
    }
    function close() {
      pendingEnter = false;
      requestVersion++;
      editor.clear();
      host.style.display = "none";
      setPopupState(initialState);
    }
    function insert(text: string) {
      if (!editor.insertText(text, close)) close();
    }

    function choose(template: Template) {
      pendingEnter = false;
      requestVersion++;
      if (!anchor.current?.editor.isConnected) return close();
      if (!template.variables.length) return insert(template.content);
      setPopupState({ ...currentState.current, selectedTemplate: template });
    }
    function select(index: number) {
      setPopupState({ ...currentState.current, active: index });
    }
    function cancel() {
      dismissed = true;
      editor.restoreFocus(close);
    }

    async function updateTemplates() {
      if (disposed || dismissed || currentState.current.selectedTemplate || document.activeElement === host) return;
      const match = editor.findTrigger(composing.current);
      // Selection can be temporarily unavailable while the IME updates the DOM.
      if (!match) {
        if (!composing.current) close();
        return;
      }
      const request = ++requestVersion;
      setPopupState({ ...initialState, open: true, message: "템플릿 불러오는 중…" });
      try {
        const result = await getTemplates();
        if (disposed || request !== requestVersion) return;
        if (!Array.isArray(result)) throw new Error("Invalid template list");
        const templates = result.filter((template) => matchesQuery(template, match.query));
        setPopupState({ ...initialState, open: true, templates });
        if (pendingEnter && !composing.current) {
          pendingEnter = false;
          if (templates.length) choose(templates[0]);
        }
      } catch {
        if (disposed || request !== requestVersion) return;
        pendingEnter = false;
        setPopupState({ ...currentState.current, message: "템플릿을 불러오지 못했습니다. 다시 입력해주세요." });
      }
    }
    function onInput() {
      dismissed = false;
      void updateTemplates();
    }
    function onCompositionStart() {
      composing.current = true;
      // Keep the list and anchor while the IME temporarily changes selection.
      // Ignore responses requested before composition started.
      requestVersion++;
    }
    function onCompositionEnd() {
      composing.current = false;
      void updateTemplates();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (!anchor.current) return;

      const snapshot = currentState.current;
      const isConfirmKey = event.key === "Enter" && !event.shiftKey;
      const isCompositionKey = composing.current || event.isComposing;

      if (isCompositionKey) {
        if (!snapshot.selectedTemplate && isConfirmKey) {
          pendingEnter = true;
          // Keep the default action so the IME can commit the final syllable.
          event.stopImmediatePropagation();
          if (!composing.current && !event.isComposing) void updateTemplates();
        }
        return;
      }

      if (event.key === "Escape") {
        consumeKey(event);
        if (snapshot.selectedTemplate) cancel();
        else {
          dismissed = true;
          close();
        }
        return;
      }
      if (snapshot.selectedTemplate) return;
      if (!snapshot.templates.length) {
        if (isConfirmKey && snapshot.message === "템플릿 불러오는 중…") {
          consumeKey(event);
          pendingEnter = true;
        }
        return;
      }

      switch (event.key) {
        case "ArrowDown":
        case "ArrowUp": {
          consumeKey(event);
          const direction = event.key === "ArrowDown" ? 1 : -1;
          const count = snapshot.templates.length;
          select((snapshot.active + direction + count) % count);
          break;
        }
        case "Enter":
          if (!isConfirmKey) return;
          consumeKey(event);
          choose(snapshot.templates[snapshot.active]);
          break;
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
    document.addEventListener("selectionchange", updateTemplates);
    document.addEventListener("compositionstart", onCompositionStart);
    document.addEventListener("compositionend", onCompositionEnd);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      disposed = true;
      requestVersion++;
      actions.current = null;
      editor.clear();
      composing.current = false;
      host.style.display = "none";
      document.removeEventListener("input", onInput);
      document.removeEventListener("selectionchange", updateTemplates);
      document.removeEventListener("compositionstart", onCompositionStart);
      document.removeEventListener("compositionend", onCompositionEnd);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [editor, anchor, getTemplates, host, shadow]);

  return {
    ...state,
    anchor,
    onChoose: useCallback((template: Template) => actions.current?.choose(template), []),
    onActiveChange: useCallback((index: number) => actions.current?.select(index), []),
    onCancel: useCallback(() => actions.current?.cancel(), []),
    onInsert: useCallback((text: string) => actions.current?.insert(text), []),
    isComposing: useCallback(() => composing.current, []),
  };
}
