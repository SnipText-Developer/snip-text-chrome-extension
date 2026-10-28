import { useEffect, useMemo, useRef, useState } from "react";
import type { StartPopupOptions, Template } from "../types";
import { createMiniPopupDom, preventDefault } from "../dom/index";

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
  const dom = useMemo(() => createMiniPopupDom(selector, host), [selector, host]);
  const { editor, popup, events } = dom;
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
    let lastEditor: object | null = null;

    function publish(next: PopupState) {
      current = next;
      setState(next);
    }
    function close() {
      requestId++;
      lastQuery = null;
      composing = false;
      editor.clear();
      popup.hide();
      publish(initialState);
    }
    function cancel() {
      if (current.busy) return;
      if (current.phase === "variables") {
        publish({ ...current.list, autoFocus: true });
        return;
      }
    }
    function reportInvalidEditor() {
      publish({ ...current, error: "작성 창이 변경되었습니다. 예약어를 다시 입력해주세요." });
    }
    async function insert(text: string) {
      if (current.busy) return;
      if (!editor.isInsertionValid()) return reportInvalidEditor();
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
      if (!editor.isConnected()) return reportInvalidEditor();
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
    async function refresh() {
      if (disposed || dismissed || current.busy || current.phase === "variables" || popup.hasFocus()) return;
      const match = editor.findTrigger(composing);
      if (!match) return;
      if (match.query === lastQuery && match.editorId === lastEditor) return;
      lastQuery = match.query;
      lastEditor = match.editorId;
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
      if (!dom.isEditorEvent(event)) return;
      if (current.busy) return;
      if (current.phase === "variables") {
        publish(current.list);
        lastQuery = null;
      }
      dismissed = false;
      void refresh();
    }
    function onCompositionStart(event: Event) {
      if (current.busy || !dom.isEditorEvent(event)) return;
      composing = true;
      lastQuery = null;
      requestId++;
    }
    function onCompositionEnd(event: Event) {
      if (current.busy || !dom.isEditorEvent(event)) return;
      composing = false;
      void refresh();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (current.phase === "closed" || current.busy) return;
      const inPopup = popup.contains(event.target);
      if (!inPopup && !dom.isEditorEvent(event)) return;
      if (event.isComposing || (!inPopup && composing)) return;
      if (event.key === "Escape") {
        preventDefault(event);
        cancel();
        return true;
      }
      // Focused buttons keep native activation; only list arrows are shared.
      if (current.phase !== "list" || !current.templates.length) return;
      if (!inPopup && event.key === "Enter" && !event.shiftKey) {
        preventDefault(event);
        choose(current.templates[current.active]);
        return true;
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const index = inPopup ? popup.getOptionIndex(event.target) : current.active;
        if (index < 0) return;
        preventDefault(event);
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = (index + step + current.templates.length) % current.templates.length;
        select(next);
        if (inPopup) popup.focusOption(next);
        popup.revealOption(next);
        return true;
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (current.phase === "closed" || popup.contains(event.target)) return;
      dismissed = true;
      close();
    }

    return {
      choose, select, cancel, insert,
      subscribe() {
        disposed = false;
        const unsubscribe = events.subscribe({
          input: onInput,
          selectionchange: refresh,
          compositionstart: onCompositionStart,
          compositionend: onCompositionEnd,
          keydown: onKeyDown,
          pointerdown: onPointerDown,
        });
        return () => {
          disposed = true;
          requestId++;
          unsubscribe();
          editor.clear();
          popup.hide();
        };
      },
    };
  }, [dom, editor, popup, events]);

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
    dom,
    onChoose: controller.choose,
    onActiveChange: controller.select,
    onCancel: controller.cancel,
    onInsert: controller.insert,
  };
}
