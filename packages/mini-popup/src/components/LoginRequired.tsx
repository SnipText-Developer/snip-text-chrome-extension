import styles from "./LoginRequired.css?inline";

interface Props {
  googleLogoUrl?: string;
  logoUrl?: string;
  loginUrl?: string;
}

export function LoginRequired({ googleLogoUrl, logoUrl, loginUrl }: Props) {
  return (
    <>
      <style>{styles}</style>
      <header className="login-intro">
        {logoUrl && <img className="login-logo" src={logoUrl} width={64} height={64} alt="" />}
        <h2>저장한 문장, 간편하게 쓰세요</h2>
        <p>저장한 템플릿을<br />웹 입력창에서 단축어로 불러올 수 있어요</p>
      </header>
      {loginUrl && (
        <a className="login-button" href={loginUrl} target="_blank" rel="noopener noreferrer">
          {googleLogoUrl && <img src={googleLogoUrl} width={20} height={20} alt="" />}
          Google 로그인
        </a>
      )}
    </>
  );
}
