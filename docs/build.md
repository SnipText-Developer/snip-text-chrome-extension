# 환경 설정 및 빌드

## 개발 환경

빌드와 테스트를 함께 실행하려면 Node.js 24.15 이상인 24.x 버전과 npm을 사용합니다. 설치된 Vite와 jsdom의 Node.js 요구 사항은 각각 패키지의 `engines`에 정의되어 있습니다. 의존성은 저장소 루트의 `package-lock.json`으로 관리합니다.

```sh
npm ci
npm run build
```

## 빌드 결과

| 명령 | 실행 범위와 결과 |
| --- | --- |
| `npm run build` | mini-popup 번들과 타입 선언 생성, 루트 TypeScript 검사, webpack 빌드, sidebar 빌드 순으로 실행합니다. Chrome에 로드할 확장 프로그램은 `dist/`에 완성됩니다. |
| `npm run build:popup` | `packages/mini-popup/dist/`에 ESM 번들과 타입 선언을 생성합니다. Chrome에서 변경을 확인하려면 전체 빌드로 콘텐츠 스크립트에도 변경을 반영합니다. |
| `npm run build:sidebar` | `packages/sidebar/dist/`에 sidebar를 빌드하고 `dist/src/page/`에 복사합니다. |
| `npm run dev` | sidebar의 Vite 개발 서버를 시작합니다. Chrome 메시지와 메일 편집기 연동은 Chrome에 로드한 확장 프로그램에서 확인합니다. |

webpack은 `public/manifest.json`과 `public/icons/`를 복사하고 background, Gmail, 네이버 메일 스크립트를 번들링합니다. sidebar의 진입 파일은 `dist/src/page/index.html`입니다.

## 설정

| 파일 | 설정 |
| --- | --- |
| `src/config/api.ts` | 운영 API 출처, 로그인과 새 템플릿 URL, 템플릿 조회 URL |
| `packages/sidebar/src/config.ts` | 사이드바에서 여는 대시보드, 로그인과 새 템플릿 URL |
| `src/config/vendors.json` | 메일 호스트, 작성 경로, 편집기 선택자 |
| `public/manifest.json` | 콘텐츠 스크립트의 실행 대상·프레임, API 호스트 권한과 콘텐츠 보안 정책 |

설정을 바꾸면 다시 빌드하고 `chrome://extensions`에서 확장 프로그램을 새로고침합니다. 해당 메일 탭도 새로고침합니다. 다른 템플릿 API 출처를 사용한다면 manifest의 `host_permissions`와 `content_security_policy.extension_pages`의 `connect-src`를 함께 확인합니다. `templatesUrl`을 비워 두면 저장된 목록을 조회할 수 있고 명시적인 새로고침 요청은 400을 반환합니다. [메시지 API](../api.md#background-템플릿)

## 테스트

```sh
node --test tests/*.test.mjs
node --test tests/mini-popup-dom.test.mjs tests/mini-popup.test.mjs
npm run test:insert-text
```

jsdom 테스트는 이벤트·선택 범위와 요청 흐름을 검증합니다. 실제 메일에서의 한글 입력, 커서 위치, 네이버 프레임과 Chrome 실행 취소는 확장 프로그램을 설치한 뒤 확인합니다.

## Chrome 확장 프로그램 압축 및 ID 고정

1. `chrome://extensions`에서 **개발자 모드**를 켜고 **확장 프로그램 압축**을 선택합니다.
2. 확장 프로그램 루트에 빌드 결과인 `dist/`를 지정합니다.
3. 기존 패키지와 같은 ID로 다시 압축하려면 기존과 동일한 PEM 파일을 지정합니다.

PEM 파일은 저장소와 배포 파일 밖에 보관합니다.
