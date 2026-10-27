import { useEffect, useState } from "react";
import { sendMessage } from "../common/sendMessage";
import { tryCatch } from "../common/wrapper";
import type { EditorStatus, EditorVendorName } from "../core/data-types";
import type { EditorStatusState } from "../context/editorStatusContext";
import type { MessageRequest, MessageResponse } from "../core/message-types";

const EDITOR_STATUS_PATH = "/editor/status";
const EDITOR_NOTIFY_STATUS_PATH = "/editor/notify-status";

function getEditorVendor(tabUrl: string | undefined): EditorVendorName | null {
  if (!tabUrl) return null;
  const url = new URL(tabUrl);
  if (url.protocol !== "https:") return null;

  switch (url.hostname) {
    case "mail.google.com":
      return "GOOGLE";
    case "mail.naver.com":
      return "NAVER";
    default:
      return null;
  }
}

export function isEditorStatus(value: unknown): value is EditorStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const status = value as Partial<EditorStatus>;
  return (
    (status.vendorName === "GOOGLE" || status.vendorName === "NAVER") &&
    typeof status.isEditable === "boolean" &&
    typeof status.text === "string" &&
    Array.isArray(status.prevTexts) &&
    status.prevTexts.every((text) => typeof text === "string")
  );
}

function isEditorNotification(req: MessageRequest): boolean {
  return (
    req.src === "BACKGROUND" &&
    req.dst === "PAGE" &&
    req.method === "PUT" &&
    req.path === EDITOR_NOTIFY_STATUS_PATH
  );
}

async function fetchInitialStatus(): Promise<EditorStatus | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const vendorName = getEditorVendor(tab?.url);
  if (!vendorName) return null;

  const response = await sendMessage({
    src: "PAGE",
    dst: "BACKGROUND",
    method: "GET",
    path: EDITOR_STATUS_PATH,
    data: { vendorName },
  });
  if (
    response?.statusCode !== 200 ||
    !isEditorStatus(response.data) ||
    response.data.vendorName !== vendorName
  ) {
    return null;
  }

  return response.data;
}

function useMessageListener(): EditorStatusState {
  const [editorState, setEditorState] = useState<EditorStatusState>({
    latestStatus: null,
    statuses: {},
  });

  useEffect(() => {
    let cancelled = false;
    let receivedEditorStatus = false;

    function applyStatus(status: EditorStatus) {
      const receivedAt = Date.now();
      setEditorState((previous) => {
        const received = {
          ...status,
          receivedAt,
          updateCount:
            (previous.statuses[status.vendorName]?.updateCount ?? 0) + 1,
        };
        return {
          latestStatus: received,
          statuses: { ...previous.statuses, [status.vendorName]: received },
        };
      });
    }

    const listener = (
      req: MessageRequest,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: MessageResponse) => void,
    ) => {
      if (cancelled || !isEditorNotification(req)) return false;
      if (!isEditorStatus(req.data)) {
        sendResponse({
          statusCode: 400,
          data: { msg: "잘못된 에디터 상태입니다." },
        });
        return false;
      }

      receivedEditorStatus = true;
      applyStatus(req.data);
      sendResponse({ statusCode: 200, data: { received: true } });
      return false;
    };

    async function initialize() {
      try {
        const initialStatus = await fetchInitialStatus();
        // A live notification takes precedence over the initial snapshot.
        if (cancelled || receivedEditorStatus || !initialStatus) return;
        applyStatus(initialStatus);
      } catch {
        // Live notifications remain available if initialization fails.
      }
    }

    tryCatch(() => chrome.runtime.onMessage.addListener(listener));
    void initialize();

    return () => {
      cancelled = true;
      tryCatch(() => chrome.runtime.onMessage.removeListener(listener));
    };
  }, []);

  return editorState;
}

export { useMessageListener, EDITOR_NOTIFY_STATUS_PATH };
