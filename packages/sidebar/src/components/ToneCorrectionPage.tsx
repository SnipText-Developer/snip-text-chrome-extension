import { useContext, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { EditorStatusContext } from "../context/editorStatusContext";
import InsertBodyButton from "./InsertBodyButton";
import { sendMessage } from "../common/message-bus";
import "./ToneCorrectionPage.css";

const tones = ["상사/외부용", "보고/공문용", "마케팅/설득", "공지/안내", "부드러운 존댓말", "편한 반말"];

interface CorrectionResult {
  source: string;
  text: string;
  tone: string;
}

function CharacterCounts({ text }: { text: string }) {
  const count = Array.from(text).length;
  const withoutSpaces = Array.from(text.replace(/\s/gu, "")).length;
  return (
    <dl className="tone-counts">
      <div><dt>공백 포함</dt><dd>{count.toLocaleString("ko-KR")}자</dd></div>
      <div><dt>공백 제외</dt><dd>{withoutSpaces.toLocaleString("ko-KR")}자</dd></div>
    </dl>
  );
}

export default function ToneCorrectionPage({ onClose, onNotify: setNotice }: { onClose: () => void; onNotify: (message: string) => void }) {
  const [tone, setTone] = useState(tones[0]);
  const [draft, setDraft] = useState<string>();
  const editor = useContext(EditorStatusContext)?.latestStatus;
  const text = draft ?? editor?.text ?? "";
  const [result, setResult] = useState<CorrectionResult>();
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const [loading, setLoading] = useState(false);
  const [inserting, setInserting] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => { if (result) resultHeading.current?.focus(); }, [result]);

  function selectTone(value: string) {
    setTone(value);
    setNotice("");
  }

  function moveToneFocus(event: KeyboardEvent<HTMLInputElement>) {
    const { key, currentTarget } = event;
    const horizontal = key === "ArrowRight" || key === "ArrowLeft";
    if ((!horizontal && key !== "ArrowDown" && key !== "ArrowUp") || event.nativeEvent.isComposing) return;
    if (loading || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const list = currentTarget.closest(".tone-options-list");
    const current = currentTarget.closest("label");
    if (!list || !current) return;
    event.preventDefault();

    const bounds = current.getBoundingClientRect();
    const center = bounds.left + bounds.width / 2;
    const forward = key === "ArrowRight" || key === "ArrowDown";
    const direction = forward ? 1 : -1;
    const candidates = Array.from(list.querySelectorAll<HTMLLabelElement>(".tone-option")).map((label) => {
      const rect = label.getBoundingClientRect();
      return {
        label,
        x: direction * (rect.left + rect.width / 2 - center),
        y: direction * (rect.top - bounds.top),
      };
    });
    const next = horizontal
      ? candidates.filter(({ x, y }) => y === 0 && x > 0).sort((a, b) => a.x - b.x)[0]
      : candidates.filter(({ y }) => y > 0).sort((a, b) => a.y - b.y || Math.abs(a.x) - Math.abs(b.x))[0];
    const input = next?.label.querySelector("input");
    if (input) {
      input.focus();
      selectTone(input.value);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || result) return;
    if (!text.trim()) return;
    if (!editor) {
      setNotice("메일 작성 창을 열어주세요.");
      return;
    }
    pending.current = true;
    setLoading(true);
    setNotice("");
    try {
      const response = await sendMessage({
        src: "PAGE",
        dst: "BACKGROUND",
        method: "POST",
        path: "/ai/tone-correction",
        data: { vendorName: editor.vendorName, tone, text },
      });
      if (response?.statusCode !== 200) {
        throw new Error(response?.data?.msg ?? "톤 교정 요청을 보내지 못했습니다. 다시 시도해주세요.");
      }
      if (typeof response.data?.text !== "string" || !response.data.text.trim()) {
        throw new Error("교정 결과를 받지 못했습니다. 다시 시도해주세요.");
      }
      if (mounted.current) setResult({ source: text, text: response.data.text, tone });
    } catch (error) {
      if (mounted.current) setNotice(error instanceof Error ? error.message : "톤 교정 요청에 실패했습니다.");
    } finally {
      pending.current = false;
      if (mounted.current) setLoading(false);
    }
  }

  function editSource() {
    if (!result) return;
    setDraft(result.source);
    setResult(undefined);
    setNotice("");
  }

  async function copyResult() {
    if (!result) return;
    try {
      await window.navigator.clipboard.writeText(result.text);
      if (mounted.current) setNotice("교정 결과를 복사했습니다.");
    } catch {
      if (mounted.current) setNotice("복사하지 못했습니다. 교정 결과를 직접 선택해 복사해주세요.");
    }
  }

  return (
    <section className="tone-page" aria-labelledby="tone-title">
      <header className="tone-header">
        <button type="button" className="icon-button tone-close" aria-label={result ? "교정 입력으로 돌아가기" : "템플릿 목록으로 돌아가기"} disabled={inserting} onClick={result ? editSource : onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 5-7 7 7 7" />
          </svg>
        </button>
        <h1 id="tone-title">AI 톤 교정</h1>
      </header>
      {result ? (
        <div className="tone-form tone-result">
          <section className="tone-applied" aria-labelledby="tone-applied-title">
            <h2 id="tone-applied-title" ref={resultHeading} tabIndex={-1}>적용 문체</h2>
            <span className="tone-chip tone-chip-selected">{result.tone.replace("/", " / ")}</span>
          </section>
          <section className="tone-writing" aria-labelledby="tone-source-title">
            <h2 id="tone-source-title">원문</h2>
            <p className="tone-result-box">{result.source}</p>
            <CharacterCounts text={result.source} />
          </section>
          <section className="tone-writing" aria-labelledby="tone-result-title">
            <h2 id="tone-result-title">교정 결과</h2>
            <p id="tone-result" className="tone-result-box tone-result-text">{result.text}</p>
            <div className="tone-result-meta">
              <CharacterCounts text={result.text} />
              <button type="button" className="tone-retry" disabled={inserting} onClick={editSource}>다시 교정하기</button>
            </div>
          </section>
          <div className="tone-footer tone-result-actions">
            <button type="button" className="tone-copy" disabled={inserting} onClick={() => void copyResult()}>복사</button>
            <InsertBodyButton
              onNotify={setNotice}
              text={result.text}
              disabled={inserting || !editor?.isEditable}
              title={editor?.isEditable ? undefined : "메일 작성 창을 열어주세요."}
              label={inserting ? "삽입 중…" : "메일 본문에 삽입"}
              onPendingChange={setInserting}
            />
          </div>
        </div>
      ) : (
        <form className="tone-form" onSubmit={submit} noValidate aria-busy={loading}>
          <fieldset className="tone-options" disabled={loading}>
            <legend>문체 선택</legend>
            <div className="tone-options-list">
              {tones.map((item) => (
                <label className="tone-option" key={item}>
                  <input type="radio" name="tone" value={item} checked={tone === item} onChange={() => selectTone(item)} onKeyDown={moveToneFocus} />
                  <span className="tone-chip">{item.replace("/", " / ")}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="tone-writing">
            <label htmlFor="tone-text">원문</label>
            <textarea
              id="tone-text"
              placeholder="교정할 문장을 입력해 주세요."
              value={text}
              readOnly={loading}
              onInput={(event) => setDraft(event.currentTarget.value)}
            />
            <CharacterCounts text={text} />
          </div>
          <p className="tone-progress" role="status">{loading ? "톤 교정 요청 중입니다. 잠시만 기다려주세요." : ""}</p>
          <div className="tone-footer">
            <button type="submit" disabled={loading || !text.trim()}>
              {loading && <span className="tone-spinner" aria-hidden="true" />}
              {loading ? "교정 중…" : "톤 교정하기"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
