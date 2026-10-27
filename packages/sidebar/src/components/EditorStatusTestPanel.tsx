import { useCallback, useState } from "react";
import { useMessageListener, EDITOR_NOTIFY_STATUS_PATH } from "../customHook/messageListener";
import type { MessageRequest, MessageResponse } from "../core/message-types";
import type { EditorStatus, EditorVendorName } from "../core/data-types";
import "./EditorStatusTestPanel.css";

type ReceivedEditorStatus = EditorStatus & { receivedAt: number; updateCount: number };
type EditorStatuses = Partial<Record<EditorVendorName, ReceivedEditorStatus>>;

function isEditorStatus(value: unknown): value is EditorStatus {
  if (!value || typeof value !== "object") return false;
  const status = value as Partial<EditorStatus>;
  return (
    (status.vendorName === "GOOGLE" || status.vendorName === "NAVER") &&
    typeof status.isEditable === "boolean" &&
    typeof status.text === "string" &&
    Array.isArray(status.prevTexts) &&
    status.prevTexts.every((text) => typeof text === "string")
  );
}

const vendors: { value: EditorVendorName; label: string }[] = [
  { value: "GOOGLE", label: "Gmail" },
  { value: "NAVER", label: "네이버 메일" },
];

export default function EditorStatusTestPanel() {
  const [statuses, setStatuses] = useState<EditorStatuses>({});
  const handleStatus = useCallback((req: MessageRequest): MessageResponse | void => {
    if (
      req.src !== "BACKGROUND" ||
      req.dst !== "PAGE" ||
      req.method !== "PUT" ||
      req.path !== EDITOR_NOTIFY_STATUS_PATH
    ) return;

    if (!isEditorStatus(req.data)) {
      return { statusCode: 400, data: { msg: "잘못된 에디터 상태입니다." } };
    }
    const status = req.data;
    setStatuses((previous) => ({
      ...previous,
      [status.vendorName]: {
        ...status,
        receivedAt: Date.now(),
        updateCount: (previous[status.vendorName]?.updateCount ?? 0) + 1,
      },
    }));
    return { statusCode: 200, data: { received: true } };
  }, []);

  useMessageListener(handleStatus);


  return (
    <details className="editor-test-panel" open>
      <summary>에디터 상태 수신 테스트</summary>
      <p className="editor-test-help">
        메일 작성 창을 열거나 본문을 수정하면 수신 횟수와 내용이 갱신됩니다.
      </p>
      {vendors.map(({ value, label }) => {
        const status = statuses[value];
        return (
          <section className="editor-test-vendor" key={value} aria-label={`${label} 에디터 상태`}>
            <div className="editor-test-heading">
              <h2>{label}</h2>
              <span className={status ? "editor-test-badge received" : "editor-test-badge"} role="status">
                {status ? `업데이트 수신 · ${status.updateCount}회` : "수신 대기 중"}
              </span>
            </div>
            {status && (
              <>
                <dl>
                  <div>
                    <dt>마지막 수신</dt>
                    <dd>
                      <time dateTime={new Date(status.receivedAt).toISOString()}>
                        {new Date(status.receivedAt).toLocaleTimeString("ko-KR", { hour12: false })}
                      </time>
                    </dd>
                  </div>
                  <div><dt>편집 가능</dt><dd>{status.isEditable ? "예" : "아니요"}</dd></div>
                  <div><dt>본문 길이</dt><dd>{status.text.length}자</dd></div>
                  <div><dt>이전 본문</dt><dd>{status.prevTexts.length}개</dd></div>
                </dl>
                <details className="editor-test-content">
                  <summary>수신한 본문 보기</summary>
                  <pre>{status.text || "(빈 본문)"}</pre>
                </details>
              </>
            )}
          </section>
        );
      })}
    </details>
  );
}
