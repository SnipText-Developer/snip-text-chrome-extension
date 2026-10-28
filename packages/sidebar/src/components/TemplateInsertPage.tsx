import { useEffect, useMemo, useRef, useState } from "react";
import { getTemplateVariables, useTemplateContent } from "@snip-text/mini-popup";
import type { Template } from "../core/data-types";
import "./TemplateInsertPage.css";

interface Props {
  template: Template;
  busy: boolean;
  editable: boolean;
  notice: string;
  onClose: () => void;
  onInsert: (content: string) => void;
}

export default function TemplateInsertPage({ template, busy, editable, notice, onClose, onInsert }: Props) {
  const variables = useMemo(() => getTemplateVariables(template.content), [template.content]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(variables.map((name) => [name, ""])),
  );
  const composing = useRef(false);
  const firstInput = useRef<HTMLInputElement>(null);
  const previewValues = useMemo(() => Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== ""),
  ), [values]);
  const preview = useTemplateContent(template.content, previewValues);
  const content = useTemplateContent(template.content, values);

  useEffect(() => { firstInput.current?.focus(); }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.isComposing && !composing.current && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  return (
    <section className="template-insert-page" aria-labelledby="template-insert-title">
      <div className="template-insert-header">
        <div>
          <h2 id="template-insert-title">{template.title}</h2>
          <span className="template-insert-shortcut">{template.shortcut}</span>
        </div>
        <button className="template-insert-close" type="button" aria-label="변수 입력 닫기" disabled={busy} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19" /></svg>
        </button>
      </div>
      <p className="template-insert-preview" aria-label="삽입할 본문 미리보기">{preview}</p>
      <form
        className="template-insert-form"
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && editable && !composing.current) onInsert(content);
        }}>
        <div className="template-insert-fields">
          {variables.map((variable, index) => (
            <label key={variable}>
              {variable}
              <input
                ref={index === 0 ? firstInput : undefined}
                value={values[variable] ?? ""}
                disabled={busy}
                placeholder={`${variable} 입력`}
                onChange={(event) => {
                  const value = event.target.value;
                  setValues((previous) => ({ ...previous, [variable]: value }));
                }}
              />
            </label>
          ))}
        </div>
        <p className="notice" role="status" aria-live="polite">{notice}</p>
        <div className="template-insert-footer">
          <button type="submit" disabled={busy || !editable} title={editable ? "메일 본문에 삽입" : "메일 작성 창을 열어주세요."}>
            {busy ? "삽입 중…" : "메일 본문에 삽입"}
          </button>
        </div>
      </form>
    </section>
  );
}
