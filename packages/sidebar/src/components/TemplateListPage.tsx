import { getTemplateVariables } from "../common/template-content";
import { formatShortcut, searchTemplates } from "../common/template-search";
import TemplateInsertPage from "./TemplateInsertPage";
import InsertBodyButton from "./InsertBodyButton";
import { useContext, useEffect, useRef, useState } from "react";
import { sendMessage } from "../common/message-bus";
import { pageConfig } from "../config";
import EditorStatusTestPanel from "./EditorStatusTestPanel";
import TemplateEmptyState from "./TemplateEmptyState";
import ProfileMenu from "./ProfileMenu";
import { EditorStatusContext } from "../context/editorStatusContext";
import type { Template } from "../core/data-types";

function TemplateListPage({
  onOpenToneCorrection,
  onNotify: setNotice,
  onLogout,
}: {
  onOpenToneCorrection: () => void;
  onNotify: (message: string) => void;
  onLogout?: () => Promise<void>;
}) {
  const editorState = useContext(EditorStatusContext);
  const isEditorEditable = Object.values(editorState?.statuses ?? {}).some(
    (status) => status?.isEditable === true,
  );
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<{ template: Template; action: "copy" | "insert" } | null>(null);

  useEffect(() => {
    let alive = true;
    let generation = 0;
    async function load() {
      const current = ++generation;
      try {
        const response = await sendMessage({
          src: "PAGE",
          dst: "BACKGROUND",
          path: "/template/list",
          method: "GET",
          data: {},
        });
        if (!alive || current !== generation) return;
        if (
          response?.statusCode !== 200 ||
          !Array.isArray(response.data?.templates)
        ) {
          throw new Error("템플릿 조회 실패");
        }
        setTemplates(response.data.templates);
        setLoadFailed(false);
      } catch {
        if (alive && current === generation) {
          setLoadFailed(true);
          setNotice(
            "템플릿을 불러오지 못했습니다. 확장 프로그램에서 다시 열어주세요.",
          );
        }
      } finally {
        if (alive && current === generation) setLoading(false);
      }
    }

    const handleStorageChange = (_changes: unknown, area: string) => {
      if (area === "local") void load();
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    void load();
    return () => {
      alive = false;
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  function openConfiguredPage(address: string, label: string) {
    try {
      const url = new URL(address.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("지원하지 않는 URL입니다.");
      }
      window.open(url.href, "_blank", "noopener,noreferrer");
    } catch {
      setNotice(`${label} URL을 올바른 HTTP 또는 HTTPS 주소로 설정해주세요.`);
    }
  }

  async function copy(item: Template) {
    if (getTemplateVariables(item.content).length) {
      setNotice("");
      setSelectedTemplate({ template: item, action: "copy" });
      return;
    }
    try {
      await navigator.clipboard.writeText(item.content);
      setNotice(`‘${item.title}’ 내용을 복사했어요.`);
    } catch {
      setNotice("복사하지 못했습니다. 텍스트를 직접 선택해 복사해주세요.");
    }
  }

  const visibleTemplates = searchTemplates(templates, query);

  if (selectedTemplate) {
    const close = () => {
      setSelectedTemplate(null);
      setNotice("");
    };
    return (
      <TemplateInsertPage
        onNotify={setNotice}
        key={selectedTemplate.template.templateId}
        template={selectedTemplate.template}
        action={selectedTemplate.action}
        busy={inserting}
        editable={isEditorEditable}
        onClose={close}
        onPendingChange={setInserting}
        onSuccess={() => {
          setInserting(false);
          setSelectedTemplate(null);
          setNotice("본문에 삽입했습니다.");
        }}
        onError={setNotice}
      />
    );
  }

  const noTemplates = !loading && !loadFailed && templates.length === 0;
  const noResults = !loading && templates.length > 0 && visibleTemplates.length === 0;
  const actions = (
    <>
      <button
        type="button"
        className="template-action tone-correction"
        onClick={onOpenToneCorrection}>
        AI 톤 교정
      </button>
      <button
        type="button"
        className="template-action new-template"
        disabled={!pageConfig.newTemplateUrl.trim()}
        title={
          pageConfig.newTemplateUrl.trim()
            ? "새 템플릿 페이지를 새 탭에서 열기"
            : "config.ts에서 새 템플릿 URL을 설정해주세요."
        }
        onClick={() =>
          openConfiguredPage(pageConfig.newTemplateUrl, "새 템플릿")
        }>
        <span aria-hidden="true">＋</span> 새 템플릿
      </button>
    </>
  );

  return (
    <section
      className="templates"
      aria-label="템플릿 목록"
      aria-busy={loading}>
      <header className="template-heading">
        <h1>내 템플릿</h1>
        <ProfileMenu onLogout={onLogout} />
      </header>
      {!noTemplates && (
        <div className="search-field">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="7" />
            <path d="m16 16 5 5" />
          </svg>
          <label className="sr-only" htmlFor="search">
            템플릿 검색
          </label>
          <input
            ref={searchInput}
            id="search"
            type="search"
            placeholder="템플릿 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="search-clear icon-button" type="button" aria-label="검색어 지우기" onClick={() => {
              setQuery("");
              searchInput.current?.focus();
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="m5 5 14 14M19 5 5 19" />
              </svg>
            </button>
          )}
        </div>
      )}
      <div className={noTemplates ? "template-list template-list--no-templates" : "template-list"}>
        {loading ? (
          <p className="empty">템플릿을 불러오는 중입니다.</p>
        ) : noTemplates ? (
          <TemplateEmptyState searching={false}>
            <div className="template-toolbar">{actions}</div>
          </TemplateEmptyState>
        ) : noResults ? (
          <TemplateEmptyState searching />
        ) : loadFailed && !templates.length ? (
          <p className="empty" role="status">템플릿을 불러오지 못했습니다.</p>
        ) : (
          visibleTemplates.map((item) => (
            <article className="template-card" key={item.templateId}>
              <div className="template-card-heading">
                {item.shortcut && (
                  <span className="template-command" title={formatShortcut(item.shortcut)}>{formatShortcut(item.shortcut)}</span>
                )}
                <h2>{item.title}</h2>
              </div>
              <p className="template-preview">{item.content}</p>
              <div className="card-actions">
                <button onClick={() => void copy(item)}>복사</button>
                {getTemplateVariables(item.content).length ? (
                  <button
                    disabled={inserting || !isEditorEditable}
                    onClick={() => {
                      setNotice("");
                      setSelectedTemplate({ template: item, action: "insert" });
                    }}>
                    메일 본문에 삽입
                  </button>
                ) : (
                  <InsertBodyButton
                    onNotify={setNotice}
                    text={item.content}
                    label="메일 본문에 삽입"
                    disabled={!isEditorEditable}
                    beforeInsert={() => !inserting}
                    title={
                      isEditorEditable
                        ? "메일 본문에 삽입"
                        : "메일 작성 창을 열어주세요."
                    }
                    onPendingChange={(value) => {
                      setInserting(value);
                      if (value) setNotice("");
                    }}
                    onSuccess={() => setNotice("본문에 삽입했습니다.")}
                    onError={setNotice}
                  />
                )}
              </div>
            </article>
          ))
        )}
        {import.meta.env?.DEV && <EditorStatusTestPanel />}
      </div>
      {!noTemplates && !noResults && <footer className="template-toolbar">{actions}</footer>}
    </section>
  );
}

export default TemplateListPage;
