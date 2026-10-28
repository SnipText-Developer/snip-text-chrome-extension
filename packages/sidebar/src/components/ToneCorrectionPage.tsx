import { useContext, useEffect, useRef, useState, type FormEvent } from "react";
import { EditorStatusContext } from "../context/editorStatusContext";
import { sendMessage } from "../common/sendMessage";
import InsertBodyButton from "./InsertBodyButton";
import "./ToneCorrectionPage.css";

const tones = ["상사/외부용", "보고/공문용", "마케팅/설득", "공지/안내", "부드러운 존댓말", "편한 말투"];

export default function ToneCorrectionPage({ onClose }: { onClose: () => void }) {
  const [tone, setTone] = useState<string | null>(null);
  const editor = useContext(EditorStatusContext)?.latestStatus;
  const text = editor?.text ?? "";
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [inserting, setInserting] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    if (!tone) {
      setNotice("교정할 문체를 선택해주세요.");
      return;
    }
    if (!editor || !text.trim()) {
      setNotice("메일 작성 창에 교정할 본문을 입력해주세요.");
      return;
    }
    pending.current = true;
    setLoading(true);
    setNotice("");
    setResult("");
    try {
      const response = await sendMessage({
        src: "PAGE",
        dst: "BACKGROUND",
        method: "POST",
        path: "/ai/tone-correction",
        data: { vendorName: editor.vendorName, tone },
      });
      if (response?.statusCode !== 200) {
        throw new Error(response?.data?.msg ?? "톤 교정 요청을 보내지 못했습니다. 다시 시도해주세요.");
      }
      if (typeof response.data?.text !== "string" || !response.data.text.trim()) {
        throw new Error("교정 결과를 받지 못했습니다. 다시 시도해주세요.");
      }
      if (mounted.current) {
        setResult(response.data.text);
        setNotice("교정 결과를 받았습니다.");
      }
    } catch (error) {
      if (mounted.current) setNotice(error instanceof Error ? error.message : "톤 교정 요청에 실패했습니다.");
    } finally {
      pending.current = false;
      if (mounted.current) setLoading(false);
    }
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
      <form className="tone-form" onSubmit={submit} aria-busy={loading || inserting}>
        <fieldset className="tone-options" disabled={loading || inserting}>
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
          <label htmlFor="tone-text">메일 본문</label>
          <textarea id="tone-text" placeholder="메일 작성 창에 교정할 본문을 입력해주세요." value={text} readOnly />
        </div>
        {result && (
          <div className="tone-writing tone-result">
            <label htmlFor="tone-result">교정 결과</label>
            <textarea id="tone-result" value={result} readOnly />
            <div className="tone-footer tone-insert-footer">
              <InsertBodyButton text={result} disabled={loading}
                onPendingChange={(value) => { pending.current = value; setInserting(value); if (value) setNotice(""); }}
                onSuccess={() => setNotice("교정 결과를 본문에 삽입했습니다.")}
                onError={setNotice} />
            </div>
          </div>
        )}
        <p className="tone-notice" role="status">{loading ? "톤 교정 요청 중입니다. 잠시만 기다려주세요." : inserting ? "본문에 삽입 중입니다." : notice}</p>
        <div className="tone-footer">
          <button type="submit" disabled={loading || inserting}>
            {loading && <span className="tone-spinner" aria-hidden="true" />}
            {loading ? "교정 중…" : "톤 교정하기(0/10)"}
          </button>
        </div>
      </form>
    </section>
  );
}
