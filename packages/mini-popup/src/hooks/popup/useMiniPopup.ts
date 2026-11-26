import { useEffect, useMemo, useRef, useState } from "react";
import { toneCommand, toneOptions } from "../../commands";
import type { StartPopupOptions, Template } from "../../types";
import { matchesShortcut } from "../../utils/shortcut-search";
import { LoginRequiredError } from "../../actions";
import { useEditorAnchor } from "../editor/useEditorAnchor";
import { useEditorEvents } from "../editor/useEditorEvents";
import { usePopupFocus } from "./usePopupFocus";
import { usePopupEventIsolation } from "./usePopupEventIsolation";

interface ListState {
  phase: "list";
  templates: Template[];
  active: number;
}

type PopupState = (
  | { phase: "closed" | "loading" | "error"; message?: string }
  | { phase: "login" }
  | ListState
  | { phase: "tones"; templates: Template[]; active: number; list: ListState }
  | { phase: "variables"; template: Template; list: ListState }
) & { busy?: boolean; error?: string; searching?: boolean };

const initialState: PopupState = { phase: "closed" };

export function useMiniPopup(selector: string, getTemplates: StartPopupOptions["getTemplates"], insertText: StartPopupOptions["insertText"], host: HTMLElement, correctTone?: StartPopupOptions["correctTone"], getEditorText?: StartPopupOptions["getEditorText"]) {
  const [state, setState] = useState(initialState);
  const doc = host.ownerDocument;
  const editor = useEditorAnchor(selector, doc);
  const popup = usePopupFocus(host);
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
      publish(initialState);
    }
    function cancel() {
      if (current.busy) return;
      if (current.phase === "variables" || current.phase === "tones") {
        publish(current.list);
        editor.restoreEditorFocus();
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
      } catch (error) {
        if (!disposed && id === requestId) {
          publish({ ...current, busy: false, error: error instanceof Error ? error.message : "삽입하지 못했습니다. 다시 시도해주세요." });
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
        if (disposed || id !== requestId) return;
        if (error instanceof LoginRequiredError) {
          publish({ phase: "login" });
          return;
        }
        publish({ ...current, busy: false, error: error instanceof Error ? error.message : "톤 교정 요청에 실패했습니다." });
      }
    }
    function choose(template: Template) {
      if (current.busy) return;
      if (current.phase === "tones") return void correct(template.title);
      if (current.phase !== "list") return;
      if (!editor.isInsertionValid()) return reportInvalidEditor();
      requestId++;
      if (template.templateId === toneCommand.templateId) {
        publish({ phase: "tones", templates: toneOptions, active: 0, list: current });
        return;
      }
      if (!template.variables.length) {
        lastQuery = null;
        return insert(template.content);
      }
      const selectedIndex = current.templates.findIndex((item) => item.templateId === template.templateId);
      publish({ phase: "variables", template, list: { ...current, active: selectedIndex >= 0 ? selectedIndex : current.active } });
    }
    function select(index: number) {
      if ((current.phase === "list" || current.phase === "tones") && index >= 0 && index < current.templates.length && index !== current.active) {
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
      const searching = match.query.length > 0;
      if (corrector.current && match.query && "톤교정".startsWith(match.query)) {
        publish({ phase: "list", templates: [toneCommand], active: 0, searching: true });
        return;
      }
      publish({ phase: "loading", searching, message: "템플릿 불러오는 중…" });
      try {
        const result = await loader.current();
        if (disposed || id !== requestId) return;
        if (!Array.isArray(result)) throw new Error("Invalid template list");
        const templates = searching ? result.filter((template) =>
          matchesShortcut(template.shortcut, match.query),
        ) : [...result].sort((a, b) => (Date.parse(b.lastUsedAt) || 0) - (Date.parse(a.lastUsedAt) || 0));
        templates.reverse();
        publish({ phase: "list", templates, active: searching ? 0 : -1, searching });
      } catch (error) {
        if (disposed || id !== requestId) return;
        if (error instanceof LoginRequiredError) {
          publish({ phase: "login" });
          return;
        }
        lastQuery = null;
        publish({ phase: "error", searching, message: "템플릿을 불러오지 못했습니다. 다시 입력해주세요." });
      }
    }
    function isEditorEvent(event: Event) {
      return !popup.contains(event.target) && editor.matches(event.target);
    }
    function onInput(event: Event) {
      if (!isEditorEvent(event)) return;
      if (!editor.hasTrigger(event.target)) return close();
      if (current.busy) return;
      if (current.phase === "variables") {
        publish(current.list);
        lastQuery = null;
      } else if (current.phase === "tones") {
        publish({ phase: "list", templates: [], active: 0 });
        lastQuery = null;
      }
      dismissed = false;
      if (current.phase === "login") lastQuery = null;
      void refresh(true);
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
      onInput(event);
    }
    function onPointerDown(event: PointerEvent) {
      if (current.phase === "closed" || popup.contains(event.target)) return;
      dismissed = true;
      close();
    }

    return {
      choose, select, cancel, insert,
      isOpen: () => current.phase !== "closed",
      editorHandlers: {
        input: onInput,
        selectionchange: () => { void refresh(); },
        compositionstart: onCompositionStart,
        compositionend: onCompositionEnd,
        pointerdown: onPointerDown,
      },
      activate() {
        disposed = false;
        return () => {
          disposed = true;
          requestId++;
          editor.clear();
        };
      },
    };
  }, [editor, popup]);

  useEffect(() => controller.activate(), [controller]);
  const { popupEventProps, connectKeyboard } = usePopupEventIsolation(host, editor.matches, controller.isOpen);
  useEditorEvents(doc, controller.editorHandlers);

  return useMemo(() => ({
    busy: state.busy,
    searching: state.searching ?? false,
    error: state.error,
    templates: (state.phase === "list" || state.phase === "tones") ? state.templates : [],
    active: (state.phase === "list" || state.phase === "tones") ? state.active : 0,
    choosingTone: state.phase === "tones",
    loginRequired: state.phase === "login",
    selectedTemplate: state.phase === "variables" ? state.template : null,
    message: "message" in state ? state.message : undefined,
    open: state.phase !== "closed",
    getEditorBounds: editor.getBounds,
    popupEventProps,
    connectKeyboard,
    onChoose: controller.choose,
    onActiveChange: controller.select,
    onCancel: controller.cancel,
    onInsert: controller.insert,
  }), [state, editor, controller, popupEventProps, connectKeyboard]);
}
