import styles from "./TemplateList.css?inline";
import { toneCommand } from "../commands";
import type { Template } from "../types";

interface Props {
  templates: Template[];
  active: number;
  autoFocus?: boolean;
  message?: string;
  onChoose: (template: Template) => void;
  onActiveChange: (index: number) => void;
}

export function TemplateList({
  templates,
  active,
  autoFocus,
  message,
  onChoose,
  onActiveChange,
}: Props) {
  return (
    <>
      <style>{styles}</style>
      <div className="list" role="listbox" aria-label="템플릿">
        {message || !templates.length ? (
          <div className="message">{message ?? "검색 결과가 없습니다."}</div>
        ) : (
          templates.map((template, index) => (
            <button
              key={template.templateId}
              type="button"
              className={template.templateId === toneCommand.templateId ? "reserved-command" : undefined}
              autoFocus={autoFocus && index === active}
              role="option"
              aria-selected={index === active}
              aria-label={`${template.shortcut} ${template.title}`}
              title={template.content}
              onFocus={() => onActiveChange(index)}
              onPointerMove={() => {
                if (active !== index) onActiveChange(index);
              }}
              onClick={() => onChoose(template)}>
              <span className="template-command">{template.shortcut}</span>
              <span className="template-text">
                {template.content.replace(/\s+/g, " ")}
              </span>
              {template.templateId === toneCommand.templateId && <span aria-hidden="true">&gt;</span>}
            </button>
          ))
        )}
      </div>
    </>
  );
}
