import { useRef, useState } from "react";
import type { ConnectPopupKeyboard, KeyboardInput } from "../popup/usePopupEventIsolation";
import { useAutoFocusTarget } from "./useAutoFocusTarget";
import { usePopupKeyboard } from "./usePopupKeyboard";

export function useListKeyboard(
  connectKeyboard: ConnectPopupKeyboard,
  enabled: boolean,
  handlers: OptionListHandlers,
  initialFocus?: number,
  toneMenu = false,
) {
  const focus = useAutoFocusTarget(initialFocus, enabled);
  const listHandlers = {
    ...handlers,
    onNavigate(index: number, moveFocus: boolean) {
      handlers.onActiveChange(index);
      if (moveFocus) focus.requestFocus(index);
    },
  };
  const latest = useRef(listHandlers);
  latest.current = listHandlers;
  const focused = useRef<number | undefined>(undefined);
  const [handleKey] = useState(() => createListKeyHandler(() => latest.current, toneMenu));

  const root = usePopupKeyboard<HTMLDivElement>(connectKeyboard, enabled, (input, inside) =>
    handleKey(input, inside, inside ? focused.current : undefined),
  );

  return {
    root,
    getFocusProps: focus.getFocusProps,
    onFocus(index: number) {
      focused.current = index;
      handlers.onActiveChange(index);
    },
    onBlur() {
      focused.current = undefined;
    },
  };
}

interface OptionListHandlers {
  active: number;
  optionCount: number;
  busy?: boolean;
  onChoose: (index: number) => void;
  onCancel?: () => void;
  onActiveChange: (index: number) => void;
}

function createListKeyHandler(
  read: () => OptionListHandlers & { onNavigate: (index: number, moveFocus: boolean) => void },
  toneMenu: boolean,
) {
  let renderedHandlers = read();
  let active = renderedHandlers.active;
  return (event: KeyboardInput, inside: boolean, focusedIndex: number | undefined) => {
    const handlers = read();
    if (handlers !== renderedHandlers) {
      active = handlers.active;
      renderedHandlers = handlers;
    }
    if (handlers.busy || event.isComposing) return;
    if (event.key === "Escape") {
      handlers.onCancel?.();
      return true;
    }
    const count = handlers.optionCount;
    if (!count) return;
    const index = focusedIndex ?? active;
    if ((!inside || toneMenu) && event.key === "Enter" && !event.shiftKey) {
      if (!event.repeat) handlers.onChoose(Math.max(0, index));
      return true;
    }
    const vertical = event.key === "ArrowDown" || event.key === "ArrowUp";
    const horizontal = toneMenu && (event.key === "ArrowLeft" || event.key === "ArrowRight");
    if (!vertical && !horizontal) return;
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    let next = forward ? 0 : count - 1;
    if (index >= 0) {
      // The tone menu has three columns in CSS.
      const step = toneMenu && vertical ? 3 : 1;
      next = (index + (forward ? step : -step) + count) % count;
    }
    active = next;
    handlers.onNavigate(next, inside || toneMenu);
    return true;
  };
}
