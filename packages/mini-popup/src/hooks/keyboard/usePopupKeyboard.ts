import { useLayoutEffect, useRef } from "react";
import type { ConnectPopupKeyboard } from "../popup/usePopupEventIsolation";

type KeyboardHandler = Parameters<ConnectPopupKeyboard>[1];

export function usePopupKeyboard<T extends HTMLElement>(
  connectKeyboard: ConnectPopupKeyboard,
  enabled: boolean,
  handleKey: KeyboardHandler,
) {
  const root = useRef<T>(null);
  const latest = useRef(handleKey);
  useLayoutEffect(() => {
    latest.current = handleKey;
  }, [handleKey]);

  useLayoutEffect(() => {
    if (enabled && root.current) {
      return connectKeyboard(root.current, (input, inside) => latest.current(input, inside));
    }
  }, [connectKeyboard, enabled]);

  return root;
}
