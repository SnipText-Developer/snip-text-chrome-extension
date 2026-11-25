# snip-text-mini-popup

contenteditable 에디터에서 `\` 단축어로 템플릿을 검색하고 변수 입력 후 삽입하는 React 팝업입니다. 확장 프로그램용 액션은 Chrome 메시지 API를 사용합니다.

```ts
import { startPopup, type Template } from "snip-text-mini-popup";

const stopPopup = startPopup({
  selector: '[contenteditable="true"]',
  getTemplates: async (): Promise<Template[]> => fetchTemplates(),
  insertText: async (text) => insertThroughBackground(text),
});

stopPopup();
```

`getTemplates`는 단축어 입력 시 호출합니다. `insertText(text)`는 사용처에서 주입하는 비동기 삽입 함수이며, 실패하면 예외를 던집니다. 삽입 중에는 중복 제출을 막고 실패하면 입력값을 유지합니다. 오류를 던지면 조회 실패 안내를 표시합니다. `stopPopup()`은 여러 번 호출할 수 있으며 React root·팝업 컨테이너·이벤트 리스너를 제거하고 늦게 도착한 조회 결과를 무시합니다.

React 19와 React DOM 19는 일반 의존성으로 설치됩니다. 일반 DOM에 렌더링하며, normalize CSS와 팝업 스타일은 번들에 포함되어 `#snip-text-mini-popup` 내부에만 적용됩니다. `npm run build`로 `dist/index.js`와 타입 선언을 생성합니다. 레포 루트에서는 `npm run build:popup`을 사용합니다.

팝업 호스트와 React root의 생성·제거는 `src/index.tsx`에서 처리합니다. 마운트 이후 외부 편집기의 Range와 이벤트는 `hooks/editor/`에서, 팝업 위치와 이벤트 격리는 `hooks/popup/`에서, 화면별 키보드와 포커스는 `hooks/keyboard/`에서 관리합니다.

`usePopupEventIsolation`은 팝업이 마운트되어 있는 동안 키보드 capture 리스너를 유지합니다. 화면이 바뀌면 `usePopupKeyboard`가 연결된 핸들러만 교체합니다.

확장 프로그램에서는 mini-popup의 `src/actions.ts`가 background의 `/editor/insert-text`에 텍스트만 요청합니다. background는 요청을 보낸 탭·프레임으로 전달합니다. content 라우터의 기존 요청 규격을 유지하며, mini-popup과 sidebar 모두 본문 전체를 교체합니다. 공백·개행 인코딩은 content 삽입 함수가 `encodeEditorText`를 호출해 한 번만 적용합니다.

변수 치환 결과는 `useTemplateContent(content, values)` 훅에서 입력 상태 변경에 따라 계산합니다.


소스 디렉터리:

- `components/`: 팝업·목록·변수 입력 폼과 각 컴포넌트의 CSS
- `hooks/`: 팝업, 편집기, 키보드·포커스, 템플릿 훅
- `utils/`: 문자열 처리와 팝업 좌표 계산
- `styles/`: 팝업 범위의 normalize CSS, 공통 CSS와 CSS 모듈 타입
- `types.ts`: 공개 타입
- `index.tsx`: `startPopup`과 공개 API

| 화면 | 키보드 동작 |
| --- | --- |
| 템플릿 목록 | ↑↓로 이동하고 Enter로 선택합니다. 편집기에 포커스가 있으면 그 상태에서 검색어를 계속 입력할 수 있습니다. |
| 변수 입력 | Tab으로 이동하고 Enter로 제출합니다. 공백뿐인 값도 필수 입력 누락으로 처리합니다. Esc는 목록과 메일 본문의 포커스·커서를 복원합니다. |
| 문체 선택 | ↑↓←→로 이동하고 Enter로 교정을 요청합니다. Esc는 이전 목록과 메일 본문의 포커스·커서를 복원합니다. |

팝업 바깥 클릭, 삽입 성공, 편집기 입력에서 트리거 문자 제거 시 팝업이 닫힙니다. 삽입·교정 요청 진행 중에는 중복 요청을 막습니다. 작성 창 변경으로 삽입 대상이 유효하지 않으면 안내를 표시합니다.

`correctTone?: (tone: string) => Promise<string>`을 전달하면 `\톤교정` 명령이 활성화됩니다. 선택한 문체로 교정하고, 원문과 삽입 범위를 다시 검증한 뒤 기존 삽입 경로로 본문 전체에 반영합니다. `getEditorText?: () => Promise<string>`으로 원문 조회를 주입합니다. 확장 프로그램은 BACKGROUND의 `GET /editor/text`를 사용합니다.

`GET /editor/text`는 BACKGROUND에 저장된 observer 상태를 직접 응답합니다. CONTENT 왕복 조회는 하지 않으며, 변경 비교는 observer가 갱신한 본문을 기준으로 합니다.

확장 프로그램에서는 `startPopup({ selector, vendorName, getEditorStatus })`로 시작합니다. `startPopup`이 패키지 내부에서 템플릿 조회·삽입·본문 조회·톤 교정 액션을 구성합니다. content는 vendorName과 observer의 현재 상태 조회만 전달합니다. 메시지 전송은 `src/common/`에 복사한 message-bus·wrapper·메시지 타입을 사용하며, 기존 액션 콜백 주입 방식도 지원합니다.

팝업은 항상 커서 아래에 표시하며, 남은 화면 높이에 맞춰 내부 목록을 스크롤합니다. 전환은 `MiniPopup.css`에서 진행도를 보간하고 `sin()`·`cos()`로 반원 경로를 계산합니다. 입력 위치를 기준으로 0.5초 동안 확대·축소하고 약한 X·Y축 회전을 더합니다. 전환 중간에는 비대칭 곡선 마스크와 가로·세로 비율, 기울기를 함께 바꿔 형태가 유연하게 일그러지며, 완전히 열리면 기존 모양으로 돌아옵니다. 닫힐 때도 전환이 끝까지 보이도록 마지막 내용을 유지하며, 닫힌 항목은 `inert`로 포커스와 클릭을 차단합니다. `prefers-reduced-motion: reduce`에서는 즉시 표시·숨깁니다.
