import { pageConfig } from "../config";
import "./LoginPage.css";

export default function LoginPage({ onShowTemplates }: { onShowTemplates: () => void }) {
  return (
    <section className="login-page" aria-labelledby="login-heading">
      <div className="login-content">
        <div className="login-logo" aria-hidden="true">S</div>
        <div className="login-intro">
          <h1 id="login-heading">저장한 문장, 간편하게 쓰세요</h1>
          <p>저장한 템플릿을<br />웹 입력창에서 단축어로 불러올 수 있어요</p>
        </div>
        <a className="login-button" href={pageConfig.dashboardUrl} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
            <path fill="#4285f4" d="M43.6 24.5c0-1.4-.1-2.7-.4-4H24v7.6h11a9.4 9.4 0 0 1-4.1 6.1v5h6.5c3.8-3.5 6.2-8.6 6.2-14.7Z" />
            <path fill="#34a853" d="M24 44c5.5 0 10.1-1.8 13.4-4.8l-6.5-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.9v5.2A20 20 0 0 0 24 44Z" />
            <path fill="#fbbc05" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.9a20 20 0 0 0 0 18l6.7-5.2Z" />
            <path fill="#ea4335" d="M24 11.8c3 0 5.6 1 7.7 3l5.8-5.8A19.2 19.2 0 0 0 24 4 20 20 0 0 0 5.9 15l6.7 5.2c1.6-4.8 6.1-8.4 11.4-8.4Z" />
          </svg>
          Google 로그인
        </a>
        <a className="login-button" href={pageConfig.dashboardUrl} target="_blank" rel="noopener noreferrer">
          <span className="naver-login-mark" aria-hidden="true">N</span>
          네이버 로그인
        </a>
        <button type="button" className="login-continue" onClick={onShowTemplates}>템플릿 보기</button>
      </div>
    </section>
  );
}
