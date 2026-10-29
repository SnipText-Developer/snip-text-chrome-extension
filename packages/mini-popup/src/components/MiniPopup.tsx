import { useLayoutEffect, useRef, useState } from "react";
import { ToneMenu } from "./ToneMenu";
import { toneCommand } from "../commands";
import { TemplateList } from "./TemplateList";
import { TemplateVariablesForm } from "./TemplateVariablesForm";
import { useMiniPopup } from "../hooks/useMiniPopup";
import { usePopupPosition } from "../hooks/usePopupPosition";
import fontStyles from "pretendard/dist/web/variable/pretendardvariable.css?inline";
import normalize from "../styles/normalize.css?inline";
import common from "../styles/common.css?inline";
import styles from "./MiniPopup.css?inline";

import { preserveEditorSelection } from "../dom/index";
import type { StartPopupOptions } from "../types";

interface Props extends StartPopupOptions {
  host: HTMLElement;
}

export function MiniPopup({ selector, getTemplates, insertText, correctTone, getEditorText, host }: Props) {
  const popup = useRef<HTMLDivElement>(null);
  const state = useMiniPopup(selector, getTemplates, insertText, host, correctTone, getEditorText);
  // Keep the last content mounted so the host can finish its closing transition.
  const [lastOpenState, setLastOpenState] = useState<typeof state | null>(null);
  if (state.open && lastOpenState !== state) setLastOpenState(state);
  const view = state.open ? state : lastOpenState;
  usePopupPosition(state.dom, popup, state.open);
  useLayoutEffect(() => {
    if (state.choosingTone) state.dom.popup.focusOption(0);
  }, [state.choosingTone, state.dom]);
  const selected = view?.selectedTemplate;

  return (
    <>
      <style>{fontStyles + normalize + common + styles}</style>
      {view && (
        <div
          ref={popup}
          className="popup-group"
          onMouseDown={preserveEditorSelection}>
          {view.choosingTone && (
            <div className="popup tone-command-card">
              <div className="tone-command-row">
                <strong>{toneCommand.shortcut}</strong><span>{toneCommand.content}</span><span aria-hidden="true">&gt;</span>
              </div>
            </div>
          )}
          <div className={view.choosingTone ? "popup tone-menu" : selected ? "popup variable-entry" : "popup"}>
          <header hidden={view.choosingTone}>{selected ? `${selected.shortcut} 변수 입력` : "템플릿"}</header>
          {selected ? (
            <TemplateVariablesForm
              key={selected.templateId}
              template={selected}
              busy={state.open && view.busy}
              onCancel={view.onCancel}
              onInsert={view.onInsert}
            />
          ) : view.choosingTone ? (
            <ToneMenu options={view.templates} active={view.active} busy={state.open && view.busy} onChoose={view.onChoose} onActiveChange={view.onActiveChange} />
          ) : <TemplateList {...view} />}
          {view.error && <p className="popup-notice" role="status">{view.error}</p>}
          <footer hidden={!selected} className={selected ? "variables-footer" : undefined}>
            {selected ? "변수 입력 후 삽입 · Esc 취소" : null}
          </footer>
          </div>
        </div>
      )}
    </>
  );
}
