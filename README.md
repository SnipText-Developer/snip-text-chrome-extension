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

현재 목록은 데모 템플릿 4개이며, `src/background/editor/service.ts`의 목록을 `/editor/templates` 메시지로 조회합니다.

템플릿에 `{{변수}}`가 있으면 선택 후 변수 입력 폼이 표시됩니다. 같은 이름의 변수는 한 번만 입력하며, 삽입 버튼 또는 Enter로 값을 반영합니다. 빈 입력값은 빈 문자열로 치환됩니다. 취소하거나 Esc를 누르면 본문은 변경되지 않습니다. `/4` 문의 접수 안내에서 사용할 수 있습니다.

변수 입력 폼의 미리보기는 입력할 때마다 갱신되며, 삽입될 텍스트와 동일한 내용을 줄바꿈과 함께 보여줍니다.

### AI 사이드바

확장 프로그램 아이콘을 클릭하면 AI 메일 생성, 템플릿 화면을 열 수 있습니다.
원문 또는 생성 결과에 이름을 붙여 저장하면 `chrome.storage.local`에 보관되며, 템플릿 화면에서 검색·복사가 가능합니다. 기존 `/editor/templates` 기본 목록도 함께 표시합니다. 결과의 ‘메일 본문에 적용’은 활성 탭의 Gmail/네이버 메일 작성 창에 적용합니다.

AI 생성은 별도 서버의 OpenAI 호환 프록시 API를 사용합니다. 한국어·영어를 선택할 수 있으며, 입력한 이름과 본문은 서버로 전송됩니다. API 키와 모델 선택은 서버에서 관리합니다.

클라이언트는 보내는 사람 이름, 받는 사람 이름 또는 호칭, 상세 본문, 결과 언어만 한 번 전송합니다. 프롬프트 구성과 메일 전체 생성은 서버에서 처리합니다. 클라이언트가 부분별 지시문이나 모델 설정을 추가하지 않습니다. 실패·중단 시 결과를 표시하지 않으며 요청 제한 시간은 3분입니다.

### AI 서버 연결 설정

`src/page/.env.example`을 참고하여 `src/page/.env.local`에 프록시의 전체 URL을 설정한 뒤 빌드합니다.

```dotenv
VITE_AI_PROXY_URL=https://your-server.example/api/chat/completions
```

설정이 없으면 AI 생성 버튼을 비활성화합니다. 템플릿은 서버 설정 없이 사용할 수 있습니다. VITE 환경변수는 번들에 공개되므로 API 키를 넣지 마세요.

프록시는 다음 요청·응답 계약을 구현해야 합니다. 이 저장소에는 프록시 서버 구현이 포함되어 있지 않습니다.

- 요청: 설정한 URL에 `POST`, `Content-Type: application/json`.
- 본문: `{ "senderName": "홍길동", "recipientName": "김담당님", "details": "회의 일정 확인 요청", "language": "ko" }`. 보내는이와 받는이는 줄바꿈 없이 1~100자로 입력하며, 언어는 `ko` 또는 `en`입니다.
- 응답: `{ "choices": [{ "finish_reason": "stop", "message": { "content": "완성된 메일 본문" } }] }`.
- 서버가 입력을 검증하고 프롬프트·모델명·생성 설정·제공업체 API 키를 관리합니다. 클라이언트는 모델명이나 제공업체 키를 전송하지 않습니다.
- 요청은 `credentials: include`로 서버 세션 쿠키를 전달합니다. 서버에서 인증·권한을 검증하고 필요한 CSRF 방어를 적용해야 합니다. 교차 출처 쿠키는 브라우저의 쿠키 정책에 따릅니다.
- 서버는 개발 페이지 또는 `chrome-extension://<확장 프로그램 ID>` 출처에 대해 CORS와 OPTIONS 요청을 처리해야 합니다. 쿠키 인증 사용 시 명시적인 허용 출처와 `Access-Control-Allow-Credentials: true`가 필요합니다.

실제 프록시 URL을 설정한 후 확장 프로그램에서 인증, CORS, 생성·중단 동작을 확인해주세요.
