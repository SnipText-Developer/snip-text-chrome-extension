export function createPopupHost(doc: Document = document) {
  const element = doc.createElement("div");
  element.id = "snip-text-mini-popup";
  doc.documentElement.append(element);
  return { element, remove: () => element.remove() };
}
