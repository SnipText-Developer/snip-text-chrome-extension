# @snip-text/mini-popup

contenteditable 에디터에서 `/` 단축어로 템플릿을 검색하고 변수 입력 후 삽입하는 React 팝업입니다. Chrome API에 의존하지 않습니다.

```ts
import { startPopup, type Template } from "@snip-text/mini-popup";

const stopPopup = startPopup({
  selector: '[contenteditable="true"]',
  getTemplates: async (): Promise<Template[]> => fetchTemplates(),
});

stopPopup();
```

`getTemplates`는 단축어 입력 시 호출합니다. 오류를 던지면 조회 실패 안내를 표시합니다. `stopPopup()`은 여러 번 호출할 수 있으며 React root·Shadow DOM·이벤트 리스너를 제거하고 늦게 도착한 조회 결과를 무시합니다.

React 19와 React DOM 19가 필요합니다. 스타일은 번들에 포함되어 Shadow DOM에만 적용됩니다. `npm run build`로 `dist/index.js`와 타입 선언을 생성합니다. 레포 루트에서는 `npm run build:popup`을 사용합니다.

에디터 연동도 `useEditor` 훅에서 관리합니다. `useMiniPopup`은 입력·조회·선택 상태, `usePopupPosition`은 팝업 위치를 담당합니다.

변수 치환 결과는 `useTemplateContent(content, values)` 훅에서 입력 상태 변경에 따라 계산합니다.


소스 디렉터리:

- `components/`: 팝업·목록·변수 입력 폼
- `hooks/`: 에디터·팝업 상태·위치·변수 치환
- `utils/`: 문자열 처리
- `styles/`: Shadow DOM CSS와 CSS 모듈 타입
- `types.ts`: 공개 타입
- `index.ts`: `startPopup`과 공개 API
