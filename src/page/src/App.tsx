import { useEffect, useRef, useState } from "react";
import { sendMessage } from "./common/sendMessage";
import { getProxyUrl, generate } from "./common/email-ai";
import "./App.css";

type Template = {
  id: string;
  name: string;
  text: string;
  command?: string;
  savedAt?: string;
};
const STORAGE_KEY = "snip.savedTemplates";
function App() {
  const [tab, setTab] = useState<"write" | "templates">("templates");
  const [language, setLanguage] = useState("ko");
  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [name, setName] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [catalog, setCatalog] = useState<Template[]>([]);
  const [query, setQuery] = useState("");
  let configurationError = "";
  try {
    getProxyUrl();
  } catch (error) {
    configurationError =
      error instanceof Error ? error.message : "AI 서버 설정을 확인해주세요.";
  }
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await sendMessage({
          src: "PAGE",
          dst: "BACKGROUND",
          path: "/editor/templates",
          method: "GET",
          data: {},
        });
        if (alive && res?.statusCode === 200) setCatalog(res.data.templates);
      } catch {
        if (alive)
          setNotice(
            "템플릿을 불러오지 못했습니다. 확장 프로그램에서 다시 열어주세요.",
          );
      }
    }
    void load();
    return () => {
      alive = false;
      controller.current?.abort();
    };
  }, []);

  async function run() {
    if (busy || !senderName.trim() || !recipientName.trim() || !input.trim())
      return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setNotice("");
    try {
      const text = await generate(
        { language },
        { senderName, recipientName, details: input },
        abort.signal,
        setStage,
      );
      if (!abort.signal.aborted) {
        setResult(text);
        setNotice("완료되었습니다. 결과를 확인하고 사용해주세요.");
      }
    } catch (error) {
      setNotice(
        abort.signal.aborted
          ? "생성을 중단했습니다."
          : error instanceof Error
            ? error.message
            : "AI 실행에 실패했습니다.",
      );
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("복사했습니다.");
    } catch {
      setNotice("복사하지 못했습니다. 텍스트를 직접 선택해 복사해주세요.");
    }
  }
  async function insert(text: string) {
    const res = await sendMessage({
      src: "PAGE",
      dst: "BACKGROUND",
      path: "/editor/insert-text",
      method: "PUT",
      data: { text },
    });
    setNotice(
      res?.statusCode === 200
        ? "메일 본문에 적용했습니다."
        : "Gmail 또는 네이버 메일의 작성 창을 열고 다시 시도해주세요.",
    );
  }
  async function save() {
    const text = result.trim()
      ? result
      : `보내는이: ${senderName.trim()}\n받는이: ${recipientName.trim()}\n\n상세 본문 관련 내용:\n${input.trim()}`;
    if (!text.trim() || !name.trim()) return;
    const next = [
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        text,
        savedAt: new Date().toISOString(),
      },
      ...templates,
    ];
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
      setTemplates(next);
      setName("");
      setNotice("템플릿을 저장했습니다.");
    } catch {
      setNotice("템플릿 저장에 실패했습니다.");
    }
  }
  return (
    <main className="sidebar">
      <header>
        <div className="brand-mark" aria-hidden="true">
          S
        </div>
        <div>
          <h1>Snip Text</h1>
          <p>메일 작성을 돕는 AI 글쓰기 도우미</p>
        </div>
        <span className="local-badge">SERVER API</span>
      </header>
      <nav aria-label="작업 선택">
        {(
          [
            ["templates", "템플릿"],
            ["write", "AI 생성"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={tab === value}
            disabled={busy}
            onClick={() => {
              setTab(value);
              setNotice("");
            }}>
            {label}
          </button>
        ))}
      </nav>
      {tab === "write" ? (
        <>
          <section className="intro">
            <h2>메모를 완성된 메일로</h2>
            <p>
              보내는이와 받는이, 상세 본문을 입력해주세요. AI가 요약과 본문을
              작성하고, 인사와 이름 소개를 붙여 메일을 완성합니다.
            </p>
          </section>
          <div className="settings">
            <label>
              결과 언어
              <select
                disabled={busy}
                value={language}
                onChange={(e) => {
                  setNotice("");
                  setLanguage(e.target.value);
                  setResult("");
                }}>
                <option value="ko">한국어</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
          <div className="ai-status" role="status">
            <span className={configurationError ? "dot" : "dot ready"} />
            {configurationError || "서버 API 사용"}
          </div>
          <label className="text-label">
            보내는이
            <input
              value={senderName}
              disabled={busy}
              onChange={(e) => {
                setSenderName(e.target.value);
                setResult("");
              }}
              maxLength={100}
              required
              placeholder="이름 (예: 홍길동)"
            />
          </label>
          <label className="text-label">
            받는이
            <input
              value={recipientName}
              disabled={busy}
              onChange={(e) => {
                setRecipientName(e.target.value);
                setResult("");
              }}
              maxLength={100}
              required
              placeholder="이름 또는 호칭 (예: 김담당님, 교수님)"
            />
          </label>
          <label className="text-label">
            상세 본문 관련 내용
            <span>한국어로 입력해도 선택한 결과 언어로 작성합니다.</span>
            <textarea
              rows={8}
              required
              value={input}
              disabled={busy}
              onChange={(e) => {
                setInput(e.target.value);
                setResult("");
              }}
              maxLength={4000}
              placeholder="예: 다음 주 미팅 일정 확인 요청. 가능한 시간을 회신받고 싶어요."
            />
          </label>
          <div className="actions">
            <button
              className="primary"
              disabled={
                busy ||
                !senderName.trim() ||
                !recipientName.trim() ||
                !input.trim() ||
                !!configurationError
              }
              onClick={() => void run()}>
              {busy ? stage || "AI 작성 중…" : "메일 생성하기"}
            </button>
            {busy && (
              <button onClick={() => controller.current?.abort()}>중단</button>
            )}
          </div>
          <div className="help">
            <p>메일 생성을 위해 입력한 이름과 본문을 AI 서버로 전송합니다.</p>
          </div>
          <section className="result">
            <h2>결과</h2>
            <label className="sr-only" htmlFor="result">
              수정 가능한 AI 결과
            </label>
            <textarea
              id="result"
              rows={8}
              value={result}
              disabled={busy}
              onChange={(e) => setResult(e.target.value)}
              placeholder="AI 결과가 여기에 표시됩니다. 직접 수정할 수도 있어요."
            />
            <div className="actions">
              <button
                disabled={!result.trim() || busy}
                onClick={() => void copy(result)}>
                복사
              </button>
              <button
                disabled={!result.trim() || busy}
                onClick={() => void insert(result)}>
                메일 본문에 적용
              </button>
            </div>
          </section>
          <section className="save">
            <h2>템플릿으로 보관</h2>
            <p>결과가 있으면 결과를, 없으면 입력한 원문을 저장합니다.</p>
            <label className="sr-only" htmlFor="template-name">
              템플릿 이름
            </label>
            <div className="actions">
              <input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="템플릿 이름"
                maxLength={100}
              />
              <button
                disabled={busy || !name.trim() || !(result || input).trim()}
                onClick={() => void save()}>
                저장
              </button>
            </div>
          </section>
        </>
      ) : (
        <section className="templates">
          <h2>
            나의 템플릿 <span>{templates.length}</span>
          </h2>
          <p>이전에 저장한 내용을 다시 사용하세요.</p>
          <label className="sr-only" htmlFor="search">
            템플릿 검색
          </label>
          <input
            id="search"
            type="search"
            placeholder="이름, 내용 또는 단축어 검색 (예: /1)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!templates.length && (
            <div className="empty">
              아직 저장한 템플릿이 없습니다.
              <br />
              AI 작업 화면에서 원문이나 결과를 저장해보세요.
            </div>
          )}
          {[
            { label: "저장한 템플릿", items: templates },
            { label: "기본 템플릿", items: catalog },
          ].map((group) => (
            <div key={group.label}>
              <h3>{group.label}</h3>
              {group.items
                .filter((item) =>
                  `${item.name} ${item.text} ${item.command ?? ""}`
                    .toLowerCase()
                    .includes(query.trim().toLowerCase()),
                )
                .map((item) => (
                  <article key={item.id}>
                    <h4>{item.name}</h4>
                    {item.savedAt && (
                      <time>
                        {new Date(item.savedAt).toLocaleDateString("ko-KR")}
                      </time>
                    )}
                    <pre>{item.text}</pre>
                    <div className="actions">
                      <button onClick={() => void copy(item.text)}>복사</button>
                    </div>
                  </article>
                ))}
            </div>
          ))}
        </section>
      )}
      <p className="notice" role="status" aria-live="polite">
        {notice}
      </p>
      <footer>
        AI 처리는 기기에서 실행됩니다.
        <br />
        저장한 템플릿은 이 브라우저에 보관됩니다.
      </footer>
    </main>
  );
}
export default App;
