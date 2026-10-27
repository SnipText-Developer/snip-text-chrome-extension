// import LoginPage from "./components/LoginPage";
import { useState } from "react";
import EditorStatusTestPanel from "./components/EditorStatusTestPanel";
import TemplateListPage from "./components/TemplateListPage";
import "./App.css";

function App() {
  const [compact, setCompact] = useState(false);
  // const [showTemplates, setShowTemplates] = useState(
  //   () => window.location.hash === "#templates",
  // );

  // useEffect(() => {
  //   const handleHashChange = () =>
  //     setShowTemplates(window.location.hash === "#templates");
  //   window.addEventListener("hashchange", handleHashChange);
  //   return () => window.removeEventListener("hashchange", handleHashChange);
  // }, []);

  // if (!showTemplates) return <LoginPage />;

  return (
    <main className={`sidebar${compact ? " compact" : ""}`}>
      <header className="profile-header">
        <div className="profile-avatar" aria-hidden="true">
          스
        </div>
        <div className="profile-info">
          <h1>Snip Text</h1>
          <p>나의 템플릿 라이브러리</p>
        </div>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label={compact ? "넓은 카드로 보기" : "간결한 카드로 보기"}
            aria-pressed={compact}
            title="카드 보기 전환"
            onClick={() => setCompact((previous) => !previous)}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true">
              <rect x="3" y="3" width="7" height="18" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </button>
        </div>
      </header>
      <EditorStatusTestPanel />
      <TemplateListPage />
    </main>
  );
}

export default App;
