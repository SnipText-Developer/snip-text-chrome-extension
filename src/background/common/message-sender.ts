import { getVendorByUrl } from "../../config/vendors";
import type { MessageRequest } from "../../core/message-types";

export function isPageSender(
  req: MessageRequest,
  sender: chrome.runtime.MessageSender,
) {
  return (
    req.src === "PAGE" &&
    sender.id === chrome.runtime.id &&
    !sender.tab &&
    sender.url === chrome.runtime.getURL("src/page/index.html")
  );
}

export function getContentVendor(sender: chrome.runtime.MessageSender) {
  const tabId = sender.tab?.id;
  if (
    sender.id !== chrome.runtime.id ||
    typeof tabId !== "number" ||
    !Number.isInteger(tabId) ||
    tabId < 0 ||
    !sender.url
  )
    return null;
  if (
    sender.frameId !== undefined &&
    (!Number.isInteger(sender.frameId) || sender.frameId < 0)
  )
    return null;

  try {
    const url = new URL(sender.url);
    const vendor = getVendorByUrl(url.href);
    if (vendor) {
      if (sender.origin !== undefined && sender.origin !== url.origin)
        return null;
      return vendor.id;
    }
    // Only blank/srcdoc subframes may inherit an allowed mail origin.
    if (
      !sender.frameId ||
      url.protocol !== "about:" ||
      !["blank"].includes(url.pathname)
    )
      return null;
    return getVendorByUrl(sender.origin)?.id ?? null;
  } catch {
    return null;
  }
}

export function isContentSender(
  req: MessageRequest,
  sender: chrome.runtime.MessageSender,
) {
  return req.src === "CONTENT" && getContentVendor(sender) !== null;
}
