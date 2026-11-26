import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent, SyntheticEvent } from "react";

export type KeyboardInput = Pick<KeyboardEvent, "key" | "repeat" | "shiftKey" | "isComposing">;
export type ConnectPopupKeyboard = (
  root: HTMLElement,
  handle: (input: KeyboardInput, inside: boolean) => boolean | void,
) => () => void;

function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

const popupEventProps = {
  onPointerDown: stopPropagation,
  onPointerUp: stopPropagation,
  onMouseDown(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element && target.closest("input, button, label, textarea, select, a"))) {
      event.preventDefault();
    }
    event.stopPropagation();
  },
  onMouseUp: stopPropagation,
  onClick: stopPropagation,
  onInput: stopPropagation,
  onCompositionStart: stopPropagation,
  onCompositionEnd: stopPropagation,
  onSubmit: stopPropagation,
};

export function usePopupEventIsolation(
  host: HTMLElement,
  matchesEditor: (target: EventTarget | null) => boolean,
  isOpen: () => boolean,
) {
  const keyboard = useRef<{
    root: HTMLElement;
    handle: Parameters<ConnectPopupKeyboard>[1];
  } | null>(null);
  const composing = useRef(false);

  // Switching screens only replaces the handler. The capture listener keeps its priority.
  const connectKeyboard = useCallback<ConnectPopupKeyboard>((root, handle) => {
    const binding = { root, handle };
    keyboard.current = binding;
    return () => {
      if (keyboard.current === binding) {
        keyboard.current = null;
        composing.current = false;
      }
    };
  }, []);

  useEffect(() => {
    const doc = host.ownerDocument;
    const viewport = doc.defaultView;
    const listeners = new AbortController();
    const { signal } = listeners;
    const isolatedKeys = new Set<string>();
    const keyId = (event: KeyboardEvent) => event.code || event.key;

    function stopPopupKey(event: KeyboardEvent) {
      const key = keyId(event);
      const inside = isOpen() && event.composedPath().includes(host);
      if (inside || isolatedKeys.has(key)) event.stopImmediatePropagation();
      if (event.type === "keyup") isolatedKeys.delete(key);
    }

    doc.addEventListener("compositionstart", () => {
      composing.current = true;
    }, { capture: true, signal });
    doc.addEventListener("compositionend", () => {
      composing.current = false;
    }, { capture: true, signal });
    viewport?.addEventListener("keydown", (event) => {
      const open = isOpen();
      const path = event.composedPath();
      const inside = open && path.includes(host);
      const binding = keyboard.current;
      const handled = open && binding && (
        inside ? path.includes(binding.root) : matchesEditor(event.target)
      ) && binding.handle({
        key: event.key,
        repeat: event.repeat,
        shiftKey: event.shiftKey,
        isComposing: event.isComposing || composing.current,
      }, inside);

      if (handled) event.preventDefault();
      const key = keyId(event);
      if (inside || handled) {
        isolatedKeys.add(key);
        event.stopImmediatePropagation();
      } else {
        isolatedKeys.delete(key);
      }
    }, { capture: true, signal });
    viewport?.addEventListener("keyup", stopPopupKey, { capture: true, signal });
    viewport?.addEventListener("keypress", stopPopupKey, { capture: true, signal });
    viewport?.addEventListener("blur", () => isolatedKeys.clear(), { signal });
    return () => {
      listeners.abort();
      composing.current = false;
    };
  }, [host, isOpen, matchesEditor]);

  return { popupEventProps, connectKeyboard };
}
