export function calculatePopupPosition(
  bounds: Pick<DOMRect, "left" | "bottom">,
  width: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const left = Math.max(8, Math.min(bounds.left, viewportWidth - width - 8));
  const top = Math.max(8, bounds.bottom + 6);
  return {
    left,
    top,
    "--genie-x": `${bounds.left - left}px`,
    "--genie-y": `${bounds.bottom - top}px`,
    "--popup-available-height": `${Math.max(0, viewportHeight - top - 8)}px`,
  };
}
