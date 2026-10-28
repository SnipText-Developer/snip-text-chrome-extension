import { useState, type FormEvent } from "react";
import "./ToneCorrectionPage.css";

const tones = ["상사/외부용", "보고/공문용", "마케팅/설득", "공지/안내", "부드러운 존댓말", "편한 말투"];

export default function ToneCorrectionPage({ onClose }: { onClose: () => void }) {
  const [tone, setTone] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("톤 교정 기능은 준비 중입니다. 교정 서비스 연결 후 사용할 수 있습니다.");
  }

  return (
    <section className="tone-page" aria-labelledby="tone-title">
      <div className="tone-header">
        <h2 id="tone-title">AI 톤교정</h2>
        <button type="button" className="icon-button tone-close" aria-label="톤 교정 닫기" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <form className="tone-form" onSubmit={submit}>
        <fieldset className="tone-options">
          <legend>
            문체 선택
            <span className="tone-help" tabIndex={0} aria-label="문체 선택 도움말">
              ?
              <span role="tooltip">전달할 대상과 목적에 맞는 문체를 선택해주세요.</span>
            </span>
          </legend>
          <div className="tone-options-list">
            {tones.map((item) => (
              <label className="tone-option" key={item}>
                <input type="radio" name="tone" value={item} checked={tone === item} required onChange={() => { setTone(item); setNotice(""); }} />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="tone-writing">
          <label htmlFor="tone-text">문장 작성</label>
          <textarea id="tone-text" placeholder="예) 안녕하세요 교수님 실습관련하여 질문이 있습니다..." value={text} required onChange={(event) => { setText(event.target.value); setNotice(""); }} />
        </div>
        <p className="tone-notice" role="status">{notice}</p>
        <div className="tone-footer">
          <button type="submit" disabled={!tone || !text.trim()}>톤 교정하기(0/10)</button>
        </div>
      </form>
    </section>
  );
}
