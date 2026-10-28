# 확장 프로그램 메시지 API 명세

이 API는 HTTP가 아닌 Chrome 확장 프로그램 메시지입니다. `method`, `path`, `statusCode`는 메시지 데이터의 필드입니다. PAGE·CONTENT에서 BACKGROUND로 보내는 요청은 `chrome.runtime.sendMessage`를 사용하고, BACKGROUND에서 CONTENT로 전달할 때는 `chrome.tabs.sendMessage`를 사용합니다.

## 공통 형식

```ts
type MessageSource = "PAGE" | "CONTENT" | "BACKGROUND";
type VendorName = "GOOGLE" | "NAVER";

interface MessageRequest {
  src: MessageSource;
  dst: MessageSource;
  method: "GET" | "POST" | "PUT" | "DELETE"; // 현재 아래 API에서 사용하는 메서드
  path: string;
  data: unknown;
}

interface MessageResponse<T> {
  statusCode: number;
  data: T;
}

interface ErrorData {
  msg: string;
}

interface EditorStatus {
  isEditable: boolean;
  text: string;
  prevTexts: string[];
  vendorName: VendorName;
}

interface Template {
  templateId: number;
  title: string;
  shortcut: string;
  content: string;
  variables: string[];
  lastUsedAt: string;
  createdAt: string;
  editedAt: string;
}

interface AuthToken {
  vendor: VendorName;
  token: string;
}
```

`vendor`는 인증 API, `vendorName`은 editor API의 필드입니다. 서로 바꿔 사용할 수 없습니다.

### 호출자 검증

BACKGROUND는 `req.src`뿐 아니라 실제 `chrome.runtime.MessageSender`를 검사합니다.

| 호출자  | 허용 조건                                                                                                                                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PAGE    | `src: "PAGE"`, 같은 확장 프로그램 ID, `sender.tab` 없음, `sender.url === chrome.runtime.getURL("src/page/index.html")`                                                                                                                                  |
| CONTENT | `src: "CONTENT"`, 같은 확장 프로그램 ID, 탭 ID 존재, HTTPS의 `mail.google.com` 또는 `mail.naver.com`에서 보낸 메시지. `about:blank`·`about:srcdoc`은 `frameId > 0`인 하위 프레임이며 Chrome의 `sender.origin`이 등록된 HTTPS 메일 도메인인 경우만 허용합니다. `blob:`·`data:`·`filesystem:`은 거부 |

BACKGROUND 수신 메시지는 `dst: "BACKGROUND"`여야 합니다. 권한이 없는 요청이나 각 라우터가 지원하지 않는 메서드·경로 조합은 응답 없이 무시합니다. 일괄적으로 `401`이나 `403`을 반환하지 않습니다.

### 오류 응답

```json
{
  "statusCode": 400,
  "data": { "msg": "Invalid data field" }
}
```

| 코드 | 의미                                                                                      |
| ---- | ----------------------------------------------------------------------------------------- |
| 400  | 요청 필드 또는 서비스 검증 실패. `msg`는 검증 항목에 따라 달라집니다.                     |
| 404  | 토큰·템플릿·삽입 대상 편집기 없음. 아래 API별 응답을 따릅니다.                            |
| 500  | 처리 중 예외. auth·template·editor별 오류 메시지 또는 공통 메시지 처리 오류를 반환합니다. |

BACKGROUND 최상위 라우터에서 `/auth/`, `/template/`, `/editor/`, `/ai/` 중 어느 접두사에도 해당하지 않는 경로는 `404`, `{ "msg": "router not founded" }`를 반환합니다. 해당 접두사 안의 미지원 경로는 각 라우터에서 무시합니다. 공통 메시지 리스너가 예외를 처리하면 `500`, `{ "msg": "메시지 처리에 실패했습니다." }`를 반환합니다.

## BACKGROUND: 인증 토큰

경로는 모두 `/auth/token`이며 PAGE만 호출할 수 있습니다. `dst`는 `BACKGROUND`입니다.

| 메서드 | 요청 `data`                     | 성공 응답 `data`       | 추가 오류                     |
| ------ | ------------------------------- | ---------------------- | ----------------------------- |
| POST   | `{ vendor, token, expiresAt? }` | `AuthToken`            | 기존 유효 토큰이 있으면 400   |
| GET    | `{ vendor }`                    | `AuthToken`            | 없거나 만료되었으면 404       |
| PUT    | `{ vendor, token, expiresAt? }` | `AuthToken`            | 갱신할 유효 토큰이 없으면 404 |
| DELETE | `{ vendor }`                    | `{ deleted: boolean }` | 없으면 `deleted: false`로 200 |

성공 코드는 모두 `200`입니다. `token`은 공백만 있는 문자열을 허용하지 않으며, 저장할 때 원래 문자열을 유지합니다. `expiresAt`은 선택적인 Unix epoch 밀리초 숫자로 현재보다 미래여야 합니다. 유효기간은 기본 5분이며 더 먼 만료 시각을 요청해도 현재부터 최대 5분으로 제한합니다. 응답에는 `expiresAt`을 포함하지 않습니다.

```json
{
  "src": "PAGE",
  "dst": "BACKGROUND",
  "method": "POST",
  "path": "/auth/token",
  "data": { "vendor": "GOOGLE", "token": "example-token" }
}
```

GET·PUT에서 토큰을 찾지 못하면 `404`, `{ "msg": "인증 토큰이 없습니다." }`를 반환합니다. 토큰은 background 메모리에 보관하므로 서비스 워커가 재시작되면 유지되지 않습니다.

## BACKGROUND: 템플릿

### GET `/template/list`

- 호출자: PAGE 또는 CONTENT
- 목적지: BACKGROUND
- 요청 `data`: `{}`
- 성공: `200`, `{ templates: Template[] }`

```json
{
  "src": "CONTENT",
  "dst": "BACKGROUND",
  "method": "GET",
  "path": "/template/list",
  "data": {}
}
```

### PUT `/template/replace`

- 호출자: PAGE
- 목적지: BACKGROUND
- 요청 `data`: 수정할 `Template` 전체 객체
- 성공: `200`, `{ template: Template }`
- 대상 없음: `404`, `{ "msg": "템플릿을 찾을 수 없습니다." }`

부분 수정 API가 아닙니다. `templateId`는 양의 안전한 정수여야 합니다. `title`, `shortcut`, `content`는 공백만 있는 값을 허용하지 않습니다. 제목과 단축어는 양끝 공백을 제거하고 본문은 원문을 유지합니다. 단축어는 `/`로 시작하고 뒤에 공백이나 추가 `/`가 없는 한 글자 이상의 문자열이어야 하며, 다른 템플릿과 중복될 수 없습니다.

`variables`는 중복·빈 값·양끝 공백이 없는 문자열 배열이며 본문의 `{{변수}}` 목록과 일치해야 합니다. 날짜 3개 필드는 모두 시간대가 포함된 ISO 8601 문자열이어야 합니다. 정의되지 않은 추가 필드는 허용하지 않습니다. 검증 실패는 `400`입니다.

```json
{
  "src": "PAGE",
  "dst": "BACKGROUND",
  "method": "PUT",
  "path": "/template/replace",
  "data": {
    "templateId": 1,
    "title": "견적 안내",
    "shortcut": "/견적",
    "content": "{{이름}}님, 견적을 안내드립니다.\n확인 부탁드립니다.",
    "variables": ["이름"],
    "lastUsedAt": "2026-10-28T00:00:00.000Z",
    "createdAt": "2026-10-28T00:00:00.000Z",
    "editedAt": "2026-10-28T00:00:00.000Z"
  }
}
```

## BACKGROUND: 에디터

진입점은 `src/background/editor/router/router.ts`입니다. 발신자 검증 후 `page-router.ts` 또는 `content-router.ts`로 분기하며, 공통 삽입 처리는 `router-actions.ts`에서 담당합니다.

### GET `/editor/status`

- 호출자: PAGE만 허용
- 목적지: BACKGROUND
- 요청 `data`: `{ vendorName: VendorName }`
- 성공: `200`, `EditorStatus`
- 필드 누락·잘못된 vendor: `400`

```json
{
  "src": "PAGE",
  "dst": "BACKGROUND",
  "method": "GET",
  "path": "/editor/status",
  "data": { "vendorName": "GOOGLE" }
}
```

### PUT `/editor/update-status`

- 호출자: CONTENT만 허용
- 목적지: BACKGROUND
- 요청 `data`: `{ vendorName: VendorName, status: Partial<EditorStatus> }`
- 성공: `200`, 갱신된 `EditorStatus`
- `status` 누락·허용하지 않는 필드·잘못된 필드 타입: `400`

요청의 `vendorName`이 발신 URL의 서비스와 일치해야 합니다. Gmail 발신자가 NAVER 상태를 변경하려는 요청 등은 응답 없이 무시합니다. `status.vendorName`도 전달한다면 바깥의 `vendorName`과 같아야 합니다. `status`는 배열이 아닌 객체여야 하며, `EditorStatus`에 정의된 필드만 허용합니다. `text`는 빈 문자열을 허용하고 `prevTexts`는 문자열 배열이어야 합니다.

```json
{
  "src": "CONTENT",
  "dst": "BACKGROUND",
  "method": "PUT",
  "path": "/editor/update-status",
  "data": {
    "vendorName": "GOOGLE",
    "status": { "isEditable": true, "text": "작성 중인 본문" }
  }
}
```

갱신 결과가 있으면 BACKGROUND가 PAGE에 `/editor/notify-status`를 보냅니다. observer가 읽는 본문에는 `normalizeEditorText`를 적용합니다.

### PUT `/editor/insert-text`

- 호출자: PAGE 또는 CONTENT
- 목적지: BACKGROUND
- 요청 `data`: `{ text: string }`
- 성공: `200`, 갱신된 `EditorStatus`
- 문자열이 아니거나 빈 문자열: `400`, `{ "msg": "Invalid data field" }`
- CONTENT의 실패 응답은 그대로 전달합니다. 삽입 대상이 없으면 `404`입니다.

```json
{
  "src": "CONTENT",
  "dst": "BACKGROUND",
  "method": "PUT",
  "path": "/editor/insert-text",
  "data": { "text": "안녕하세요.\n\n확인 부탁드립니다." }
}
```

| 요청 출처 | CONTENT 전달 대상                                                               |
| --------- | ------------------------------------------------------------------------------- |
| PAGE      | 현재 창의 활성 탭. 프레임을 별도로 지정하지 않습니다.                           |
| CONTENT   | 발신자의 `sender.tab.id`와 `sender.frameId`. 프레임 ID가 없으면 0을 사용합니다. |

`vendorName`, `insertionId`, `mode`, DOM 요소, Range를 요청 데이터에 넣을 필요가 없습니다. 삽입 결과의 vendor는 CONTENT 응답에서 가져옵니다. 실제 동작은 **본문 전체 교체**이며 단축어 부분만 치환하는 API가 아닙니다. 성공 시 이전 본문이 비어 있지 않으면 이력에 추가하고, 상태를 갱신한 뒤 PAGE에 알립니다. 삽입 이력 추가 시 최근 2개까지 유지합니다.

전달할 활성 탭이 없거나 전달 결과가 없는 경우 구조화된 성공·오류 응답 없이 끝날 수 있습니다.

## CONTENT: 에디터 삽입

### PUT `/editor/insert-text`

- 발신 메시지: `src: "BACKGROUND"`, `dst: "CONTENT"`
- 요청 `data`: `{ text: string }`
- CONTENT는 두 메시지 필드가 일치하지 않으면 무시합니다.

```json
{
  "src": "BACKGROUND",
  "dst": "CONTENT",
  "method": "PUT",
  "path": "/editor/insert-text",
  "data": { "text": "첫 번째 줄\r\n두 번째 줄" }
}
```

성공 응답은 `EditorStatus` 전체가 아니라 다음 삽입 결과입니다.

```ts
interface EditorInsertResult {
  prevText: string;
  text: string;
  isInserted: true;
  vendorName: VendorName;
}
// MessageResponse<EditorInsertResult>, statusCode: 200
```

`prevText`는 교체 전 편집기의 `textContent`입니다. 기존 내용이 `","`이면 빈 문자열로 취급합니다. `text`는 observer의 `getEditorStatus()`에서 읽은 삽입 후 본문이며 결과가 없으면 `""`입니다. observer는 `textContent`를 사용하므로 `<br>`가 응답 문자열의 `\n`으로 복원되지는 않습니다.

| 실패 조건                                   | 응답                                                           |
| ------------------------------------------- | -------------------------------------------------------------- |
| 비문자열·빈 문자열 또는 정규화 후 빈 문자열 | `400`, `{ msg: "Invalid data field" }`                         |
| 삽입 함수가 편집기를 찾지 못함              | `404`, `{ msg: "GOOGLE editor not found." }` 또는 NAVER 메시지 |

### 문자열 변환

공통 함수는 `src/content/utils/editor-text.ts`에서 관리합니다.

1. CONTENT 라우터가 요청 문자열에 `normalizeEditorText`를 적용합니다. `U+200B` 제로 폭 공백을 제거하고 Unicode NFC로 정규화합니다. 이모지 연결자인 ZWJ(`U+200D`)는 제거하지 않습니다.
2. 실제 삽입 함수에서 `encodeEditorText`를 한 번 적용합니다. CRLF를 LF로 바꾸고, 연속된 일반 공백과 줄 양끝의 일반 공백을 NBSP(`U+00A0`)로 바꿉니다. 단어 사이의 단일 공백은 유지합니다.
3. 줄은 `<br>`로 구분하고 각 줄은 텍스트 노드로 삽입합니다. `<b>`, `&amp;`, `%0A` 같은 문자열을 HTML·엔티티·URL로 해석하거나 디코딩하지 않습니다.

CR 단독, 탭, 기존 NBSP는 그대로 유지합니다. Range 삽입 중 예외가 나면 같은 인코딩 결과를 `textContent`로 대체하고 현재 구현상 성공으로 반환합니다. 이 fallback은 `<br>`를 생성하지 않아 시각적인 줄바꿈과 커서 복원을 보장하지 않습니다.

## PAGE: 상태 알림

### PUT `/editor/notify-status`

- 발신 메시지: `src: "BACKGROUND"`, `dst: "PAGE"`
- 요청 `data`: `EditorStatus`
- 수신: sidebar의 `useMessageListener`

```json
{
  "src": "BACKGROUND",
  "dst": "PAGE",
  "method": "PUT",
  "path": "/editor/notify-status",
  "data": {
    "vendorName": "GOOGLE",
    "isEditable": true,
    "text": "본문",
    "prevTexts": ["이전 본문"]
  }
}
```

정상 수신 시 `200`, `{ "received": true }`를 반환합니다. 상태 객체가 잘못되면 `400`, `{ "msg": "잘못된 에디터 상태입니다." }`를 반환합니다. 알림의 출처·목적지·메서드·경로가 다르면 무시합니다. sidebar는 최초 `/editor/status` 조회와 실시간 알림을 함께 사용하며, 실시간 알림이 먼저 도착하면 늦게 도착한 최초 조회 결과를 적용하지 않습니다.

## BACKGROUND: AI (임시)

### POST `/ai/tone-correction`

- 호출자: 기존 발신자 검증을 통과한 CONTENT 또는 PAGE
- 목적지: BACKGROUND
- CONTENT 요청 `data`: `{ tone: string }` (메일 서비스는 발신자에서 결정)
- PAGE 요청 `data`: `{ vendorName: VendorName, tone: string }`
- 성공 응답: `200`, `{ text: "(톤교정)" + 에디터본문 }`
- 문체 누락·공백 또는 잘못된 vendor: `400`
- 빈 본문: `400`, `{ msg: "교정할 본문을 작성해주세요." }`
- 에디터 상태 없음: `404`

본문은 observer가 BACKGROUND에 전달해 저장한 에디터 상태에서 읽습니다. 요청의 `text`는 사용하지 않습니다. CONTENT 요청은 본문 끝의 `/톤`, `/톤교`, `/톤교정` 예약어와 뒤따르는 공백을 제외합니다. 현재 실제 교정 대신 본문 앞에 `(톤교정)`을 붙여 반환하며, 에디터 본문을 변경하지 않습니다. 실제 교정 API 연결 지점은 `src/background/ai/service.ts`의 TODO입니다. 라우터는 발신자 검증과 응답 변환을, 서비스는 입력 검증·본문 조회·예약어 제거·교정을 담당합니다.

### GET `/editor/text`

- 호출자: PAGE 또는 CONTENT
- 목적지: BACKGROUND
- CONTENT 요청 `data`: `{}` (메일 서비스는 실제 발신자에서 결정)
- PAGE 요청 `data`: `{ vendorName: VendorName }`
- 성공: `200`, `{ text: string }` (빈 문자열도 허용)
- PAGE의 vendor 누락·잘못된 값: `400`
- 저장된 에디터 상태 없음: `404`

BACKGROUND의 에디터 서비스에서 observer가 전달해 저장한 본문을 읽어 응답합니다. CONTENT로 메시지를 다시 보내거나 활성 탭을 조회하지 않습니다. 본문은 메일 서비스별 저장 상태이므로 observer 갱신 시차가 있으며 탭·프레임별 실시간 DOM 스냅샷은 아닙니다.
