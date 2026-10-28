import type { Template } from "../types";
import { LoadingIndicator } from "./LoadingIndicator";

interface Props {
  options: Template[];
  active: number;
  busy?: boolean;
  onChoose: (option: Template) => void;
  onActiveChange: (index: number) => void;
}

export function ToneMenu({ options, active, busy, onChoose, onActiveChange }: Props) {
  return (
    <>
    <div className="list tone-options" role="listbox" aria-label="문체 선택" aria-busy={busy}>
      {options.map((option, index) => (
        <button key={option.templateId} type="button" role="option" aria-selected={index === active}
          disabled={busy} onFocus={() => onActiveChange(index)}
          onPointerMove={() => onActiveChange(index)} onClick={() => onChoose(option)}>
          {option.title}
        </button>
      ))}
    </div>
    <LoadingIndicator active={busy === true} />
    </>
  );
}
