# DOM 계층

React 컴포넌트와 훅은 `dom/index.ts`만 가져옵니다. 브라우저 API, DOM selector, Range, 좌표 계산, 스타일 쓰기와 전역 이벤트 등록은 이 디렉터리에 둡니다.

| 모듈 | 책임 |
| --- | --- |
| `index.ts` | 팝업 인스턴스별 DOM 기능 조립과 외부 진입점 |
| `editor.ts` | 예약어 탐색, 선택 영역 검증·보관 |
| `popup.ts` | 컨테이너 생성·제거, 범위 판별, 표시·숨김, 위치·크기 계산, viewport 구독 |
| `controls.ts` | 목록 탐색·선택·스크롤·포커스 복원, 변수 입력의 Escape·첫 필드 포커스 |
| `events.ts` | 이벤트 등록·해제, 활성 컴포넌트 키 처리 연결, 페이지로의 키 전파 차단 |

상태 전환, 템플릿 조회, 삽입 요청과 메시지 문구는 DOM 계층에 넣지 않습니다. JSX 렌더링과 입력값 상태는 React가 담당합니다. 각 컴포넌트는 `useLayoutEffect`에서 자신의 root와 최신 콜백을 `connectTemplateList`, `connectToneMenu`, `connectTemplateInput`에 전달합니다. 연결 시 해당 화면의 포커스를 복원하고, 화면 전환·닫힘 시 연결을 해제합니다.

키보드 capture 리스너는 팝업 생명주기 동안 유지하고, 활성 컴포넌트의 처리 함수만 교체합니다. 화면 전환 시 메일 페이지의 리스너보다 등록 순서가 뒤로 밀리지 않도록 전역 리스너를 재등록하지 않습니다. 목록은 방향키와 에디터 Enter를 처리하고, 변수 입력은 Escape만 처리합니다. 입력·Tab·버튼 Enter·폼 제출의 기본 동작은 유지합니다. 조합 중인 키는 탐색·취소에 사용하지 않습니다.

이벤트 구독과 컴포넌트 연결은 반드시 해제 함수를 반환합니다. 팝업·편집기 상태는 인스턴스마다 생성하며 모듈 전역에 저장하지 않습니다. 문서와 viewport는 호스트의 `ownerDocument`를 기준으로 사용합니다.

`tests/mini-popup-dom.test.mjs`는 계층 밖의 직접 DOM 접근과 내부 모듈 import를 검사합니다. 동작 변경 시에는 `tests/mini-popup.test.mjs`로 커서·키보드·IME·삽입·취소 흐름도 확인합니다.
