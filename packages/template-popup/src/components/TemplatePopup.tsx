import { useRef } from "react";
import { TemplateList } from "./TemplateList";
import { TemplateVariablesForm } from "./TemplateVariablesForm";
import { useTemplatePopup } from "../hooks/useTemplatePopup";
import { usePopupPosition } from "../hooks/usePopupPosition";
import styles from "../styles/popup.css?inline";

import type { StartPopupOptions } from "../types";

interface Props extends StartPopupOptions {
  host: HTMLElement;
  shadow: ShadowRoot;
}

export function TemplatePopup({ selector, getTemplates, host, shadow }: Props) {
  const popup = useRef<HTMLDivElement>(null);
  const state = useTemplatePopup(selector, getTemplates, host, shadow);
  usePopupPosition(host, popup, state.anchor, state.open);
  const selected = state.selectedTemplate;

  return (
    <>
      <style>{styles}</style>
      {state.open && (
        <div
          ref={popup}
          className={selected ? "popup variable-entry" : "popup"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if (!(event.target instanceof Element) || !event.target.closest("input, button")) {
              event.preventDefault();
            }
          }}
          onMouseDown={(event) => {
            event.stopPropagation();
            const target = event.target;
            if (!(target instanceof Element)) {
              event.preventDefault();
              return;
            }
            if (target.closest("input")) return;

            // Prevent text selection and native label clicks from moving focus
            // outside the popup before the click handler runs.
            event.preventDefault();
          }}
          onKeyDown={(event) => event.stopPropagation()}
          onKeyPress={(event) => event.stopPropagation()}
          onKeyUp={(event) => event.stopPropagation()}>
          <header>{selected ? `${selected.shortcut} 변수 입력` : "템플릿"}</header>
          {selected ? (
            <TemplateVariablesForm
              key={selected.templateId}
              template={selected}
              onCancel={state.onCancel}
              onInsert={state.onInsert}
              isComposing={state.isComposing}
            />
          ) : <TemplateList {...state} />}
          <footer hidden={!selected} className={selected ? "variables-footer" : undefined}>
            {selected ? "변수 입력 후 삽입 · Esc 취소" : null}
          </footer>
        </div>
      )}
    </>
  );
}
