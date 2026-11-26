import type { ConnectPopupKeyboard } from "../hooks/popup/usePopupEventIsolation";
import { toneCommand } from "../commands";
import { useListKeyboard } from "../hooks/keyboard/useListKeyboard";
import type { Template } from "../types";
import { formatShortcut } from "../utils/shortcut-search";

interface Props {
  connectKeyboard: ConnectPopupKeyboard;
  enabled: boolean;
  busy?: boolean;
  templates: Template[];
  active: number;
  searching: boolean;
  message?: string;
  onChoose: (template: Template) => void;
  onActiveChange: (index: number) => void;
}

export function TemplateList({
  connectKeyboard, enabled, busy,
  templates,
  active,
  searching,
  message,
  onChoose,
  onActiveChange,
}: Props) {
  const keyboard = useListKeyboard(connectKeyboard, enabled, {
    onActiveChange,
    active,
    busy,
    optionCount: message ? 0 : templates.length,
    onChoose: (index: number) => onChoose(templates[index]),
  });
  return (
    <div ref={keyboard.root} className="list" role="listbox" aria-label={searching ? "검색 결과" : "최근 사용"}>
      {message || !templates.length ? (
        <div className="message">{message ?? (searching ? "검색 결과가 없습니다." : "저장된 템플릿이 없습니다.")}</div>
      ) : (
        templates.map((template, index) => {
          const { key, autoFocus } = keyboard.getFocusProps(index, template.templateId);
          return (
            <button
              key={key}
              autoFocus={autoFocus}
              type="button"
              className={template.templateId === toneCommand.templateId ? "reserved-command" : undefined}
              role="option"
              aria-selected={index === active}
              aria-label={`${formatShortcut(template.shortcut)} ${template.title}`}
              title={template.content}
              onFocus={() => keyboard.onFocus(index)}
              onBlur={keyboard.onBlur}
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
          );
        })
      )}
    </div>
  );
}
