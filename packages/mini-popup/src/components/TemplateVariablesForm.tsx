import styles from "./TemplateVariablesForm.css?inline";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { focusVariableInput, preventDefault, type MiniPopupDom } from "../dom/index";
import type { Template } from "../types";
import { useTemplateContent } from "../hooks/useTemplateContent";

interface Props {
  dom: MiniPopupDom;
  enabled: boolean;
  template: Template;
  busy?: boolean;
  onCancel: () => void;
  onInsert: (text: string) => void;
}

const examples: Record<string, string> = { 날짜: "예: 11월 25일", 시간: "예: 오후 2시" };

export function TemplateVariablesForm({ dom, enabled, template, busy, onCancel, onInsert }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(template.variables.map((name) => [name, ""])),
  );
  const [invalidVariable, setInvalidVariable] = useState<string>();
  const errorId = useId();
  const content = useTemplateContent(template.content, values);
  const composing = useRef(false);
  const root = useRef<HTMLFormElement>(null);
  const handlers = useRef({ busy, onCancel });
  handlers.current = { busy, onCancel };
  useLayoutEffect(() => {
    if (enabled && root.current) return dom.connectTemplateInput(root.current, () => handlers.current);
  }, [dom, enabled]);

  return (
    <>
      <style>{styles}</style>
      <form
        ref={root}
        noValidate
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; }}
        onSubmit={(event) => {
          preventDefault(event);
          if (composing.current || busy) return;
          const missing = template.variables.find((variable) => !values[variable]?.trim());
          if (missing !== undefined) {
            setInvalidVariable(missing);
            focusVariableInput(root.current, missing);
            return;
          }
          onInsert(content);
        }}>
        <div className="list variables">
          <div className="fields">
            {template.variables.map((variable) => {
              const invalid = variable === invalidVariable;
              return (
                <label key={variable}>
                  <span>{variable}</span>
                  <input
                    name={variable}
                    type="text"
                    required
                    disabled={busy}
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? errorId : undefined}
                    placeholder={Object.hasOwn(examples, variable) ? examples[variable] : `${variable} 입력`}
                    value={values[variable] ?? ""}
                    onInput={(event) => {
                      const value = event.currentTarget.value;
                      setValues((previous) => ({ ...previous, [variable]: value }));
                      if (invalid && value.trim()) setInvalidVariable(undefined);
                    }}
                  />
                  {invalid && <span id={errorId} className="field-error" role="alert">{variable} 값을 입력해 주세요.</span>}
                </label>
              );
            })}
          </div>
          <p className="variable-hint">모든 입력칸을 채워 주세요.</p>
        </div>
        <footer className="popup-footer variable-keys">
          <button type="submit" disabled={busy}>{busy ? "삽입 중…" : "Enter 삽입"}</button>
          <span>Tab 다음 항목</span>
          <span>Esc 닫기</span>
        </footer>
      </form>
    </>
  );
}
