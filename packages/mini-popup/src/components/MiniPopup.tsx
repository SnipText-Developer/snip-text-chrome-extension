import { LoginRequired } from "./LoginRequired";
import { ToneMenu } from "./ToneMenu";
import { toneCommand } from "../commands";
import { TemplateList } from "./TemplateList";
import { TemplateVariablesForm } from "./TemplateVariablesForm";
import { useMiniPopup } from "../hooks/popup/useMiniPopup";
import { usePopupPresentation } from "../hooks/popup/usePopupPresentation";
import normalize from "../styles/normalize.css?inline";
import common from "../styles/common.css?inline";
import styles from "./MiniPopup.css?inline";
import listStyles from "./TemplateList.css?inline";

import type { StartPopupOptions } from "../types";

interface Props extends StartPopupOptions {
  host: HTMLElement;
}

export function MiniPopup({ selector, getTemplates, insertText, correctTone, getEditorText, newTemplateUrl, googleLogoUrl, logoUrl, loginUrl, host }: Props) {
  const state = useMiniPopup(selector, getTemplates, insertText, host, correctTone, getEditorText);
  const { view, panelProps } = usePopupPresentation(state);
  const selected = view?.selectedTemplate;

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/pretendard/1.3.9/static/pretendard.min.css"
        crossOrigin="anonymous"
      />
      <style>{normalize + common + styles + listStyles}</style>
      {view && (
        <div className="popup-group" {...panelProps} {...state.popupEventProps}>
          <div className={view.choosingTone ? "popup tone-menu" : selected ? "popup variable-entry" : "popup"}>
            {view.choosingTone && (
              <div className="tone-command-row">
                <strong className="template-command">{toneCommand.shortcut}</strong>
                <span className="template-text">작성한 문장의 문체를 다듬어요.</span>
              </div>
            )}
            {view.loginRequired ? (
              <LoginRequired googleLogoUrl={googleLogoUrl} logoUrl={logoUrl} loginUrl={loginUrl} />
            ) : (
              <>
                <header>{view.choosingTone ? "문체 선택" : selected ? "변수 입력" : view.searching ? "검색 결과" : "최근 사용"}</header>
                {selected ? (
                  <TemplateVariablesForm
                    connectKeyboard={state.connectKeyboard}
                    enabled={state.open}
                    key={selected.templateId}
                    template={selected}
                    busy={state.open && view.busy}
                    onCancel={view.onCancel}
                    onInsert={view.onInsert}
                  />
                ) : view.choosingTone ? (
                  <ToneMenu connectKeyboard={state.connectKeyboard} enabled={state.open} options={view.templates} active={view.active} busy={state.open && view.busy} onChoose={view.onChoose} onCancel={view.onCancel} onActiveChange={view.onActiveChange} />
                ) : <TemplateList {...view} connectKeyboard={state.connectKeyboard} enabled={state.open} busy={state.open && view.busy} />}
              </>
            )}
            {view.error && <p className="popup-notice" role="status">{view.error}</p>}
            {!view.loginRequired && !selected && (
              <footer className="popup-footer">
                <span>{view.choosingTone ? "↑↓←→ 이동 · Enter 선택 · Esc 뒤로" : "↑↓ 이동 · Enter 선택"}</span>
                {!view.choosingTone && !view.searching && newTemplateUrl && (
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
