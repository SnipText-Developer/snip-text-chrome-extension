import { vendors } from "../config/vendors";
import { getTemplateVariables } from "../common/template-content";
import TemplateInsertPage from "./TemplateInsertPage";
import { useContext, useEffect, useState } from "react";
import { sendMessage } from "../common/sendMessage";
import { pageConfig } from "../config";
import TemplateEmptyState from "./TemplateEmptyState";
import { EditorStatusContext } from "../context/editorStatusContext";
import type { Template } from "../core/data-types";

function TemplateListPage() {
  const editorState = useContext(EditorStatusContext);
  const isEditorEditable = Object.values(editorState?.statuses ?? {}).some(
    (status) => status?.isEditable === true,
  );
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [inserting, setInserting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );

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
      } catch {
        if (alive)
          setNotice(
            "템플릿을 불러오지 못했습니다. 확장 프로그램에서 다시 열어주세요.",
          );
      } finally {
        if (alive) setLoading(false);
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
      window.location.assign(url.href);
    } catch {
      setNotice(`${label} URL을 올바른 HTTP 또는 HTTPS 주소로 설정해주세요.`);
    }
  }

  async function copy(item: Template) {
    try {
      await navigator.clipboard.writeText(item.content);
      setNotice("복사했습니다.");
    } catch {
      setNotice("복사하지 못했습니다. 텍스트를 직접 선택해 복사해주세요.");
    }
  }

  async function insert(item: Template, content = item.content) {
    if (inserting || !isEditorEditable) return;
    setInserting(true);
    setNotice("");
    try {
      const response = await sendMessage({
        src: "PAGE",
        dst: "BACKGROUND",
        path: "/editor/insert-text",
        method: "PUT",
        data: { text: content },
      });
      if (response?.statusCode === 200) {
        setSelectedTemplate(null);
      } else {
        setNotice(`${vendors.map((vendor) => vendor.mailName).join(" 또는 ")}의 작성 창을 열고 다시 시도해주세요.`);
      }
    } catch {
      setNotice(
        "삽입하지 못했습니다. 메일 작성 창을 확인하고 다시 시도해주세요.",
      );
    } finally {
      setInserting(false);
    }
  }

  function requestInsert(item: Template) {
    if (inserting || !isEditorEditable) return;
    setNotice("");
    if (getTemplateVariables(item.content).length) setSelectedTemplate(item);
    else void insert(item);
  }

  const visibleTemplates = templates.filter((item) =>
    `${item.title} ${item.content} ${item.shortcut ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  if (selectedTemplate) {
    return (
      <TemplateInsertPage
        key={selectedTemplate.templateId}
        template={selectedTemplate}
        busy={inserting}
        editable={isEditorEditable}
        notice={notice}
        onClose={() => {
          setSelectedTemplate(null);
          setNotice("");
        }}
        onInsert={(content) => void insert(selectedTemplate, content)}
      />
    );
  }

  return (
    <>
      <section
        className="templates"
        aria-label="템플릿 목록"
        aria-busy={loading}>
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
            id="search"
            type="search"
            placeholder="템플릿 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="template-toolbar">
          <button
            type="button"
            className="template-action tone-correction"
            disabled={!pageConfig.toneCorrectionUrl.trim()}
            title={
              pageConfig.toneCorrectionUrl.trim()
                ? "AI 톤교정 페이지로 이동"
                : "config.ts에서 AI 톤교정 URL을 설정해주세요."
            }
            onClick={() =>
              openConfiguredPage(pageConfig.toneCorrectionUrl, "AI 톤교정")
            }>
            AI 톤교정
          </button>
          <button
            className="template-action new-template"
            disabled={!pageConfig.newTemplateUrl.trim()}
            title={
              pageConfig.newTemplateUrl.trim()
                ? "새 템플릿 페이지로 이동"
                : "config.ts에서 새 템플릿 URL을 설정해주세요."
            }
            onClick={() =>
              openConfiguredPage(pageConfig.newTemplateUrl, "새 템플릿")
            }>
            <span aria-hidden="true">＋</span> 새 템플릿
          </button>
        </div>
        <div className="template-list">
          {loading ? (
            <p className="empty">템플릿을 불러오는 중입니다.</p>
          ) : !visibleTemplates.length ? (
            <TemplateEmptyState searching={Boolean(query.trim())} />
          ) : (
            visibleTemplates.map((item) => (
              <article className="template-card" key={item.templateId}>
                {item.shortcut && (
                  <p className="template-command">{item.shortcut}</p>
                )}
                <h2>{item.title}</h2>
                <p className="template-preview">{item.content}</p>
                <div className="card-actions">
                  <button onClick={() => void copy(item)}>복사</button>
                  <button
                    disabled={!isEditorEditable}
                    title={
                      isEditorEditable
                        ? "메일 본문에 삽입"
                        : "메일 작성 창을 열어주세요."
                    }
                    onClick={() => requestInsert(item)}>
                    메일 본문에 삽입
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
      <p className="notice" role="status" aria-live="polite">
        {notice}
      </p>
    </>
  );
}

export default TemplateListPage;
