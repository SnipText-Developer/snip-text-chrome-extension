import { useLayoutEffect, useRef } from "react";
import type { Template } from "../types";

interface Props {
  templates: Template[];
  active: number;
  message?: string;
  onChoose: (template: Template) => void;
  onActiveChange: (index: number) => void;
}

export function TemplateList({ templates, active, message, onChoose, onActiveChange }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [templates, active]);

  return (
    <div className="list" role="listbox" aria-label="템플릿" ref={listRef}>
      {message || !templates.length ? (
        <div className="message">{message ?? "검색 결과가 없습니다."}</div>
      ) : templates.map((template, index) => (
        <button
          key={template.templateId}
          type="button"
          role="option"
          aria-selected={index === active}
          aria-label={`${template.shortcut} ${template.title}`}
          title={template.content}
          onPointerMove={() => { if (active !== index) onActiveChange(index); }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onChoose(template)}>
          <span className="template-command">{template.shortcut}</span>
          <span className="template-text">{template.content.replace(/\s+/g, " ")}</span>
        </button>
      ))}
    </div>
  );
}
