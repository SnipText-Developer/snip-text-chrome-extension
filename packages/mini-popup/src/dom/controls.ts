import type { PopupKeyboardContext } from "./events";

export interface OptionListHandlers {
  active: number;
  autoFocus?: boolean;
  busy?: boolean;
  onChoose: (index: number) => void;
  onActiveChange: (index: number) => void;
}

/** Queries stay inside the mounted list, excluding other popup screens. */
export function createOptionListDom(root: HTMLElement) {
  const options = () => Array.from(root.querySelectorAll<HTMLButtonElement>('[role="option"]'));
  return {
    options,
    getOptionIndex(target: EventTarget | null) {
      const option = target instanceof Element ? target.closest('[role="option"]') : null;
      return options().findIndex((element) => element === option);
    },
    focusOption(index: number) { options()[index]?.focus({ preventScroll: true }); },
    revealOption(index: number) {
      const option = options()[index];
      if (!option || !root.clientHeight) return;
      if (index === 0) { root.scrollTop = 0; return; }
      if (index === options().length - 1) {
        root.scrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
        return;
      }
      const style = root.ownerDocument.defaultView!.getComputedStyle(root);
      const viewportTop = root.getBoundingClientRect().top + root.clientTop;
      const top = viewportTop + (parseFloat(style.scrollPaddingTop) || 0);
      const bottom = viewportTop + root.clientHeight - (parseFloat(style.scrollPaddingBottom) || 0);
      const bounds = option.getBoundingClientRect();
      if (bounds.top < top) root.scrollTop += bounds.top - top;
      else if (bounds.bottom > bottom) root.scrollTop += bounds.bottom - bottom;
    },
  };
}

function getVerticalToneOption(options: HTMLButtonElement[], index: number, movingDown: boolean): number {
  const bounds = options.map((option) => ({ top: option.offsetTop, left: option.offsetLeft, width: option.offsetWidth }));
  const current = bounds[index];
  const rows = [...new Set(bounds.map((rect) => rect.top))];
  const row = rows.indexOf(current.top);
  const targetTop = rows[(row + (movingDown ? 1 : -1) + rows.length) % rows.length];
  const center = current.left + current.width / 2;
  let nearest = index;
  let distance = Infinity;
  bounds.forEach((rect, optionIndex) => {
    if (rect.top !== targetTop) return;
    const gap = Math.abs(rect.left + rect.width / 2 - center);
    if (gap >= distance) return;
    nearest = optionIndex;
    distance = gap;
  });
  return nearest;
}

function connectList(
  root: HTMLElement, context: PopupKeyboardContext,
  read: () => OptionListHandlers, toneMenu: boolean,
) {
  const list = createOptionListDom(root);
  let renderedHandlers = read();
  let active = renderedHandlers.active;
  const disconnect = context.events.connectKeyboard((event) => {
    const inside = event.target instanceof Node && root.contains(event.target);
    if (!inside && !context.isEditorEvent(event)) return;
    const handlers = read();
    if (handlers !== renderedHandlers) {
      active = handlers.active;
      renderedHandlers = handlers;
    }
    if (handlers.busy || event.isComposing || context.events.isComposing()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      return true;
    }
    const options = list.options();
    if (!options.length) return;
    const focused = inside ? list.getOptionIndex(event.target) : -1;
    const index = focused >= 0 ? focused : active;
    if ((!inside || toneMenu) && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!event.repeat) handlers.onChoose(Math.max(0, index));
      return true;
    }
    const vertical = event.key === "ArrowDown" || event.key === "ArrowUp";
    const horizontal = toneMenu && (event.key === "ArrowLeft" || event.key === "ArrowRight");
    if (!vertical && !horizontal) return;
    event.preventDefault();
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    let next = forward ? 0 : options.length - 1;
    if (index >= 0) {
      next = toneMenu && vertical
        ? getVerticalToneOption(options, index, forward)
        : (index + (forward ? 1 : -1) + options.length) % options.length;
    }
    active = next;
    handlers.onActiveChange(next);
    if (inside || toneMenu) list.focusOption(next);
    list.revealOption(next);
    return true;
  });
  if (read().autoFocus) list.focusOption(read().active);
  return disconnect;
}

export function connectTemplateList(root: HTMLElement, context: PopupKeyboardContext, read: () => OptionListHandlers) {
  return connectList(root, context, read, false);
}

export function connectToneMenu(root: HTMLElement, context: PopupKeyboardContext, read: () => OptionListHandlers) {
  return connectList(root, context, read, true);
}

export interface TemplateInputHandlers {
  busy?: boolean;
  onCancel: () => void;
}

/** Text, Tab and native form submission keep their browser default actions. */
export function connectTemplateInput(
  root: HTMLElement, context: PopupKeyboardContext, read: () => TemplateInputHandlers,
) {
  const disconnect = context.events.connectKeyboard((event) => {
    const inside = event.target instanceof Node && root.contains(event.target);
    if (!inside && !context.isEditorEvent(event)) return;
    if (read().busy || event.isComposing || context.events.isComposing()) return;
    if (event.key !== "Escape") return;
    event.preventDefault();
    read().onCancel();
    return true;
  });
  root.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus({ preventScroll: true });
  return disconnect;
}

export function focusVariableInput(form: HTMLFormElement | null, name: string): void {
  if (!form) return;
  const inputs = Array.from(form.querySelectorAll("input"));
  inputs.find((input) => input.name === name)?.focus();
}
