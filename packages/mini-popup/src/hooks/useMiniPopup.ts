import { useEffect, useMemo, useRef, useState } from "react";
import { toneCommand, toneOptions } from "../commands";
import type { StartPopupOptions, Template } from "../types";
import { createMiniPopupDom, preventDefault } from "../dom/index";

interface ListState {
  phase: "list" | "tones";
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

export function useMiniPopup(selector: string, getTemplates: StartPopupOptions["getTemplates"], insertText: StartPopupOptions["insertText"], host: HTMLElement, correctTone?: StartPopupOptions["correctTone"], getEditorText?: StartPopupOptions["getEditorText"]) {
  const [state, setState] = useState(initialState);
  const dom = useMemo(() => createMiniPopupDom(selector, host), [selector, host]);
  const { editor, popup, events } = dom;
  const loader = useRef(getTemplates);
  loader.current = getTemplates;
  const inserter = useRef(insertText);
  inserter.current = insertText;
  const corrector = useRef(correctTone);
  corrector.current = correctTone;
  const reader = useRef(getEditorText);
  reader.current = getEditorText;

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
    async function correct(tone: string) {
      if (current.busy) return;
      if (!editor.isInsertionValid()) return reportInvalidEditor();
      const id = ++requestId;
      publish({ ...current, busy: true, error: undefined });
      try {
        if (!reader.current) throw new Error("본문 조회 API가 연결되지 않았습니다.");
        const original = await reader.current();
        if (disposed || id !== requestId) return;
        if (!corrector.current) throw new Error("톤 교정 요청이 연결되지 않았습니다.");
        const text = await corrector.current(tone);
        if (disposed || id !== requestId) return;
        const latestText = await reader.current();
        if (disposed || id !== requestId) return;
        if (!editor.isInsertionValid() || latestText !== original) {
          publish({ ...current, busy: false });
          return reportInvalidEditor();
        }
        await inserter.current(text);
        if (!disposed && id === requestId) { dismissed = true; close(); }
      } catch (error) {
        if (!disposed && id === requestId) publish({ ...current, busy: false, error: error instanceof Error ? error.message : "톤 교정 요청에 실패했습니다." });
      }
    }
    function choose(template: Template) {
      if (current.busy) return;
      if (current.phase === "tones") return void correct(template.title);
      if (current.phase !== "list") return;
      if (!editor.isInsertionValid()) return reportInvalidEditor();
      requestId++;
      lastQuery = null;
      if (template.templateId === toneCommand.templateId) {
        publish({ phase: "tones", templates: toneOptions, active: 0, autoFocus: true });
        return;
      }
      if (!template.variables.length) return insert(template.content);
      publish({ phase: "variables", template, list: current });
    }
    function select(index: number) {
      if ((current.phase === "list" || current.phase === "tones") && index >= 0 && index < current.templates.length) {
        publish({ ...current, active: index });
      }
    }
    async function refresh(fromInput = false) {
      if (disposed || dismissed || current.busy || (current.phase === "variables" || current.phase === "tones") || popup.hasFocus()) return;
      const match = editor.findTrigger(composing);
      if (!match) {
        if (fromInput && !composing) close();
        return;
      }
      if (match.query === lastQuery && match.editorId === lastEditor) return;
      lastQuery = match.query;
      lastEditor = match.editorId;
      const id = ++requestId;
      if (corrector.current && match.query && "톤교정".startsWith(match.query)) {
        publish({ phase: "list", templates: [toneCommand], active: 0 });
        return;
      }
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
      if (!editor.hasSlash(event.target)) return close();
      if (current.busy) return;
      if (current.phase === "variables") {
        publish(current.list);
        lastQuery = null;
      } else if (current.phase === "tones") {
        publish({ phase: "list", templates: [], active: 0 });
        lastQuery = null;
      }
      dismissed = false;
      void refresh(true);
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
      onInput(event);
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
      if ((current.phase !== "list" && current.phase !== "tones") || !current.templates.length) return;
      if ((!inPopup || current.phase === "tones") && event.key === "Enter" && !event.shiftKey) {
        preventDefault(event);
        const focusedIndex = inPopup ? popup.getOptionIndex(event.target) : -1;
        const index = focusedIndex >= 0 ? focusedIndex : current.active;
        if (!event.repeat) choose(current.templates[index]);
        return true;
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const focusedIndex = inPopup ? popup.getOptionIndex(event.target) : -1;
        const index = focusedIndex >= 0 ? focusedIndex : current.active;
        preventDefault(event);
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = (index + step + current.templates.length) % current.templates.length;
        select(next);
        if (inPopup || current.phase === "tones") popup.focusOption(next);
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
          selectionchange: () => { void refresh(); },
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
    templates: (state.phase === "list" || state.phase === "tones") ? state.templates : [],
    active: (state.phase === "list" || state.phase === "tones") ? state.active : 0,
    autoFocus: (state.phase === "list" || state.phase === "tones") && state.autoFocus,
    choosingTone: state.phase === "tones",
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
