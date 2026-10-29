export function createPopupHost(doc: Document = document) {
  const element = doc.createElement("div");
  element.id = "snip-text-mini-popup";
  doc.documentElement.append(element);
  return { element, remove: () => element.remove() };
}

export function createPopupDom(host: HTMLElement) {
  return {
    contains(target: EventTarget | null): boolean {
      return target instanceof Node && host.contains(target);
    },
    hasFocus(): boolean { return host.contains(host.ownerDocument.activeElement); },
    hide() {
      host.inert = true;
      host.dataset.open = "false";
      host.style.display = "none";
    },
  };
}

/** Layout measurement and writes are kept together to avoid partial positioning. */
export function positionPopup(host: HTMLElement, popup: HTMLElement, bounds: DOMRect): void {
  const viewport = host.ownerDocument.defaultView;
  if (!viewport) return;
  host.inert = false;
  host.dataset.open = "true";
  host.style.display = "block";
  // Transitions scale the visual bounds; position using the layout size.
  const width = popup.offsetWidth;
  const left = Math.max(8, Math.min(bounds.left, viewport.innerWidth - width - 8));
  const top = Math.max(8, bounds.bottom + 6);
  host.style.setProperty("--genie-x", `${bounds.left - left}px`);
  host.style.setProperty("--genie-y", `${bounds.bottom - top}px`);
  host.style.setProperty("--popup-available-height", `${Math.max(0, viewport.innerHeight - top - 8)}px`);
  host.style.left = `${left}px`;
  host.style.top = `${top}px`;
}

export function observeViewport(host: HTMLElement, position: () => void): () => void {
  const doc = host.ownerDocument;
  const viewport = doc.defaultView;
  viewport?.addEventListener("resize", position);
  doc.addEventListener("scroll", position, true);
  return () => {
    viewport?.removeEventListener("resize", position);
    doc.removeEventListener("scroll", position, true);
  };
}
