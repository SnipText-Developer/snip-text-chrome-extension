import type { MessageRequest } from "../../core/message-types";

export function isPageSender(req: MessageRequest, sender: chrome.runtime.MessageSender) {
  return req.src === "PAGE" &&
    sender.id === chrome.runtime.id &&
    !sender.tab &&
    sender.url === chrome.runtime.getURL("src/page/index.html");
}

export function getContentVendor(sender: chrome.runtime.MessageSender) {
  if (sender.id !== chrome.runtime.id || sender.tab?.id === undefined || !sender.url) return null;
  try {
    const url = new URL(sender.url);
    if (url.protocol !== "https:") return null;
    if (url.hostname === "mail.google.com") return "GOOGLE";
    if (url.hostname === "mail.naver.com") return "NAVER";
  } catch { /* Malformed sender URLs are untrusted. */ }
  return null;
}

export function isContentSender(req: MessageRequest, sender: chrome.runtime.MessageSender) {
  return req.src === "CONTENT" && getContentVendor(sender) !== null;
}
