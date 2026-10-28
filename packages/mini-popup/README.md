# @snip-text/mini-popup

contenteditable 에디터에서 `/` 단축어로 템플릿을 검색하고 변수 입력 후 삽입하는 React 팝업입니다. Chrome API에 의존하지 않습니다.

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

DOM 탐색·범위 계산·커서 복원은 `dom/editor.ts`, 팝업 위치 측정·스타일 변경은 `dom/popup.ts`에 모았습니다. `useEditor` 훅은 삽입 위치를 저장하고 DOM 함수를 호출합니다. `useMiniPopup`은 입력·조회·선택 상태, `usePopupPosition`은 팝업 위치를 담당합니다.

확장 프로그램에서는 `src/content/controller/insert-template.ts`가 background의 `/editor/insert-text`에 텍스트만 요청합니다. background는 요청을 보낸 탭·프레임으로 전달합니다. content 라우터의 기존 요청 규격을 유지하며, mini-popup과 sidebar 모두 본문 전체를 교체합니다. 공백·개행 인코딩은 content 삽입 함수가 `encodeEditorText`를 호출해 한 번만 적용합니다.

변수 치환 결과는 `useTemplateContent(content, values)` 훅에서 입력 상태 변경에 따라 계산합니다.


소스 디렉터리:

- `components/`: 팝업·목록·변수 입력 폼과 각 컴포넌트의 CSS
- `hooks/`: 에디터·팝업 상태·위치·변수 치환
- `dom/`: 에디터 DOM 접근과 팝업 위치·표시 변경
- `utils/`: 문자열 처리
- `styles/`: 팝업 범위의 normalize CSS, 공통 CSS와 CSS 모듈 타입
- `types.ts`: 공개 타입
- `index.ts`: `startPopup`과 공개 API
