import styles from "./TemplateVariablesForm.css?inline";
import { useLayoutEffect, useRef, useState } from "react";
import { preventDefault, type MiniPopupDom } from "../dom/index";
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

export function TemplateVariablesForm({ dom, enabled, template, busy, onCancel, onInsert }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(template.variables.map((name) => [name, ""])),
  );
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
      <div className="list variables">
        <form
          ref={root}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          onSubmit={(event) => {
            preventDefault(event);
            if (composing.current || busy) return;
            onInsert(content);
          }}>
          <section aria-label="변수 입력">
            <div className="fields">
              {template.variables.map((variable) => (
                <label key={variable}>
                  <span>{variable}</span>
                  <input
                    type="text"
                    disabled={busy}
                    placeholder={`${variable} 입력`}
                    value={values[variable] ?? ""}
                    onInput={(event) => {
                      const value = event.currentTarget.value;
                      setValues((previous) => ({ ...previous, [variable]: value }));
                    }}
                  />
                </label>
              ))}
            </div>
          </section>
          <div className="actions">
            <button type="button" disabled={busy} onClick={onCancel}>취소</button>
            <button type="submit" disabled={busy}>{busy ? "삽입 중…" : "삽입"}</button>
          </div>
        </form>
      </div>
    </>
  );
}
