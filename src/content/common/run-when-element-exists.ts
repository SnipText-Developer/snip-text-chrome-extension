export function runWhenElementExists(selector: string, callback: () => void): void {
  if (document.querySelector(selector)) {
    callback();
    return;
  }

  function stop(): void {
    observer.disconnect();
    window.removeEventListener("pagehide", stop);
  }

  const observer = new MutationObserver(() => {
    if (!document.querySelector(selector)) return;
    stop();
    callback();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "contenteditable"],
  });
  window.addEventListener("pagehide", stop, { once: true });
}
