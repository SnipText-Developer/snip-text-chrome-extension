# Chrome Extension

Chrome 브라우저에서 동작하는 확장 프로그램입니다.

## 요구 사항

Google Chrome

Node.js 20.x 이상

npm 10.x 이상

## 실행방법

### sh

```sh
git clone https://github.com/j93es/snip-text-chrome-extension.git
cd snip-text-chrome-extension

npm install
npm run build
```

빌드가 완료되면 dist/ 디렉터리에 확장 프로그램을 설치할 수 있는 결과물이 생성됩니다.

project/
├── src/ # 확장 프로그램 소스 코드
├── public/ # 정적 리소스 및 manifest 등
├── dist/ # 빌드 결과물
├── package.json
└── README.md

## Chrome에 설치

빌드가 완료된 후 Chrome에서 다음 순서로 확장 프로그램을 설치합니다.

1. Chrome에서 chrome://extensions를 엽니다.

2. 우측 상단의 개발자 모드를 활성화합니다.

3. 압축해제된 확장 프로그램을 로드를 선택합니다.

4. 프로젝트의 dist/ 디렉터리를 선택합니다.

5. 확장 프로그램이 목록에 표시되는지 확인합니다.

6. 코드를 수정한 경우, 다시 빌드한 후 Chrome 확장 프로그램 관리 화면에서 업데이트 버튼을 눌러 변경 사항을 반영합니다.

## 스마트 템플릿 선택

Gmail 또는 네이버 메일 본문에서 `/`를 입력하면 커서 아래에 작은 템플릿 목록이 표시됩니다. 아래 공간이 부족하면 위에 표시됩니다. `/` 뒤에 이름이나 번호를 입력해 검색하고, 마우스 클릭 또는 ↑↓와 Enter로 선택하세요. Esc로 닫을 수 있습니다. 선택 시 `/검색어`만 템플릿 내용으로 바뀌고 나머지 본문은 유지됩니다.

템플릿 목록은 `src/background/template/repository.ts`에서 관리하며, 사이드바와 메일 단축어 팝업이 `GET /template/list` 메시지로 조회합니다.

템플릿에 `{{변수}}`가 있으면 선택 후 변수 입력 폼이 표시됩니다. 같은 이름의 변수는 한 번만 입력하며, 삽입 버튼 또는 Enter로 값을 반영합니다. 빈 입력값은 빈 문자열로 치환됩니다. 취소하거나 Esc를 누르면 본문은 변경되지 않습니다. `/4` 문의 접수 안내에서 사용할 수 있습니다.

변수 입력 폼의 미리보기는 입력할 때마다 갱신되며, 삽입될 텍스트와 동일한 내용을 줄바꿈과 함께 보여줍니다.

### 템플릿 사이드바

확장 프로그램 아이콘을 클릭하면 템플릿 화면을 열 수 있습니다.
background에서 조회한 템플릿을 표시하며, 이름·내용·단축어로 검색하고 내용을 복사할 수 있습니다. 각 템플릿의 ‘메일 본문에 삽입’ 버튼으로 활성 탭의 Gmail 또는 네이버 메일 작성 창에 내용을 넣을 수 있습니다.

### 템플릿 수정

page에서 `PUT /template/replace` 메시지를 background로 보내면 templateId에 해당하는 템플릿 전체를 덮어씁니다.

```ts
await sendMessage({
  src: "PAGE",
  dst: "BACKGROUND",
  method: "PUT",
  path: "/template/replace",
  data: {
    templateId: 1, title: "일정 안내", shortcut: "/일정", content: "회의 일정을 안내드립니다.",
    variables: [], lastUsedAt: "2026-10-07T09:12:00+09:00",
    createdAt: "2026-09-20T14:03:00+09:00", editedAt: "2026-10-01T11:40:00+09:00",
  },
});
```

`templateId`(양의 정수), `title`, `shortcut`, `content`, `variables`, `lastUsedAt`, `createdAt`, `editedAt`를 모두 전달해야 합니다. 변수 배열은 본문의 `{{변수}}`와 일치해야 하며, 날짜는 시간대가 포함된 ISO 8601 문자열입니다. 필드가 빠진 요청은 거부하며, 기존 필드와 병합하지 않습니다. 이름·단축어·본문은 비워둘 수 없으며, 단축어는 중복 없이 `/`로 시작하고 공백을 포함하지 않아야 합니다. 수정 내용은 background가 `chrome.storage.local`에 보관합니다.

성공 시 `200 { template }`, 잘못된 입력은 `400`, 허용되지 않은 발신자의 요청은 응답 없이 무시하며, 없는 ID는 `404`, 저장 실패는 `500`을 반환합니다.
검증: `node --test tests/template.test.mjs`.

### 인증 토큰 CRUD

background auth는 토큰 생성·조회·수정·삭제만 담당합니다. OAuth 로그인·토큰 교환·프로필 조회는 포함하지 않습니다.

확장 프로그램 page에서 `/auth/token` 경로를 사용합니다.

- POST: `{ vendor, token, expiresAt? }`로 생성. 이미 있으면 400.
- GET: `{ vendor }`로 조회. 복호화한 `{ vendor, token }` 반환. 없으면 404.
- PUT: `{ vendor, token, expiresAt? }`로 기존 토큰 교체. 없으면 404.
- DELETE: `{ vendor }`로 삭제. `{ deleted }` 반환.

vendor는 `google` 또는 `naver`입니다. 허용되지 않은 발신자는 응답 없이 무시합니다. 조회 응답에 토큰이 포함되므로 content script로 전달하지 마세요.

토큰은 메모리에 AES-256-GCM 암호문으로 보관합니다. webpack 빌드 시 암호학적 32바이트 난수 키를 생성하여 `auth/config.ts`의 `encryptionKeyHex`에 주입합니다. 빌드마다 새 키를 사용합니다. 암호화·복호화는 `token-crypto.ts`에서 처리합니다. 고정 키는 번들에 포함되어 사용자가 확인할 수 있습니다.

만료 시각은 epoch 밀리초이며, 지정하지 않으면 최대 5분 보관합니다. 더 짧은 만료 시각을 지정할 수 있습니다. 만료·워커 종료 시 제거되며 자동 갱신하지 않습니다.

기존 저장 템플릿은 조회 시 새 스키마로 변환합니다. 과거 날짜 정보가 없는 경우 `1970-01-01T00:00:00.000Z`를 사용합니다. 사이드바는 background에서 받은 순서대로 템플릿을 표시합니다.

새 템플릿 버튼의 이동 주소는 `packages/sidebar/src/config.ts`의 `pageConfig.newTemplateUrl`에 전체 HTTP(S) URL로 지정합니다. 설정 후 다시 빌드하면 버튼 클릭 시 현재 페이지가 해당 URL로 이동합니다. 주소가 비어 있으면 버튼을 비활성화합니다.

### React 템플릿 팝업

콘텐츠 스크립트의 `packages/template-popup/src/index.ts`는 닫힌 Shadow DOM과 React root만 생성합니다. `useTemplatePopup`이 React 상태·메시지 조회·키보드·포커스 이벤트를 관리하고, `usePopupPosition`이 위치 계산과 스크롤·리사이즈 이벤트를 처리합니다. `TemplatePopup.tsx`, `TemplateList.tsx`, `TemplateVariablesForm.tsx`가 UI를 담당합니다. 스타일은 `styles/popup.css`를 문자열로 번들에 포함해 React의 `<style>`로 Shadow DOM에 적용합니다. `useEditor`가 React ref와 콜백으로 커서·삽입·포커스 복원을 관리하고, `utils/text.ts`는 변수 추출과 공백 처리를 담당합니다.

팝업 키 이벤트는 React 처리 후 메일 페이지로의 전파를 차단합니다. 테스트는 `node --test tests/template-popup.test.mjs`로 실행하며 목록 선택, 변수 입력, 한글 조합 입력, 취소와 비동기 응답 경합, 언마운트 후 리스너 정리를 확인합니다.


### template-popup 패키지

`packages/template-popup`은 독립 React 패키지 `@snip-text/template-popup`입니다. Chrome API 호출은 사용처에서 주입합니다. `npm run build:popup`으로 ESM 번들과 타입 선언을 생성하며, 전체 `npm run build`에서도 먼저 빌드합니다.

```ts
import { startPopup } from "@snip-text/template-popup";

const stopPopup = startPopup({
  selector: '[contenteditable="true"]',
  getTemplates: async () => templates,
});

// 팝업, React root, 이벤트 리스너 정리
stopPopup();
```

React와 React DOM은 peer dependency입니다. 스타일은 번들에 포함되어 별도 CSS 로딩 없이 Shadow DOM 내부에 적용됩니다. 외부 npm 레지스트리에 배포하지 않은 로컬 workspace 패키지입니다.


### 사이드바 패키지

사이드바 React 앱은 `packages/sidebar`의 npm workspace 패키지 `@snip-text/sidebar`에서 관리합니다. 개발은 `npm run dev`, 린트는 `npm --workspace @snip-text/sidebar run lint`, 빌드는 `npm run build:sidebar`를 사용합니다. 전체 빌드에도 포함됩니다.

사이드바의 결과물은 확장 프로그램의 기존 `dist/src/page/`에 복사합니다. manifest의 사이드바 경로와 background의 PAGE 발신자 검증 URL은 그대로 사용합니다. 의존성은 루트 `package-lock.json`으로 관리합니다.

템플릿 복사·메일 삽입에 성공하면 `PUT /template/use`에 `{ templateId }`를 보내 `lastUsedAt`을 갱신합니다. `editedAt`은 유지합니다. 단축어 팝업도 `startPopup`의 `onInserted` 콜백으로 같은 경로를 호출합니다. 사이드바는 저장소 변경 시 background에서 목록을 다시 조회하여 정렬을 반영합니다.

사이드바 검색창 아래에는 ‘AI 톤교정’, ‘새 템플릿’ 버튼을 표시합니다. 이동 주소는 `packages/sidebar/src/config.ts`의 `toneCorrectionUrl`, `newTemplateUrl`에 지정하며, 설정하지 않은 버튼은 비활성화합니다.

사이드바에서 `{{변수}}`가 있는 템플릿의 삽입 버튼을 누르면 변수 입력 화면을 표시합니다. 본문의 변수명을 중복 없이 추출하고 미리보기를 실시간 갱신합니다. ‘메일 본문에 삽입’으로 치환된 본문을 삽입하며 빈 입력값은 빈 문자열로 처리합니다. 닫기·Esc는 삽입 없이 목록으로 돌아가며, 실패 시 입력값을 유지합니다. 에디터가 입력 불가 상태이면 삽입 버튼도 비활성화됩니다.
