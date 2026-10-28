/** Layout measurement and writes are kept together to avoid partial positioning. */
export function positionPopup(host: HTMLElement, popup: HTMLElement, bounds: DOMRect): void {
  const viewport = host.ownerDocument.defaultView;
  if (!viewport) return;
  host.style.display = "block";
  const { width, height } = popup.getBoundingClientRect();
  const left = Math.max(8, Math.min(bounds.left, viewport.innerWidth - width - 8));
  const fitsBelow = bounds.bottom + height + 6 <= viewport.innerHeight;
  const top = Math.max(8, fitsBelow ? bounds.bottom + 6 : bounds.top - height - 6);
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
