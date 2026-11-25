import InsertBodyButton from "./InsertBodyButton";
import { useEffect, useMemo, useRef, useState } from "react";
import { getTemplateVariables, getTemplateContent } from "../common/template-content";
import { formatShortcut } from "../common/template-search";
import type { Template } from "../core/data-types";
import "./TemplateInsertPage.css";

interface Props {
  onNotify: (message: string) => void;
  template: Template;
  action: "copy" | "insert";
  busy: boolean;
  editable: boolean;
  onClose: () => void;
  onPendingChange: (pending: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export default function TemplateInsertPage({ onNotify: setCopyNotice, template, action, busy, editable, onClose, onPendingChange, onSuccess, onError }: Props) {
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
      <header className="template-insert-header">
        <button className="icon-button template-insert-close" type="button" aria-label="템플릿 목록으로 돌아가기" disabled={busy} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 5-7 7 7 7" />
          </svg>
        </button>
        <h1 id="template-insert-title">템플릿 상세</h1>
      </header>
      <div className="template-insert-summary">
        <h2>{template.title}</h2>
        {template.shortcut && <span className="template-insert-shortcut">{formatShortcut(template.shortcut)}</span>}
      </div>
      <section className="template-insert-content" aria-labelledby="template-content-title">
        <h3 id="template-content-title">템플릿 내용</h3>
        <p className="template-insert-preview">{content}</p>
      </section>
      <form
        className="template-insert-form"
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; }}
        onSubmit={(event) => {
          event.preventDefault();
          if (action === "copy") void copy();
        }}>
        <p className="template-insert-required">* 표시는 필수 입력 항목입니다.</p>
        <div className="template-insert-fields">
          {variables.map((variable, index) => (
            <label key={variable}>
              <span>{variable}<span aria-hidden="true">*</span></span>
              <input
                ref={index === 0 ? firstInput : undefined}
                value={values[variable] ?? ""}
                required
                disabled={busy}
                placeholder={`${variable} 입력`}
                onInput={(event) => {
                  const value = event.currentTarget.value;
                  setValues((previous) => ({ ...previous, [variable]: value }));
                  setCopyNotice("");
                }}
              />
            </label>
          ))}
        </div>
        <div className="template-insert-footer">
          {action === "copy" ? (
            <button type="submit" disabled={busy || !hasAllValues} aria-busy={busy}>복사</button>
          ) : (
            <InsertBodyButton
              type="submit"
              onNotify={setCopyNotice}
              text={content}
              label="메일 본문에 붙여넣기"
              beforeInsert={() => !busy && !composing.current}
              onPendingChange={onPendingChange}
              onSuccess={onSuccess}
              onError={onError}
              disabled={busy || !editable || !hasAllValues}
              title={editable ? "메일 본문에 붙여넣기" : "메일 작성 창을 열어주세요."}
            />
          )}
        </div>
      </form>
    </section>
  );
}
