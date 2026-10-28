import { useLayoutEffect, useRef } from "react";
import { ToneMenu } from "./ToneMenu";
import { toneCommand } from "../commands";
import { TemplateList } from "./TemplateList";
import { TemplateVariablesForm } from "./TemplateVariablesForm";
import { useMiniPopup } from "../hooks/useMiniPopup";
import { usePopupPosition } from "../hooks/usePopupPosition";
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
  usePopupPosition(state.dom, popup, state.open);
  useLayoutEffect(() => {
    if (state.choosingTone) state.dom.popup.focusOption(0);
  }, [state.choosingTone, state.dom]);
  const selected = state.selectedTemplate;

  return (
    <>
      <style>{normalize + common + styles}</style>
      {state.open && (
        <div
          ref={popup}
          className="popup-group"
          onMouseDown={preserveEditorSelection}>
          {state.choosingTone && (
            <div className="popup tone-command-card">
              <div className="tone-command-row">
                <strong>{toneCommand.shortcut}</strong><span>{toneCommand.content}</span><span aria-hidden="true">&gt;</span>
              </div>
            </div>
          )}
          <div className={state.choosingTone ? "popup tone-menu" : selected ? "popup variable-entry" : "popup"}>
          <header hidden={state.choosingTone}>{selected ? `${selected.shortcut} 변수 입력` : "템플릿"}</header>
          {selected ? (
            <TemplateVariablesForm
              key={selected.templateId}
              template={selected}
              busy={state.busy}
              onCancel={state.onCancel}
              onInsert={state.onInsert}
            />
          ) : state.choosingTone ? (
            <ToneMenu options={state.templates} active={state.active} busy={state.busy} onChoose={state.onChoose} onActiveChange={state.onActiveChange} />
          ) : <TemplateList {...state} />}
          {state.error && <p className="popup-notice" role="status">{state.error}</p>}
          <footer hidden={!selected} className={selected ? "variables-footer" : undefined}>
            {selected ? "변수 입력 후 삽입 · Esc 취소" : null}
          </footer>
          </div>
        </div>
      )}
    </>
  );
}
