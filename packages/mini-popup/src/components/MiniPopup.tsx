import { useLayoutEffect, useRef, useState } from "react";
import { ToneMenu } from "./ToneMenu";
import { toneCommand } from "../commands";
import { TemplateList } from "./TemplateList";
import { TemplateVariablesForm } from "./TemplateVariablesForm";
import { useMiniPopup } from "../hooks/useMiniPopup";
import { usePopupPosition } from "../hooks/usePopupPosition";
import normalize from "../styles/normalize.css?inline";
import common from "../styles/common.css?inline";
import styles from "./MiniPopup.css?inline";
import listStyles from "./TemplateList.css?inline";

import { preserveEditorSelection } from "../dom/index";
import type { StartPopupOptions } from "../types";

interface Props extends StartPopupOptions {
  host: HTMLElement;
}

export function MiniPopup({ selector, getTemplates, insertText, correctTone, getEditorText, newTemplateUrl, host }: Props) {
  const popup = useRef<HTMLDivElement>(null);
  const state = useMiniPopup(selector, getTemplates, insertText, host, correctTone, getEditorText);
  // Retain the last content while CSS transitions display to none.
  const [lastOpenState, setLastOpenState] = useState<typeof state | null>(null);
  useLayoutEffect(() => {
    if (state.open) setLastOpenState(state);
  }, [state]);
  const view = state.open ? state : lastOpenState;
  usePopupPosition(state.dom, popup, state.open);
  const selected = view?.selectedTemplate;

  return (
    <>
      <style>{normalize + common + styles + listStyles}</style>
      {view && (
        <div
          ref={popup}
          className="popup-group"
          onMouseDown={preserveEditorSelection}>
          <div className={view.choosingTone ? "popup tone-menu" : selected ? "popup variable-entry" : "popup"}>
            {view.choosingTone && (
              <div className="tone-command-row">
                <strong className="template-command">{toneCommand.shortcut}</strong>
                <span className="template-text">작성한 문장의 문체를 다듬어요.</span>
              </div>
            )}
            <header>{view.choosingTone ? "문체 선택" : selected ? "변수 입력" : view.searching ? "검색 결과" : "최근 사용"}</header>
            {selected ? (
              <TemplateVariablesForm
                dom={state.dom}
                enabled={state.open}
                key={selected.templateId}
                template={selected}
                busy={state.open && view.busy}
                onCancel={view.onCancel}
                onInsert={view.onInsert}
              />
            ) : view.choosingTone ? (
              <ToneMenu dom={state.dom} enabled={state.open} options={view.templates} active={view.active} busy={state.open && view.busy} onChoose={view.onChoose} onActiveChange={view.onActiveChange} />
            ) : <TemplateList {...view} dom={state.dom} enabled={state.open} busy={state.open && view.busy} />}
            {view.error && <p className="popup-notice" role="status">{view.error}</p>}
            {!selected && !view.choosingTone && (
              <footer className="popup-footer">
                <span>↑↓ 이동 · Enter 선택</span>
                {!view.searching && newTemplateUrl && (
                  <a href={newTemplateUrl} target="_blank" rel="noopener noreferrer">+ 단축어 추가하기</a>
                )}
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  );
}
