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
