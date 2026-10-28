import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const modules = new Map();
function moduleUrl(path) {
  const url = path instanceof URL ? path : new URL(path, import.meta.url);
  if (modules.has(url.href)) return modules.get(url.href);
  let source;
  if (url.pathname.endsWith(".css")) {
    source = "export default " + JSON.stringify(readFileSync(url, "utf8"));
  } else {
    source = ts.transpileModule(readFileSync(url, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    source = source.replace(/from ["']([^"']+)["']/g, (_, specifier) => {
      let target;
      if (specifier.startsWith(".")) {
        const relative = new URL(specifier.replace("?inline", ""), url);
        const resolved = [relative, new URL(relative.href + ".ts"), new URL(relative.href + ".tsx")].find((file) => existsSync(file));
        target = moduleUrl(resolved);
      } else target = import.meta.resolve(specifier);
      return "from " + JSON.stringify(target);
    });
  }
  const result = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  modules.set(url.href, result);
  return result;
}
const { getTemplateVariables, preserveEditorSpaces } = await import(moduleUrl("../packages/mini-popup/src/utils/text.ts"));

const { useTemplateContent } = await import(moduleUrl("../packages/mini-popup/src/hooks/useTemplateContent.ts"));

test("React content hook replaces repeated variables and preserves empty or missing values", () => {
  function Content({ text, values }) {
    return createElement("span", null, useTemplateContent(text, values));
  }
  const text = "{{ 이름 }}님, {{금액}}원입니다. {{이름}}님";
  assert.deepEqual(getTemplateVariables(text), ["이름", "금액"]);
  assert.equal(renderToStaticMarkup(createElement(Content, { text, values: { 이름: "민", 금액: "" } })), "<span>민님, 원입니다. 민님</span>");
  assert.equal(renderToStaticMarkup(createElement(Content, { text: "{{이름}}", values: {} })), "<span>{{이름}}</span>");
  assert.equal(renderToStaticMarkup(createElement(Content, { text: "{{toString}}", values: {} })), "<span>{{toString}}</span>");
  assert.equal(preserveEditorSpaces(" a  b \r\n c"), "\u00a0a\u00a0\u00a0b\u00a0\n\u00a0c");
});

test("React popup preserves selection, variables, IME, cancellation and stale-request handling", async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="editor" contenteditable="true" tabindex="0"></div></body></html>', { url: "https://mail.google.com/mail/u/0/", pretendToBeVisual: true });
  const { window } = dom;
  for (const name of ["window", "document", "HTMLElement", "Element", "Node", "NodeFilter", "InputEvent"]) {
    globalThis[name] = name === "window" ? window : window[name];
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.Range.prototype.getBoundingClientRect = () => ({ left: 10, top: 10, bottom: 30, height: 20 });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  let shadow;
  const attachShadow = window.Element.prototype.attachShadow;
  t.mock.method(window.Element.prototype, "attachShadow", function (options) {
    shadow = attachShadow.call(this, options);
    return shadow;
  });
  const templates = [
    { templateId: 1, title: "본문", shortcut: "/1", content: "일반 본문", variables: [] },
    { templateId: 2, title: "견적 안내", shortcut: "/견적", content: "{{이름}}님 {{금액}}원", variables: ["이름", "금액"] },
  ];
  let deferred;
  let holdResponse = false;
  let failLoad = false;
  let requests = 0;
  const getTemplates = async () => {
    requests++;
    if (failLoad) throw new Error("load failed");
    if (holdResponse) return await new Promise((resolve) => { deferred = resolve; });
    return templates;
  };
  const editor = document.querySelector("#editor");
  const inserted = [];
  editor.addEventListener("input", (event) => {
    if (event.inputType === "insertText") {
      inserted.push(event.data);
      assert.equal(event.bubbles, true);
      assert.equal(event.composed, true);
    }
  });
  const { startPopup } = await import(moduleUrl("../packages/mini-popup/src/index.ts"));
  let stop;
  await act(async () => { stop = startPopup({ selector: "#editor", getTemplates }); });
  t.after(async () => { await act(async () => { stop(); }); dom.window.close(); });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const key = (target, value, extra = {}) => target.dispatchEvent(new window.KeyboardEvent("keydown", { key: value, bubbles: true, composed: true, cancelable: true, ...extra }));
  async function open() {
    await act(async () => {
      editor.focus();
      editor.textContent = "/";
      const range = document.createRange();
      range.setStart(editor.firstChild, 1);
      range.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      editor.dispatchEvent(new window.Event("input", { bubbles: true }));
      await settle();
    });
  }
  await open();
  assert.equal(shadow.querySelectorAll('[role="option"]').length, 2);
  assert.equal(document.activeElement, editor);
  await act(async () => { key(editor, "ArrowDown"); });
  assert.equal(shadow.querySelectorAll('[role="option"]')[1].getAttribute("aria-selected"), "true");
  await act(async () => { shadow.querySelector('[role="option"]').dispatchEvent(new window.Event("pointermove", { bubbles: true })); });
  assert.equal(shadow.querySelector('[role="option"]').getAttribute("aria-selected"), "true");
  await act(async () => { key(editor, "Enter"); });
  assert.equal(inserted.at(-1), "일반 본문");

  await open();
  const beforeComposition = requests;
  for (const query of ["겨", "견", "견적", "견적".normalize("NFD")]) {
    const requestsBeforeSyllable = requests;
    await act(async () => {
      editor.dispatchEvent(new window.CompositionEvent("compositionstart", { bubbles: true }));
      editor.textContent = `/${query}`;
      const range = document.createRange();
      range.setStart(editor.firstChild, query.length);
      range.setEnd(editor.firstChild, query.length + 1);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      editor.dispatchEvent(new window.InputEvent("input", { bubbles: true, isComposing: true }));
      document.dispatchEvent(new window.Event("selectionchange"));

      await settle();
    });
    assert.notEqual(shadow.host.style.display, "none");
    assert.ok(requests > requestsBeforeSyllable);
    const composingOptions = shadow.querySelectorAll('[role="option"]');
    assert.equal(composingOptions.length, query === "겨" ? 0 : 1);
    if (query !== "겨") assert.match(composingOptions[0].getAttribute("aria-label"), /견적/);
    assert.equal(inserted.length, 1);
    await act(async () => {
      window.getSelection().collapse(editor.firstChild, query.length + 1);
      editor.dispatchEvent(new window.CompositionEvent("compositionend", { bubbles: true }));

      await settle();
    });
    assert.notEqual(shadow.host.style.display, "none");
    assert.equal(shadow.querySelectorAll('[role="option"]').length, query === "겨" ? 0 : 1);
    if (query !== "겨") assert.match(shadow.querySelector('[role="option"]').textContent, /견적/);
  }
  assert.ok(requests > beforeComposition);
  assert.equal(inserted.length, 1);

  for (const afterComposition of [false, true]) {
    await open();
    await act(async () => {
      editor.dispatchEvent(new window.CompositionEvent("compositionstart", { bubbles: true }));
      editor.textContent = "/견적";
      window.getSelection().collapse(editor.firstChild, 3);
      editor.dispatchEvent(new window.InputEvent("input", { bubbles: true, isComposing: true }));
      await settle();
      if (!afterComposition) key(editor, "Enter", { isComposing: true });
      editor.dispatchEvent(new window.CompositionEvent("compositionend", { bubbles: true }));
      if (afterComposition) key(editor, "Enter");
      await settle();
    });
    assert.equal(shadow.activeElement, shadow.querySelector("input"));
    assert.ok(shadow.querySelector("input"), "One IME Enter selects the quotation template");
    await act(async () => { key(shadow.querySelector("input"), "Escape"); });
  }

  await open();
  await act(async () => { key(editor, "ArrowDown"); key(editor, "Enter"); });
  assert.equal(shadow.activeElement, shadow.querySelector("input"));
  const [name, amount] = shadow.querySelectorAll("input");
  let leakedMouseEvents = 0;
  const onMouse = () => { leakedMouseEvents++; };
  document.addEventListener("mousedown", onMouse);
  document.addEventListener("click", onMouse);
  await act(async () => {
    const header = shadow.querySelector("header");
    const mouseDown = new window.MouseEvent("mousedown", {
      bubbles: true, composed: true, cancelable: true,
    });
    header.dispatchEvent(mouseDown);
    assert.equal(mouseDown.defaultPrevented, true);
    header.dispatchEvent(new window.MouseEvent("click", { bubbles: true, composed: true }));
    await settle();
  });
  await act(async () => {
    const labelText = shadow.querySelector("label span");
    const mouseDown = new window.MouseEvent("mousedown", {
      bubbles: true, composed: true, cancelable: true,
    });
    labelText.dispatchEvent(mouseDown);
    assert.equal(mouseDown.defaultPrevented, true);
    labelText.dispatchEvent(new window.MouseEvent("click", { bubbles: true, composed: true }));
    await settle();
  });
  assert.equal(leakedMouseEvents, 0);
  assert.equal(shadow.activeElement, name);
  assert.ok(shadow.querySelector(".variable-entry"));
  document.removeEventListener("mousedown", onMouse);
  document.removeEventListener("click", onMouse);

  let leakedKeys = 0;
  document.addEventListener("keydown", () => { leakedKeys++; });
  await act(async () => {
    name.value = "민";
    name.dispatchEvent(new window.Event("input", { bubbles: true, composed: true }));
    key(name, "a");
  });
  assert.equal(leakedKeys, 0);
  assert.equal(name.value, "민");
  await act(async () => {
    name.dispatchEvent(new window.CompositionEvent("compositionstart", { bubbles: true, composed: true }));
    key(name, "Enter", { isComposing: true });
    shadow.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  });
  assert.equal(inserted.length, 1);
  await act(async () => {
    name.dispatchEvent(new window.CompositionEvent("compositionend", { bubbles: true, composed: true }));
    amount.value = "";
    amount.dispatchEvent(new window.Event("input", { bubbles: true, composed: true }));
  });
  await act(async () => { shadow.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
  assert.equal(inserted.at(-1), "민님 원");
  await open();
  await act(async () => { key(editor, "ArrowDown"); key(editor, "Enter"); });
  await act(async () => { key(shadow.querySelector("input"), "Escape"); });
  assert.equal(editor.textContent, "/");
  assert.equal(inserted.length, 2);
  assert.equal(document.activeElement, editor);
  assert.equal(shadow.host.style.display, "none");

  await open();
  await act(async () => { key(editor, "Enter"); });
  assert.equal(editor.textContent, "일반 본문");
  assert.equal(window.getSelection().isCollapsed, true);

  failLoad = true;
  await open();
  assert.match(shadow.querySelector(".message").textContent, /불러오지 못했습니다/);
  failLoad = false;
  holdResponse = true;
  await open();
  assert.ok(deferred);
  await act(async () => { key(editor, "Escape"); deferred(templates); await settle(); });
  assert.equal(shadow.host.style.display, "none");

  await open();
  const pending = deferred;
  const requestCount = requests;
  await act(async () => { stop(); stop(); stop = () => {}; });
  assert.equal(shadow.host.isConnected, false);
  await act(async () => {
    pending(templates);
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    await settle();
  });
  assert.equal(requests, requestCount);
  assert.equal(shadow.host.isConnected, false);

});
