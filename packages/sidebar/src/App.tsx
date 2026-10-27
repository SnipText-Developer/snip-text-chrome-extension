// import LoginPage from "./components/LoginPage";
import EditorStatusTestPanel from "./components/EditorStatusTestPanel";
import TemplateListPage from "./components/TemplateListPage";
import { EditorStatusProvider } from "./context/EditorStatusProvider";
import "./App.css";

function App() {
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
    <EditorStatusProvider>
      <main className="sidebar">
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
              type="button"
              className="icon-button"
              aria-label="로그아웃"
              title="로그아웃 (준비 중)">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true">
                <path d="M10 4H4v16h6M10 12h11m-5-5 5 5-5 5" />
              </svg>
            </button>
            <button className="icon-button" onClick={() => {}}>
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
        <TemplateListPage />
        <EditorStatusTestPanel />
      </main>
    </EditorStatusProvider>
  );
}

export default App;
