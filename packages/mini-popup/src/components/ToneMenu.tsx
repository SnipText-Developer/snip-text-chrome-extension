import { useLayoutEffect, useRef } from "react";
import type { MiniPopupDom } from "../dom/index";
import type { Template } from "../types";
import { LoadingIndicator } from "./LoadingIndicator";

interface Props {
  dom: MiniPopupDom;
  enabled: boolean;
  options: Template[];
  active: number;
  busy?: boolean;
  onChoose: (option: Template) => void;
  onActiveChange: (index: number) => void;
}

export function ToneMenu({ dom, enabled, options, active, busy, onChoose, onActiveChange }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const handlers = useRef({ active, autoFocus: true, busy, onActiveChange, onChoose: (index: number) => onChoose(options[index]) });
  handlers.current = { active, autoFocus: true, busy, onActiveChange, onChoose: (index) => onChoose(options[index]) };
  useLayoutEffect(() => {
    if (enabled && root.current) return dom.connectToneMenu(root.current, () => handlers.current);
  }, [dom, enabled]);
  return (
    <>
    <div ref={root} className="list tone-options" role="listbox" aria-label="문체 선택" aria-busy={busy}>
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
