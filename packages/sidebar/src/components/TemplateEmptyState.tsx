import type { ReactNode } from "react";
import "./TemplateEmptyState.css";

export default function TemplateEmptyState({ searching, children }: { searching: boolean; children?: ReactNode }) {
  return (
    <div className="template-empty-state">
      <div role="status">
        <div className="template-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {searching ? (
              <>
                <circle cx="10.5" cy="10.5" r="7.5" />
                <path d="m16 16 5 5" />
              </>
            ) : (
              <path d="M11 4H4v16h16v-7M8 16v-4L17 3l4 4-9 9H8Zm6-10 4 4" />
            )}
          </svg>
        </div>
        <h2>{searching ? "검색 결과가 없어요" : "아직 저장된 템플릿이 없어요"}</h2>
        <p>{searching ? "제목이나 단축어를 바꿔 검색해 보세요." : "자주 쓰는 문장을 첫 템플릿으로 저장해 보세요."}</p>
      </div>
      {children}
    </div>
  );
}
