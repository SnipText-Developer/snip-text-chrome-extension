import { useLayoutEffect, useRef } from "react";
import type { MiniPopupDom } from "../dom/index";
import { toneCommand } from "../commands";
import type { Template } from "../types";
import { formatShortcut } from "../utils/shortcut-search";

interface Props {
  dom: MiniPopupDom;
  enabled: boolean;
  busy?: boolean;
  templates: Template[];
  active: number;
  autoFocus?: boolean;
  searching: boolean;
  message?: string;
  onChoose: (template: Template) => void;
  onActiveChange: (index: number) => void;
}

export function TemplateList({
  dom, enabled, busy,
  templates,
  active,
  autoFocus,
  searching,
  message,
  onChoose,
  onActiveChange,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const handlers = useRef({ active, autoFocus, busy, onActiveChange, onChoose: (index: number) => onChoose(templates[index]) });
  handlers.current = { active, autoFocus, busy, onActiveChange, onChoose: (index) => onChoose(templates[index]) };
  useLayoutEffect(() => {
    if (enabled && root.current) return dom.connectTemplateList(root.current, () => handlers.current);
  }, [dom, enabled]);
  return (
    <div ref={root} className="list" role="listbox" aria-label={searching ? "검색 결과" : "최근 사용"}>
      {message || !templates.length ? (
        <div className="message">{message ?? (searching ? "검색 결과가 없습니다." : "저장된 템플릿이 없습니다.")}</div>
      ) : (
        templates.map((template, index) => (
          <button
            key={template.templateId}
            type="button"
            className={template.templateId === toneCommand.templateId ? "reserved-command" : undefined}
            role="option"
            aria-selected={index === active}
            aria-label={`${formatShortcut(template.shortcut)} ${template.title}`}
            title={template.content}
            onFocus={() => onActiveChange(index)}
            onPointerMove={() => {
              if (active !== index) onActiveChange(index);
            }}
            onClick={() => onChoose(template)}>
            <span className="template-command">{formatShortcut(template.shortcut)}</span>
            <span className="template-text">
              {template.content.replace(/\s+/g, " ")}
            </span>
            {(index === active || template.templateId === toneCommand.templateId) && (
              <span aria-hidden="true" className="option-chevron" />
            )}
          </button>
        ))
      )}
    </div>
  );
}
