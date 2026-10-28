import { useEffect, useMemo, useRef, useState } from "react";
import type { StartPopupOptions, Template } from "../types";
import { useEditor } from "./useEditor";
import { focusPopupOption, getPopupOptionIndex, hidePopup, revealPopupOption } from "../dom/popup";

interface ListState {
  phase: "list";
  templates: Template[];
  active: number;
  autoFocus?: boolean;
}

type PopupState = (
  | { phase: "closed" | "loading" | "error"; message?: string }
  | ListState
  | { phase: "variables"; template: Template; list: ListState }
) & { busy?: boolean; error?: string };

const initialState: PopupState = { phase: "closed" };

export function useMiniPopup(selector: string, getTemplates: StartPopupOptions["getTemplates"], insertText: StartPopupOptions["insertText"], host: HTMLElement) {
  const [state, setState] = useState(initialState);
  const editor = useEditor(selector);
  const loader = useRef(getTemplates);
  loader.current = getTemplates;
  const inserter = useRef(insertText);
  inserter.current = insertText;

  const controller = useMemo(() => {
    let current: PopupState = initialState;
    let requestId = 0;
    let disposed = false;
    let dismissed = false;
    let composing = false;
    let lastQuery: string | null = null;
    let lastEditor: HTMLElement | null = null;

    function publish(next: PopupState) {
      current = next;
      setState(next);
    }
    function close() {
      requestId++;
      lastQuery = null;
      composing = false;
      editor.clear();
      hidePopup(host);
      publish(initialState);
    }
    function cancel() {
      if (current.busy) return;
      if (current.phase === "variables") {
        publish({ ...current.list, autoFocus: true });
        return;
      }
      dismissed = true;
      editor.restoreFocus(close);
    }
    async function insert(text: string) {
      if (current.busy) return;
      if (!editor.isInsertionValid()) return close();
      const id = ++requestId;
      publish({ ...current, busy: true, error: undefined });
      try {
        await inserter.current(text);
        if (!disposed && id === requestId) {
          dismissed = true;
          close();
        }
      } catch {
        if (!disposed && id === requestId) {
          publish({ ...current, busy: false, error: "삽입하지 못했습니다. 다시 시도해주세요." });
        }
      }
    }
    function choose(template: Template) {
      if (current.phase !== "list" || current.busy) return;
      if (!editor.anchor.current?.editor.isConnected) return close();
      requestId++;
      lastQuery = null;
      if (!template.variables.length) return insert(template.content);
      publish({ phase: "variables", template, list: current });
    }
    function select(index: number) {
      if (current.phase === "list" && index >= 0 && index < current.templates.length) {
        publish({ ...current, active: index });
      }
    }
    function isEditorEvent(event: Event) {
      return event.target instanceof Element &&
        !host.contains(event.target) && event.target.closest(selector) !== null;
    }
    async function refresh() {
      if (disposed || dismissed || current.busy || current.phase === "variables" || host.contains(document.activeElement)) return;
      const match = editor.findTrigger(composing);
      if (!match) {
        if (!composing) close();
        return;
      }
      if (match.query === lastQuery && match.editor === lastEditor) return;
      lastQuery = match.query;
      lastEditor = match.editor;
      const id = ++requestId;
      publish({ phase: "loading", message: "템플릿 불러오는 중…" });
      try {
        const result = await loader.current();
        if (disposed || id !== requestId) return;
        if (!Array.isArray(result)) throw new Error("Invalid template list");
        const templates = result.filter((template) =>
          `${template.title} ${template.shortcut} ${template.content}`
            .normalize("NFC").toLocaleLowerCase().includes(match.query),
        );
        publish({ phase: "list", templates, active: 0 });
      } catch {
        if (disposed || id !== requestId) return;
        lastQuery = null;
        publish({ phase: "error", message: "템플릿을 불러오지 못했습니다. 다시 입력해주세요." });
      }
    }
    function onInput(event: Event) {
      if (!isEditorEvent(event)) return;
      dismissed = false;
      void refresh();
    }
    function onCompositionStart(event: Event) {
      if (current.busy || !isEditorEvent(event)) return;
      composing = true;
      lastQuery = null;
      requestId++;
    }
    function onCompositionEnd(event: Event) {
      if (current.busy || !isEditorEvent(event)) return;
      composing = false;
      void refresh();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (current.phase === "closed" || current.busy) return;
      const inPopup = event.target instanceof Node && host.contains(event.target);
      if (!inPopup && !isEditorEvent(event)) return;
      if (event.isComposing || (!inPopup && composing)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        // The popup consumes Escape; do not let the mail page dismiss it too.
        event.stopPropagation();
        cancel();
        return;
      }
      // Focused buttons keep native activation; only list arrows are shared.
      if (current.phase !== "list" || !current.templates.length) return;
      if (!inPopup && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        choose(current.templates[current.active]);
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const index = inPopup ? getPopupOptionIndex(host, event.target) : current.active;
        if (index < 0) return;
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = (index + step + current.templates.length) % current.templates.length;
        select(next);
        if (inPopup) focusPopupOption(host, next);
        revealPopupOption(host, next);
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (current.phase === "closed" || current.busy || (event.target instanceof Node && host.contains(event.target))) return;
      dismissed = true;
      close();
    }
    function onFocusIn(event: FocusEvent) {
      const target = event.target;
      if (current.phase === "closed" || current.busy || !(target instanceof Node) ||
        host.contains(target) || editor.anchor.current?.editor.contains(target)) return;
      dismissed = true;
      close();
    }

    return {
      choose, select, cancel, insert,
      subscribe() {
        disposed = false;
        const listeners = new AbortController();
        const { signal } = listeners;
        document.addEventListener("input", onInput, { signal });
        document.addEventListener("selectionchange", refresh, { signal });
        document.addEventListener("compositionstart", onCompositionStart, { signal });
        document.addEventListener("compositionend", onCompositionEnd, { signal });
        // Mail editors may stop key events before they bubble to document.
        window.addEventListener("keydown", onKeyDown, { capture: true, signal });
        document.addEventListener("pointerdown", onPointerDown, { signal });
        document.addEventListener("focusin", onFocusIn, { signal });
        return () => {
          disposed = true;
          requestId++;
          listeners.abort();
          editor.clear();
          hidePopup(host);
        };
      },
    };
  }, [editor, host, selector]);

  useEffect(() => controller.subscribe(), [controller]);

  return {
    busy: state.busy,
    error: state.error,
    templates: state.phase === "list" ? state.templates : [],
    active: state.phase === "list" ? state.active : 0,
    autoFocus: state.phase === "list" && state.autoFocus,
    selectedTemplate: state.phase === "variables" ? state.template : null,
    message: "message" in state ? state.message : undefined,
    open: state.phase !== "closed",
    anchor: editor.anchor,
    onChoose: controller.choose,
    onActiveChange: controller.select,
    onCancel: controller.cancel,
    onInsert: controller.insert,
  };
}
