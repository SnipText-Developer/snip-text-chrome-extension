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

export function MiniPopup({ selector, getTemplates, insertText, correctTone, getEditorText, newTemplateUrl, loginUrl, host }: Props) {
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
            {view.loginRequired ? (
              <header className="login-intro">
                <div className="login-logo" aria-hidden="true">S</div>
                <h2>저장한 문장, 간편하게 쓰세요</h2>
                <p>저장한 템플릿을<br />웹 입력창에서 단축어로 불러올 수 있어요</p>
              </header>
            ) : (
              <header>{view.choosingTone ? "문체 선택" : selected ? "변수 입력" : view.searching ? "검색 결과" : "최근 사용"}</header>
            )}
            {view.loginRequired ? (
              loginUrl && (
                <a className="login-button" href={loginUrl} target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
                    <path fill="#4285f4" d="M43.6 24.5c0-1.4-.1-2.7-.4-4H24v7.6h11a9.4 9.4 0 0 1-4.1 6.1v5h6.5c3.8-3.5 6.2-8.6 6.2-14.7Z" />
                    <path fill="#34a853" d="M24 44c5.5 0 10.1-1.8 13.4-4.8l-6.5-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.9v5.2A20 20 0 0 0 24 44Z" />
                    <path fill="#fbbc05" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.9a20 20 0 0 0 0 18l6.7-5.2Z" />
                    <path fill="#ea4335" d="M24 11.8c3 0 5.6 1 7.7 3l5.8-5.8A19.2 19.2 0 0 0 24 4 20 20 0 0 0 5.9 15l6.7 5.2c1.6-4.8 6.1-8.4 11.4-8.4Z" />
                  </svg>
                  Google 로그인
                </a>
              )
            ) : selected ? (
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
            {!view.loginRequired && !selected && !view.choosingTone && (
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
