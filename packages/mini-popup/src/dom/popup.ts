
export function focusPopupOption(list: HTMLElement | null, index: number): void {
  list?.querySelectorAll<HTMLButtonElement>('[role="option"]')[index]?.focus({ preventScroll: true });
}

export function getPopupOptionIndex(host: HTMLElement, target: EventTarget | null): number {
  const option = target instanceof Element ? target.closest('[role="option"]') : null;
  return Array.from(host.querySelectorAll('[role="option"]')).findIndex((element) => element === option);
}

export function revealPopupOption(host: HTMLElement, index: number): void {
  const option = host.querySelectorAll<HTMLElement>('[role="option"]')[index];
  const list = option?.closest<HTMLElement>('[role="listbox"]');
  if (!option || !list?.clientHeight) return;
  // Include the list and wrapper padding at either end, not just the option.
  if (index === 0) {
    list.scrollTop = 0;
    return;
  }
  if (index === list.querySelectorAll('[role="option"]').length - 1) {
    list.scrollTop = Math.max(0, list.scrollHeight - list.clientHeight);
    return;
  }
  const style = host.ownerDocument.defaultView!.getComputedStyle(list);
  const viewportTop = list.getBoundingClientRect().top + list.clientTop;
  const top = viewportTop + (parseFloat(style.scrollPaddingTop) || 0);
  const bottom = viewportTop + list.clientHeight - (parseFloat(style.scrollPaddingBottom) || 0);
  const bounds = option.getBoundingClientRect();
  if (bounds.top < top) list.scrollTop += bounds.top - top;
  else if (bounds.bottom > bottom) list.scrollTop += bounds.bottom - bottom;
}

export function hidePopup(host: HTMLElement): void {
  host.style.display = "none";
}

export function createPopupDom(host: HTMLElement) {
  return {
    contains(target: EventTarget | null): boolean {
      return target instanceof Node && host.contains(target);
    },
    hasFocus(): boolean { return host.contains(host.ownerDocument.activeElement); },
    getOptionIndex(target: EventTarget | null): number { return getPopupOptionIndex(host, target); },
    focusOption(index: number) { focusPopupOption(host, index); },
    revealOption(index: number) { revealPopupOption(host, index); },
    hide() { hidePopup(host); },
  };
}
