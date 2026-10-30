import InsertBodyButton from "./InsertBodyButton";
import { useEffect, useMemo, useRef, useState } from "react";
import { getTemplateVariables, getTemplateContent } from "../common/template-content";
import type { Template } from "../core/data-types";
import "./TemplateInsertPage.css";

interface Props {
  onNotify: (message: string) => void;
  template: Template;
  busy: boolean;
  editable: boolean;
  onClose: () => void;
  onPendingChange: (pending: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export default function TemplateInsertPage({ onNotify: setCopyNotice, template, busy, editable, onClose, onPendingChange, onSuccess, onError }: Props) {
  const variables = useMemo(() => getTemplateVariables(template.content), [template.content]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(variables.map((name) => [name, ""])),
  );
  const composing = useRef(false);
  const copyPending = useRef(false);
  const firstInput = useRef<HTMLInputElement>(null);
  const content = useMemo(() => getTemplateContent(template.content, values), [template.content, values]);
  const hasAllValues = variables.every((variable) => Boolean(values[variable]?.trim()));

  async function copy() {
    if (busy || copyPending.current || composing.current || !hasAllValues) return;
    copyPending.current = true;
    onPendingChange(true);
    setCopyNotice("");
    try {
      await navigator.clipboard.writeText(content);
      setCopyNotice(`‘${template.title}’ 내용을 복사했어요.`);
    } catch {
      setCopyNotice("복사하지 못했습니다. 텍스트를 직접 선택해 복사해주세요.");
    } finally {
      copyPending.current = false;
      onPendingChange(false);
    }
  }

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
      <p className="template-insert-preview" aria-label="본문 미리보기">{content}</p>
      <form
        className="template-insert-form"
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; }}
        onSubmit={(event) => {
          event.preventDefault();
          void copy();
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
                  setCopyNotice("");
                }}
              />
            </label>
          ))}
        </div>
        <div className="template-insert-footer">
          <button type="submit" disabled={busy || !hasAllValues} aria-busy={busy} title={hasAllValues ? "복사" : "모든 변수를 입력해주세요."}>복사</button>
          <InsertBodyButton
            onNotify={setCopyNotice}
            text={content}
            label="메일 본문에 붙여넣기"
            beforeInsert={() => {
              if (busy || composing.current) return false;
              setCopyNotice("");
              return true;
            }}
            onPendingChange={onPendingChange}
            onSuccess={onSuccess}
            onError={onError}
            disabled={busy || !editable}
            title={editable ? "메일 본문에 붙여넣기" : "메일 작성 창을 열어주세요."}
          />
        </div>
      </form>
    </section>
  );
}
