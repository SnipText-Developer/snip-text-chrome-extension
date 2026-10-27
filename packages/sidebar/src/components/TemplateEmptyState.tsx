import "./TemplateEmptyState.css";

export default function TemplateEmptyState({ searching }: { searching: boolean }) {
  return (
    <div className="template-empty-state" role="status">
      <div className="template-empty-icon" aria-hidden="true" />
      <h2>{searching ? "검색된 템플릿이 없어요" : "아직 저장된 템플릿이 없어요"}</h2>
      <p>
        {searching
          ? "제목, 본문, 단축어를 입력해보세요"
          : "새로운 템플릿을 생성하여 빠르게 문장을 완성해보세요"}
      </p>
    </div>
  );
}
