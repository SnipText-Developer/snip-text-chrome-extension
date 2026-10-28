import { vendors, type Vendor } from "../config/vendors";
import { useState } from "react";
import "./LoginPage.css";

export default function LoginPage() {
  const [notice, setNotice] = useState("");

  function startLogin(vendor: Vendor) {
    setNotice(`${vendor.name} 로그인은 현재 연동 준비 중입니다.`);
  }

  return (
    <main className="login-page">
      <div className="login-content">
        <div className="login-brand">
          <div className="login-logo" aria-hidden="true">
            M
          </div>
          <h1>SnipText</h1>
        </div>
        <section className="login-intro" aria-labelledby="login-heading">
          <h2 id="login-heading">빠르게 완성하는 나만의 문장</h2>
          <p>템플릿을 만들고 어디서든 불러오세요.</p>
        </section>
        <div className="login-actions" aria-label="로그인 방법 선택">
          {vendors.map((vendor) => (
            <button key={vendor.id} className="login-button" onClick={() => startLogin(vendor)}>
              <span className="login-provider-mark" aria-hidden="true">{vendor.mark}</span>
              <span>{vendor.name}로 시작하기</span>
            </button>
          ))}
        </div>
        <p className="login-terms">
          회원가입 시 SnipText의 이용약관과 개인정보처리방침에 동의하게 됩니다.
        </p>
        <p className="login-notice" role="status" aria-live="polite">
          {notice}
        </p>
      </div>
    </main>
  );
}
