# @snip-text/mini-popup

contenteditable 에디터에서 `/` 단축어로 템플릿을 검색하고 변수 입력 후 삽입하는 React 팝업입니다. 확장 프로그램용 액션은 Chrome 메시지 API를 사용합니다.

```ts
import { startPopup, type Template } from "@snip-text/mini-popup";

const stopPopup = startPopup({
  selector: '[contenteditable="true"]',
  getTemplates: async (): Promise<Template[]> => fetchTemplates(),
  insertText: async (text) => insertThroughBackground(text),
});

stopPopup();
```

`getTemplates`는 단축어 입력 시 호출합니다. `insertText(text)`는 사용처에서 주입하는 비동기 삽입 함수이며, 실패하면 예외를 던집니다. 삽입 중에는 중복 제출을 막고 실패하면 입력값을 유지합니다. 오류를 던지면 조회 실패 안내를 표시합니다. `stopPopup()`은 여러 번 호출할 수 있으며 React root·팝업 컨테이너·이벤트 리스너를 제거하고 늦게 도착한 조회 결과를 무시합니다.

React 19와 React DOM 19는 일반 의존성으로 설치됩니다. 일반 DOM에 렌더링하며, normalize CSS와 팝업 스타일은 번들에 포함되어 `#snip-text-mini-popup` 내부에만 적용됩니다. `npm run build`로 `dist/index.js`와 타입 선언을 생성합니다. 레포 루트에서는 `npm run build:popup`을 사용합니다.

DOM 접근의 단일 진입점은 `dom/index.ts`의 `createMiniPopupDom(selector, host)`입니다. `useMiniPopup`은 상태 전환과 요청 처리만 담당하고, DOM API를 통해 에디터·팝업·이벤트를 제어합니다. `usePopupPosition`은 React 생명주기와 위치 처리만 연결합니다. 선택 영역과 커서 상태는 DOM 계층 내부에서 관리합니다.

DOM 계층은 `editor.ts`(편집기·Range·커서), `popup.ts`(컨테이너 생명주기·표시·위치), `controls.ts`(목록·변수 입력의 키보드·포커스·스크롤), `events.ts`(이벤트 구독·키 처리 연결·전파 차단)로 구성합니다. 외부 코드는 `dom/index.ts`만 가져오며 DOM selector나 좌표 계산을 직접 작성하지 않습니다. 유지보수 규칙은 `src/dom/README.md`에 있습니다.

목록·변수 입력·문체 목록 컴포넌트가 표시될 때 자신의 DOM 처리 함수를 연결하고, 화면 전환·닫힘 시 해제합니다. 키 전파 차단용 capture 리스너는 유지하므로 목록 → 변수 입력 → 목록 전환 후에도 메일 페이지 단축키보다 먼저 처리합니다.

확장 프로그램에서는 mini-popup의 `src/actions.ts`가 background의 `/editor/insert-text`에 텍스트만 요청합니다. background는 요청을 보낸 탭·프레임으로 전달합니다. content 라우터의 기존 요청 규격을 유지하며, mini-popup과 sidebar 모두 본문 전체를 교체합니다. 공백·개행 인코딩은 content 삽입 함수가 `encodeEditorText`를 호출해 한 번만 적용합니다.

변수 치환 결과는 `useTemplateContent(content, values)` 훅에서 입력 상태 변경에 따라 계산합니다.


소스 디렉터리:

- `components/`: 팝업·목록·변수 입력 폼과 각 컴포넌트의 CSS
- `hooks/`: 팝업 상태·위치 생명주기·변수 치환
- `dom/`: DOM 접근의 단일 진입점과 기능별 구현
- `utils/`: 문자열 처리
- `styles/`: 팝업 범위의 normalize CSS, 공통 CSS와 CSS 모듈 타입
- `types.ts`: 공개 타입
- `index.ts`: `startPopup`과 공개 API

팝업 닫기는 외부 포인터 클릭, 삽입 성공 또는 에디터 입력에서 `/`가 모두 사라졌을 때 수행합니다(컨테이너 제거 시 정리는 별도). 방향키, Escape, Tab에 따른 포커스 이동이나 선택 영역 변경만으로는 닫지 않습니다. 변수 입력에서 Escape 또는 취소 버튼은 목록으로 돌아갑니다. 작성 창 변경으로 삽입 대상이 유효하지 않으면 팝업을 유지하고 안내를 표시합니다.

`correctTone?: (tone: string) => Promise<string>`를 전달하면 `/톤교정` 예약어를 사용할 수 있습니다. 예약어를 선택하면 오른쪽에 문체 목록을 표시하고, 선택한 문체로 교정한 결과를 기존 삽입 경로로 본문 전체에 반영합니다. 요청 중 본문이 바뀌거나 팝업이 닫히면 응답을 삽입하지 않습니다. DOM 접근은 기존 `dom` 계층을 사용합니다.

`getEditorText?: () => Promise<string>`로 현재 본문 조회를 주입합니다. 확장 프로그램에서는 BACKGROUND의 `GET /editor/text`를 호출합니다. 톤 교정 요청 전후에 이 API로 본문을 비교하며, mini-popup의 DOM 계층에서 본문 전체를 직접 읽지 않습니다.

`GET /editor/text`는 BACKGROUND에 저장된 observer 상태를 직접 응답합니다. CONTENT 왕복 조회는 하지 않으며, 변경 비교는 observer가 갱신한 본문을 기준으로 합니다.

확장 프로그램에서는 `startPopup({ selector, vendorName, getEditorStatus })`로 시작합니다. `startPopup`이 패키지 내부에서 템플릿 조회·삽입·본문 조회·톤 교정 액션을 구성합니다. content는 vendorName과 observer의 현재 상태 조회만 전달합니다. 메시지 전송은 `src/common/`에 복사한 message-bus·wrapper·메시지 타입을 사용하며, 기존 액션 콜백 주입 방식도 지원합니다.

팝업은 항상 커서 아래에 표시하며, 남은 화면 높이에 맞춰 내부 목록을 스크롤합니다. 전환은 `MiniPopup.css`에서 진행도를 보간하고 `sin()`·`cos()`로 반원 경로를 계산합니다. 입력 위치를 기준으로 0.5초 동안 확대·축소하고 약한 X·Y축 회전을 더합니다. 전환 중간에는 비대칭 곡선 마스크와 가로·세로 비율, 기울기를 함께 바꿔 형태가 유연하게 일그러지며, 완전히 열리면 기존 모양으로 돌아옵니다. 닫힐 때도 전환이 끝까지 보이도록 마지막 내용을 유지하며, 닫힌 항목은 `inert`로 포커스와 클릭을 차단합니다. `prefers-reduced-motion: reduce`에서는 즉시 표시·숨깁니다.
