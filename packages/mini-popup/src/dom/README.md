# DOM 계층

React 컴포넌트와 훅은 `dom/index.ts`만 가져옵니다. 브라우저 API, DOM selector, Range, 좌표 계산, 스타일 쓰기와 전역 이벤트 등록은 이 디렉터리에 둡니다.

| 모듈 | 책임 |
| --- | --- |
| `index.ts` | 팝업 인스턴스별 DOM 기능 조립과 외부 진입점 |
| `editor.ts` | 예약어 탐색, 선택 영역 검증·보관 |
| `popup.ts` | 항목 조회, 포커스, 스크롤, 표시 상태 |
| `position.ts` | 레이아웃 측정, 좌표 적용, 스크롤·리사이즈 구독 |
| `events.ts` | 이벤트 등록·해제, 키 소비, 선택 영역 보존 |
| `host.ts` | 호스트 컨테이너 생성·제거 |

상태 전환, 템플릿 조회, 삽입 요청과 메시지 문구는 DOM 계층에 넣지 않습니다. JSX 렌더링과 입력값 상태는 React가 담당합니다. 첫 입력 필드의 포커스는 `autoFocus`를 사용합니다.

이벤트 구독은 반드시 해제 함수를 반환합니다. 팝업·편집기 상태는 인스턴스마다 생성하며 모듈 전역에 저장하지 않습니다. 문서와 viewport는 호스트의 `ownerDocument`를 기준으로 사용합니다.

`tests/mini-popup-dom.test.mjs`는 계층 밖의 직접 DOM 접근과 내부 모듈 import를 검사합니다. 동작 변경 시에는 `tests/mini-popup.test.mjs`로 커서·키보드·IME·삽입·취소 흐름도 확인합니다.
