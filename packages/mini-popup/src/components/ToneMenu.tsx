import type { ConnectPopupKeyboard } from "../hooks/popup/usePopupEventIsolation";
import { useListKeyboard } from "../hooks/keyboard/useListKeyboard";
import type { Template } from "../types";
import { LoadingIndicator } from "./LoadingIndicator";

interface Props {
  connectKeyboard: ConnectPopupKeyboard;
  enabled: boolean;
  options: Template[];
  active: number;
  busy?: boolean;
  onChoose: (option: Template) => void;
  onCancel: () => void;
  onActiveChange: (index: number) => void;
}

export function ToneMenu({ connectKeyboard, enabled, options, active, busy, onChoose, onCancel, onActiveChange }: Props) {
  const keyboard = useListKeyboard(connectKeyboard, enabled, {
    onActiveChange,
    onCancel,
    active,
    busy,
    optionCount: options.length,
    onChoose: (index: number) => onChoose(options[index]),
  }, 0, true);
  return (
    <>
      <div ref={keyboard.root} className="list tone-options" role="listbox" aria-label="문체 선택" aria-busy={busy}>
        {options.map((option, index) => {
          const { key, autoFocus } = keyboard.getFocusProps(index, option.templateId);
          return (
            <button
              key={key}
              autoFocus={autoFocus}
              type="button"
              role="option"
              aria-selected={index === active}
              disabled={busy}
              onFocus={() => keyboard.onFocus(index)}
              onBlur={keyboard.onBlur}
              onPointerMove={() => onActiveChange(index)}
              onClick={() => onChoose(option)}>
              {option.title}
            </button>
          );
        })}
      </div>
      <LoadingIndicator active={busy === true} />
    </>
  );
}
