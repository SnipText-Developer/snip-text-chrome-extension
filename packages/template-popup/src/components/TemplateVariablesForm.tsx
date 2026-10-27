import { useLayoutEffect, useRef, useState } from "react";
import type { Template } from "../types";
import { useTemplateContent } from "../hooks/useTemplateContent";

interface Props {
  template: Template;
  onCancel: () => void;
  onInsert: (text: string) => void;
  isComposing: () => boolean;
}

export function TemplateVariablesForm({ template, onCancel, onInsert, isComposing }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(template.variables.map((name) => [name, ""])),
  );
  const content = useTemplateContent(template.content, values);
  const firstInput = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  useLayoutEffect(() => { firstInput.current?.focus(); }, []);

  return (
    <div className="list variables">
      <form
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; }}
        onSubmit={(event) => {
          event.preventDefault();
          if (composing.current || isComposing()) return;
          onInsert(content);
        }}>
        <section aria-label="변수 입력">
          <div className="fields">
            {template.variables.map((variable, index) => (
              <label key={variable}>
                <span>{variable}</span>
                <input
                  ref={index === 0 ? firstInput : undefined}
                  type="text"
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
          <button type="button" onClick={onCancel}>취소</button>
          <button type="submit">삽입</button>
        </div>
      </form>
    </div>
  );
}
