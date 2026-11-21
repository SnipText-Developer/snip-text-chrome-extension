import { useContext, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { EditorStatusContext } from "../context/editorStatusContext";
import { sendMessage } from "../common/message-bus";
import "./ToneCorrectionPage.css";

const tones = ["상사/외부용", "보고/공문용", "마케팅/설득", "공지/안내", "부드러운 존댓말", "편한 반말", "감성/에세이"];

export default function ToneCorrectionPage({ onClose, onNotify: setNotice }: { onClose: () => void; onNotify: (message: string) => void }) {
  const [tone, setTone] = useState(tones[0]);
  const [draft, setDraft] = useState<string>();
  const editor = useContext(EditorStatusContext)?.latestStatus;
  const text = draft ?? editor?.text ?? "";
  const characterCount = Array.from(text).length;
  const nonSpaceCount = Array.from(text.replace(/\s/gu, "")).length;
  const [loading, setLoading] = useState(false);
  const [inserting, setInserting] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function selectTone(value: string) {
    setTone(value);
    setNotice("");
  }

  function moveToneFocus(event: KeyboardEvent<HTMLInputElement>) {
    const { key, currentTarget } = event;
    const horizontal = key === "ArrowRight" || key === "ArrowLeft";
    if ((!horizontal && key !== "ArrowDown" && key !== "ArrowUp") || event.nativeEvent.isComposing) return;
    if (loading || inserting || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

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
    if (pending.current) return;
    if (!text.trim()) return;
    if (!editor) {
      setNotice("교정한 문장을 삽입할 메일 작성 창을 열어주세요.");
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
        data: { vendorName: editor.vendorName, tone, ...(draft === undefined ? {} : { text }) },
      });
      if (response?.statusCode !== 200) {
        throw new Error(response?.data?.msg ?? "톤 교정 요청을 보내지 못했습니다. 다시 시도해주세요.");
      }
      if (typeof response.data?.text !== "string" || !response.data.text.trim()) {
        throw new Error("교정 결과를 받지 못했습니다. 다시 시도해주세요.");
      }
      if (!mounted.current) return;
      setLoading(false);
      setInserting(true);
      const insertion = await sendMessage({
        src: "PAGE",
        dst: "BACKGROUND",
        method: "PUT",
        path: "/editor/insert-text",
        data: { text: response.data.text },
      });
      if (insertion?.statusCode !== 200) {
        throw new Error(insertion?.data?.msg ?? "삽입하지 못했습니다. 메일 작성 창을 확인하고 다시 시도해주세요.");
      }
      if (mounted.current) {
        setDraft(undefined);
        setNotice("교정 결과를 본문에 삽입했습니다.");
      }
    } catch (error) {
      if (mounted.current) setNotice(error instanceof Error ? error.message : "톤 교정 요청에 실패했습니다.");
    } finally {
      pending.current = false;
      if (mounted.current) {
        setLoading(false);
        setInserting(false);
      }
    }
  }

  return (
    <section className="tone-page" aria-labelledby="tone-title">
      <header className="tone-header">
        <button type="button" className="icon-button tone-close" aria-label="템플릿 목록으로 돌아가기" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 5-7 7 7 7" />
          </svg>
        </button>
        <h1 id="tone-title">AI 톤 교정</h1>
      </header>
      <form className="tone-form" onSubmit={submit} noValidate aria-busy={loading || inserting}>
        <fieldset className="tone-options" disabled={loading || inserting}>
          <legend>문체 선택</legend>
          <div className="tone-options-list">
            {tones.map((item) => (
              <label className="tone-option" key={item}>
                <input type="radio" name="tone" value={item} checked={tone === item} onChange={() => selectTone(item)} onKeyDown={moveToneFocus} />
                <span>{item.replace("/", " / ")}</span>
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
            readOnly={loading || inserting}
            onInput={(event) => setDraft(event.currentTarget.value)}
          />
          <dl className="tone-counts">
            <div><dt>공백 포함</dt><dd>{characterCount.toLocaleString("ko-KR")}자</dd></div>
            <div><dt>공백 제외</dt><dd>{nonSpaceCount.toLocaleString("ko-KR")}자</dd></div>
          </dl>
        </div>
        <p className="tone-progress" role="status">{loading ? "톤 교정 요청 중입니다. 잠시만 기다려주세요." : inserting ? "본문에 삽입 중입니다." : ""}</p>
        <div className="tone-footer">
          <button type="submit" disabled={loading || inserting || !text.trim()}>
            {loading && <span className="tone-spinner" aria-hidden="true" />}
            {loading ? "교정 중…" : inserting ? "삽입 중…" : "톤 교정하기"}
          </button>
        </div>
      </form>
    </section>
  );
}
