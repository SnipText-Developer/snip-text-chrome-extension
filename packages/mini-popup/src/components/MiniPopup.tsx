import { useRef } from "react";
import { TemplateList } from "./TemplateList";
import { TemplateVariablesForm } from "./TemplateVariablesForm";
import { useMiniPopup } from "../hooks/useMiniPopup";
import { usePopupPosition } from "../hooks/usePopupPosition";
import normalize from "../styles/normalize.css?inline";
import common from "../styles/common.css?inline";
import styles from "./MiniPopup.css?inline";

import type { StartPopupOptions } from "../types";

interface Props extends StartPopupOptions {
  host: HTMLElement;
}

export function MiniPopup({ selector, getTemplates, insertText, host }: Props) {
  const popup = useRef<HTMLDivElement>(null);
  const state = useMiniPopup(selector, getTemplates, insertText, host);
  usePopupPosition(host, popup, state.anchor, state.open);
  const selected = state.selectedTemplate;

  return (
    <>
      <style>{normalize + common + styles}</style>
      {state.open && (
        <div
          ref={popup}
          className={selected ? "popup variable-entry" : "popup"}
          onMouseDown={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest("input, button, label, textarea, select, a")) return;
            // Keep the editor selection when clicking popup padding or headings.
            event.preventDefault();
          }}>
          <header>{selected ? `${selected.shortcut} 변수 입력` : "템플릿"}</header>
          {selected ? (
            <TemplateVariablesForm
              key={selected.templateId}
              template={selected}
              busy={state.busy}
              onCancel={state.onCancel}
              onInsert={state.onInsert}
            />
          ) : <TemplateList {...state} />}
          {state.error && <p role="status">{state.error}</p>}
          <footer hidden={!selected} className={selected ? "variables-footer" : undefined}>
            {selected ? "변수 입력 후 삽입 · Esc 취소" : null}
          </footer>
        </div>
      )}
    </>
  );
}
