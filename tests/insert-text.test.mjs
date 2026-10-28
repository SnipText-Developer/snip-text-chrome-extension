import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";

function moduleUrl(path) {
  const url = path instanceof URL ? path : new URL(path, import.meta.url);
  const source = readFileSync(url, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
  });
  const resolved = outputText.replace(/from ["']([^"']+)["']/g, (_, specifier) =>
    "from " + JSON.stringify(moduleUrl(new URL(specifier + ".ts", url))),
  );
  return "data:text/javascript;base64," + Buffer.from(resolved).toString("base64");
}

const { insertTextToEditor } = await import(moduleUrl("../src/content/controller/insert-text.ts"));
const { encodeEditorText, normalizeEditorText } = await import(moduleUrl("../src/content/utils/editor-text.ts"));

function createEditor(t) {
  const dom = new JSDOM('<!doctype html><div contenteditable="true" tabindex="0"><b>기존 본문</b></div>', { pretendToBeVisual: true });
  const { window } = dom;
  const editor = window.document.querySelector("div");
  const previous = new Map();
  for (const name of ["window", "document", "HTMLElement", "MutationObserver"]) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value: name === "window" ? window : window[name], configurable: true, writable: true });
  }
  t.after(() => {
    window.close();
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return { window, editor };
}

// Reconstruct explicit HTML line breaks; textContent alone cannot detect them.
function readInsertedText(editor) {
  return [...editor.childNodes].map((node) => {
    if (node.nodeName === "BR") return "\n";
    assert.equal(node.nodeType, 3, "Only literal text and BR nodes may be inserted");
    return node.textContent;
  }).join("");
}

function assertContent(editor, expected) {
  assert.equal(readInsertedText(editor), expected);
  assert.equal(editor.querySelectorAll("br").length, expected.split("\n").length - 1);
  // Compare Unicode code points as well as the complete string.
  assert.deepEqual(Array.from(readInsertedText(editor), (char) => char.codePointAt(0)),
    Array.from(expected, (char) => char.codePointAt(0)));
}

const characterCases = [
  ["ASCII", "Hello, world! 1234567890"],
  ["한글과 영문 혼합", "안녕하세요. Order #123 확인 부탁드립니다."],
  ["한글 자모와 분해형 음절", "ㄱㄴㄷ ㅏㅑㅓ \u1100\u1161\u11a8"],
  ["여러 언어", "日本語 中文 العربية עברית Ελληνικά Русский हिन्दी ไทย"],
  ["결합 문자와 합성 문자 구분", "e\u0301 é A\u030a Å n\u0303 ñ"],
  ["보조 평면 문자", "😀 🚀 𠮷 𝄞 𝟘"],
  ["이모지 ZWJ·피부색·국기", "👨‍👩‍👧‍👦 👩🏽‍💻 🇰🇷 🏳️‍🌈"],
  ["이모지 변형 선택자", "❤ ❤️ ✈ ✈️ 1️⃣"],
  ["따옴표·역슬래시·백틱", '"double" \'single\' `code` C:\\temp\\파일.txt ${value}'],
  ["HTML 태그처럼 보이는 문자열", '<script>alert("x")</script><img src=x onerror=alert(1)><br><b>본문</b>'],
  ["엔티티는 디코딩하지 않음", "&lt;b&gt; &amp; &#10; &#x1F600; &nbsp; < > &"],
  ["URL·퍼센트 인코딩은 그대로 유지", "https://example.com/?q=%ED%95%9C%EA%B8%80&next=a+b%0A"],
  ["이스케이프처럼 보이는 문자열", String.raw`\n \r\n \t \uAC00 %0A`],
  ["탭과 일반 공백", "\t들여쓰기\tA  B \t", "\t들여쓰기\tA\u00a0\u00a0B \t"],
  ["특수 공백과 제로 폭 문자", "A\u00a0B\u2002C\u2003D\u2009E\u202fF\u3000G\u200bH\u200cI\u200dJ\ufeffK"],
  ["방향 제어 문자", "abc \u2067עברית\u2069 \u200e123\u200f"],
  ["Unicode 줄 구분자는 그대로 유지", "A\u2028B\u2029C"],
  ["NUL과 고립 서로게이트도 UTF-16 그대로 유지", "A\u0000B\ud800C\udc00D"],
];

const newlineCases = [
  ["LF", "첫째\n둘째", "첫째\n둘째"],
  ["CRLF는 LF로 정규화", "첫째\r\n둘째", "첫째\n둘째"],
  ["LF·CRLF 혼합", "A\r\nB\nC\r\nD", "A\nB\nC\nD"],
  ["연속 빈 줄", "A\n\n\nB", "A\n\n\nB"],
  ["시작 개행", "\n\n본문", "\n\n본문"],
  ["마지막 개행", "본문\n\n", "본문\n\n"],
  ["개행만 있는 본문", "\n\n\n", "\n\n\n"],
  ["CR 단독은 현재 계약대로 유지", "A\rB", "A\rB"],
  ["각 줄의 공백", "  A  \n B \n  ", "\u00a0\u00a0A\u00a0\u00a0\n\u00a0B\u00a0\n\u00a0\u00a0"],
];

describe("insertTextToEditor: 문자와 개행 보존", { concurrency: false }, () => {
  for (const [name, input, expected = input] of [...characterCases, ...newlineCases]) {
    test(name, (t) => {
      const { window, editor } = createEditor(t);
      assert.deepEqual(insertTextToEditor(editor, input), { prevText: "기존 본문", isInserted: true });
      assertContent(editor, expected);
      assert.ok(window.document.activeElement === editor);
      const selection = window.getSelection();
      assert.equal(selection.rangeCount, 1);
      assert.equal(selection.isCollapsed, true);
      const caret = selection.getRangeAt(0);
      assert.ok(caret.endContainer === editor);
      assert.equal(caret.endOffset, editor.childNodes.length, "Caret must follow the complete inserted body");
    });
  }

  test("긴 다국어 본문을 잘림 없이 삽입", (t) => {
    const { editor } = createEditor(t);
    const input = "한글 👩🏽‍💻 e\u0301 <tag>&amp;\n".repeat(2000);
    assert.equal(insertTextToEditor(editor, input).isInserted, true);
    assertContent(editor, input);
    assert.equal(editor.querySelectorAll("br").length, 2000);
  });

  test("반복 삽입은 누적하지 않고 기존 본문 전체를 교체", (t) => {
    const { editor } = createEditor(t);
    insertTextToEditor(editor, "첫 본문\n😀");
    assert.deepEqual(insertTextToEditor(editor, "다음 본문 <b>문자</b>"), { prevText: "첫 본문😀", isInserted: true });
    assertContent(editor, "다음 본문 <b>문자</b>");
  });
});

describe("공통 공백 인코딩과 삽입 조합", { concurrency: false }, () => {
  const cases = [
    ["연속 공백", "A  B   C", "A\u00a0\u00a0B\u00a0\u00a0\u00a0C"],
    ["각 줄의 양끝 공백과 CRLF", " A \r\n  B  \n ", "\u00a0A\u00a0\n\u00a0\u00a0B\u00a0\u00a0\n\u00a0"],
    ["단어 사이 단일 공백", "안녕 world 👋", "안녕 world 👋"],
    ["NBSP·탭·특수문자 유지", "A\u00a0B\t<>&amp;", "A\u00a0B\t<>&amp;"],
  ];
  for (const [name, input, expected] of cases) {
    test(name, (t) => {
      const { editor } = createEditor(t);
      const encoded = encodeEditorText(input);
      assert.equal(encoded, expected);
      assert.equal(encodeEditorText(encoded), encoded, "Encoding must not accumulate on repeated calls");
      assert.equal(insertTextToEditor(editor, input).isInserted, true);
      assertContent(editor, expected);
      assert.equal(insertTextToEditor(editor, encoded).isInserted, true);
      assertContent(editor, expected);
    });
  }
});

describe("insertTextToEditor: 경계값과 예외 경로", { concurrency: false }, () => {
  test("유효하지 않은 editor는 삽입 실패", (t) => {
    const { window } = createEditor(t);
    for (const value of [null, undefined, {}, "editor", window.document.createTextNode("text")]) {
      assert.deepEqual(insertTextToEditor(value, "본문"), { prevText: "", isInserted: false });
    }
  });

  test("빈 값은 기존 DOM과 선택 범위를 변경하지 않음", (t) => {
    const { window, editor } = createEditor(t);
    editor.focus();
    const range = window.document.createRange();
    range.selectNodeContents(editor.querySelector("b"));
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    const originalMarkup = editor.innerHTML;
    for (const value of ["", null, undefined]) {
      assert.deepEqual(insertTextToEditor(editor, value), { prevText: "기존 본문", isInserted: false });
      assert.equal(editor.innerHTML, originalMarkup);
      assert.equal(window.getSelection().toString(), "기존 본문");
    }
  });

  test("기존 쉼표 placeholder는 빈 이전 본문으로 반환", (t) => {
    const { editor } = createEditor(t);
    editor.textContent = ",";
    assert.deepEqual(insertTextToEditor(editor, "본문"), { prevText: "", isInserted: true });
  });

  test("Selection API가 null이어도 본문 삽입 가능", (t) => {
    const { window, editor } = createEditor(t);
    t.mock.method(window, "getSelection", () => null);
    assert.equal(insertTextToEditor(editor, "한글\n😀").isInserted, true);
    assertContent(editor, "한글\n😀");
  });

  test("Range 삽입 실패 시 fallback도 같은 인코딩 적용", (t) => {
    const { window, editor } = createEditor(t);
    t.mock.method(window.Range.prototype, "insertNode", () => { throw new Error("Range failure"); });
    const warning = t.mock.method(console, "warn", () => {});
    const input = '<img src=x>\r\n한글 😀 &amp;';
    assert.deepEqual(insertTextToEditor(editor, input), { prevText: "기존 본문", isInserted: true });
    assert.equal(editor.textContent, '<img src=x>\n한글 😀 &amp;');
    assert.equal(editor.querySelector("img"), null);
    assert.equal(warning.mock.callCount(), 1);
    // This fallback uses textContent: it does not create visual BR line breaks.
    assert.equal(editor.querySelectorAll("br").length, 0);
  });
});


describe("observer 공통 텍스트 정규화", { concurrency: false }, () => {
  test("제로 폭 공백 제거와 NFC 정규화", () => {
    assert.equal(normalizeEditorText("\u200b\u1100\u1161\u11a8 e\u0301\u200b"), "각 é");
    assert.equal(normalizeEditorText(null), "");
    assert.equal(normalizeEditorText(undefined), "");
  });

  test("공백·개행·이모지 연결자는 보존하고 반복 적용해도 동일", () => {
    const text = "  A\u00a0B\t\r\n👩🏽‍💻 👨‍👩‍👧‍👦 ";
    assert.equal(normalizeEditorText(text), text);
    assert.equal(normalizeEditorText(normalizeEditorText(text)), text);
  });

  for (const [file, name] of [
    ["editor-combined-observer", "EditorCombinedObserver"],
    ["editor-mutation-observer", "EditorMutationObserver"],
    ["editor-polling-observer", "EditorPollingObserver"],
  ]) {
    test(name + "도 같은 정규화 결과를 반환", async (t) => {
      const { window, editor } = createEditor(t);
      Object.defineProperty(editor, "offsetParent", { value: window.document.body });
      editor.textContent = "\u200b\u1100\u1161\u11a8 e\u0301 👩🏽‍💻\u00a0\n";
      const module = await import(moduleUrl("../src/content/controller/editor-handler/observer/" + file + ".ts"));
      const observer = new module[name]('[contenteditable="true"]', async () => {});
      observer.checkEditor();
      assert.deepEqual(observer.getEditorStatus(), { isEditable: true, text: "각 é 👩🏽‍💻\u00a0\n" });
      observer.stop();
    });
  }
});
