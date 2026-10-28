import { useContext } from "react";
import { EditorStatusContext } from "../context/editorStatusContext";
import { vendors } from "../config/vendors";
import "./EditorStatusTestPanel.css";

export default function EditorStatusTestPanel() {
  const editorState = useContext(EditorStatusContext);

  return (
    <details className="editor-test-panel">
      <summary>에디터 상태 수신 테스트</summary>
      <p className="editor-test-help">
        메일 작성 창을 열거나 본문을 수정하면 수신 횟수와 내용이 갱신됩니다.
      </p>
      {vendors.map(({ id: value, mailName: label }) => {
        const status = editorState?.statuses[value];
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
