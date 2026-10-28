const OPTION_SELECTOR = '[role="option"]';
const LIST_SELECTOR = '[role="listbox"]';

export function createPopupDom(host: HTMLElement) {
  const options = () => Array.from(host.querySelectorAll<HTMLButtonElement>(OPTION_SELECTOR));

  function revealOption(index: number): void {
    const option = options()[index];
    const list = option?.closest<HTMLElement>(LIST_SELECTOR);
    if (!option || !list?.clientHeight) return;
    // Include the list and wrapper padding at either end, not just the option.
    if (index === 0) {
      list.scrollTop = 0;
      return;
    }
    if (index === list.querySelectorAll(OPTION_SELECTOR).length - 1) {
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

  return {
    contains(target: EventTarget | null): boolean {
      return target instanceof Node && host.contains(target);
    },
    hasFocus(): boolean { return host.contains(host.ownerDocument.activeElement); },
    getOptionIndex(target: EventTarget | null): number {
      const option = target instanceof Element ? target.closest(OPTION_SELECTOR) : null;
      return options().findIndex((element) => element === option);
    },
    focusOption(index: number) { options()[index]?.focus({ preventScroll: true }); },
    revealOption,
    hide() { host.style.display = "none"; },
  };
}
