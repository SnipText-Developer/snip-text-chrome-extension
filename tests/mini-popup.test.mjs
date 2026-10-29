import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { moduleUrl } from "./module-url.mjs";

const { getTemplateVariables } = await import(moduleUrl("../packages/mini-popup/src/utils/text.ts"));

const { encodeEditorText } = await import(moduleUrl("../src/content/utils/editor-text.ts"));

const { useTemplateContent } = await import(moduleUrl("../packages/mini-popup/src/hooks/useTemplateContent.ts"));

test("React content hook replaces repeated variables and preserves empty or missing values", () => {
  function Content({ text, values }) {
    return createElement("span", null, useTemplateContent(text, values));
  }
  const text = "{{ 이름 }}님, {{금액}}원입니다. {{이름}}님";
  assert.deepEqual(getTemplateVariables(text), ["이름", "금액"]);
  assert.equal(renderToStaticMarkup(createElement(Content, { text, values: { 이름: "민", 금액: "" } })), "<span>민님, {{금액}}원입니다. 민님</span>");
  assert.equal(renderToStaticMarkup(createElement(Content, { text: "{{이름}}", values: {} })), "<span>{{이름}}</span>");
  assert.equal(renderToStaticMarkup(createElement(Content, { text: "{{toString}}", values: {} })), "<span>{{toString}}</span>");
  assert.equal(encodeEditorText(" a  b \r\n c"), "\u00a0a\u00a0\u00a0b\u00a0\n\u00a0c");
});

for (const path of ["../packages/mini-popup/src/utils/text.ts", "../packages/sidebar/src/common/template-content.ts"]) {
  test(path + ": 미입력 변수는 원래 placeholder를 유지", async () => {
    const { getTemplateContent } = await import(moduleUrl(path));
    const content = "{{ 이름 }}님 {{금액}}원 {{}}";
    for (const values of [{}, { 이름: "", 금액: "" }, { 이름: " \t", 금액: "\n" }]) {
      assert.equal(getTemplateContent(content, values), content);
    }
    assert.equal(getTemplateContent(content, { 이름: "민", 금액: "" }), "민님 {{금액}}원 {{}}");
    assert.equal(getTemplateContent(content, { 이름: " 민 ", 금액: "0" }), " 민 님 0원 {{}}");
  });
}

test("React popup preserves selection, variables, IME, cancellation and stale-request handling", async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="editor" contenteditable="true" tabindex="0"></div></body></html>', { url: "https://mail.google.com/mail/u/0/", pretendToBeVisual: true });
  const { window } = dom;
  for (const name of ["window", "document", "HTMLElement", "Element", "Node", "NodeFilter", "InputEvent", "AbortController"]) {
    globalThis[name] = name === "window" ? window : window[name];
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.Range.prototype.getBoundingClientRect = () => ({ left: 10, top: 10, bottom: 30, height: 20 });
  window.HTMLElement.prototype.scrollIntoView = () => {};
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
  const { startPopup } = await import(moduleUrl("../packages/mini-popup/src/index.ts"));
  const { router: backgroundRouter } = await import(moduleUrl("../src/background/editor/router/router.ts"));
  const { createEditorRouter } = await import(moduleUrl("../src/content/editor-router.ts"));
  const actions = await import(moduleUrl("../packages/mini-popup/src/actions.ts"));
  const insertTemplate = (text) => actions.insertTemplate(text);
  const { insertTextToEditor } = await import(moduleUrl("../src/content/controller/insert-text.ts"));
  const getEditorText = () => actions.getEditorText();
  const contentRouter = createEditorRouter({
    vendorName: "GOOGLE", getEditor: () => editor,
    getEditorStatus: () => ({ text: editor.textContent }),
  });
  const contentSender = { id: "extension", url: "https://mail.google.com/mail/u/0/", tab: { id: 42 }, frameId: 3 };
  const delivered = [];
  let failInsertion = false;
  let holdInsertion;
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    runtime: {
      id: "extension", getURL: (path) => "chrome-extension://extension/" + path,
      sendMessage: (request) => request.dst === "BACKGROUND" ? backgroundRouter(request, contentSender) : Promise.resolve(),
    },
    tabs: {
      query: async () => [{ id: 99 }],
      sendMessage: async (tabId, request, options) => {
        delivered.push({ tabId, request, options });
        if (holdInsertion) await holdInsertion;
        if (failInsertion) return { statusCode: 500, data: {} };
        const response = await contentRouter(request);
        if (response?.statusCode === 200 && request.method === "PUT") inserted.push(request.data.text);
        return response;
      },
    },
  };
  t.after(() => { globalThis.chrome = previousChrome; });
  const toneRequests = [];
  let failTone = false;
  let resolveTone;
  let holdTone = false;
  const correctTone = async (tone) => {
    toneRequests.push(tone);
    if (failTone) throw new Error("톤 교정 실패");
    if (holdTone) return new Promise((resolve) => { resolveTone = resolve; });
    return "(톤교정)작성한 본문";
  };
  let stop;
  await act(async () => { stop = startPopup({ selector: "#editor", getTemplates, insertText: insertTemplate, correctTone, getEditorText }); });
  const host = document.querySelector("#snip-text-mini-popup");
  assert.equal(host.shadowRoot, null);
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
  assert.equal(host.querySelectorAll('[role="option"]').length, 2);
  assert.ok(document.activeElement === editor);
  await act(async () => {
    for (const selector of [".popup", "header", '[role="listbox"]']) {
      const target = host.querySelector(selector);
      const mouseDown = new window.MouseEvent("mousedown", { bubbles: true, cancelable: true });
      target.dispatchEvent(mouseDown);
      assert.equal(mouseDown.defaultPrevented, true, "Popup whitespace preserves editor focus");
      document.dispatchEvent(new window.Event("selectionchange"));
      await settle();
      assert.ok(document.activeElement === editor);
      assert.equal(host.querySelectorAll('[role="option"]').length, 2);
    }
    const optionMouseDown = new window.MouseEvent("mousedown", { bubbles: true, cancelable: true });
    host.querySelector('[role="option"] span').dispatchEvent(optionMouseDown);
    assert.equal(optionMouseDown.defaultPrevented, false, "Option buttons keep native focus behavior");
  });
  const stopEditorKeyBubbling = (event) => event.stopPropagation();
  const scrollingList = host.querySelector('[role="listbox"]');
  Object.defineProperty(scrollingList, "clientHeight", { value: 100 });
  Object.defineProperty(scrollingList, "scrollHeight", { value: 150 });
  scrollingList.getBoundingClientRect = () => ({ top: 100, bottom: 200 });
  host.querySelectorAll('[role="option"]').forEach((option, index) => {
    option.getBoundingClientRect = () => ({
      top: 100 + index * 100 - scrollingList.scrollTop,
      bottom: 140 + index * 100 - scrollingList.scrollTop,
    });
  });
  editor.addEventListener("keydown", stopEditorKeyBubbling);
  await act(async () => { key(editor, "ArrowDown"); });
  assert.equal(scrollingList.scrollTop, 50, "The last option reveals the list's bottom padding");
  assert.equal(host.querySelectorAll('[role="option"]')[1].getAttribute("aria-selected"), "true");
  await act(async () => { key(editor, "ArrowUp"); });
  assert.equal(scrollingList.scrollTop, 0, "The first option reveals the list's top padding");
  assert.equal(host.querySelector('[role="option"]').getAttribute("aria-selected"), "true");
  await act(async () => { key(editor, "ArrowDown"); });
  editor.removeEventListener("keydown", stopEditorKeyBubbling);
  const requestsBeforeSelectionChange = requests;
  await act(async () => {
    document.dispatchEvent(new window.Event("selectionchange"));
    await settle();
  });
  assert.equal(requests, requestsBeforeSelectionChange, "An unchanged query must not reload templates");
  assert.equal(host.querySelectorAll('[role="option"]')[1].getAttribute("aria-selected"), "true");
  await act(async () => { host.querySelector('[role="option"]').dispatchEvent(new window.Event("pointermove", { bubbles: true })); });
  assert.equal(scrollingList.scrollTop, 50, "Pointer movement does not scroll the list");
  assert.equal(host.querySelector('[role="option"]').getAttribute("aria-selected"), "true");
  await act(async () => { key(editor, "Enter"); });
  assert.equal(inserted.at(-1), "일반 본문");

  await open();
  await act(async () => { host.querySelector('[role="option"]').focus(); });
  await act(async () => { key(document.activeElement, "ArrowDown"); });
  assert.ok(document.activeElement === host.querySelectorAll('[role="option"]')[1]);
  assert.equal(document.activeElement.getAttribute("aria-selected"), "true");
  await act(async () => { key(document.activeElement, "ArrowDown"); });
  assert.ok(document.activeElement === host.querySelector('[role="option"]'), "ArrowDown wraps to the first option");
  await act(async () => { key(document.activeElement, "ArrowUp"); });
  assert.ok(document.activeElement === host.querySelectorAll('[role="option"]')[1], "ArrowUp wraps to the last option");
  await act(async () => {
    const option = host.querySelectorAll('[role="option"]')[1];
    option.focus();
    const enter = new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    option.dispatchEvent(enter);
    assert.equal(enter.defaultPrevented, false, "Focused buttons keep native Enter activation");
    option.click();
  });
  assert.ok(host.querySelector("input"), "The focused option is chosen, regardless of the active index");
  await act(async () => { key(host.querySelector("input"), "Escape"); });

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
    assert.notEqual(host.style.display, "none");
    assert.ok(requests > requestsBeforeSyllable);
    const composingOptions = host.querySelectorAll('[role="option"]');
    assert.equal(composingOptions.length, query === "겨" ? 0 : 1);
    if (query !== "겨") assert.match(composingOptions[0].getAttribute("aria-label"), /견적/);
    assert.equal(inserted.length, 1);
    await act(async () => {
      window.getSelection().collapse(editor.firstChild, query.length + 1);
      editor.dispatchEvent(new window.CompositionEvent("compositionend", { bubbles: true }));

      await settle();
    });
    assert.notEqual(host.style.display, "none");
    assert.equal(host.querySelectorAll('[role="option"]').length, query === "겨" ? 0 : 1);
    if (query !== "겨") assert.match(host.querySelector('[role="option"]').textContent, /견적/);
  }
  assert.ok(requests > beforeComposition);
  assert.equal(inserted.length, 1);

  await open();
  await act(async () => {
    editor.dispatchEvent(new window.CompositionEvent("compositionstart", { bubbles: true }));
    editor.textContent = "/견적";
    window.getSelection().collapse(editor.firstChild, 3);
    editor.dispatchEvent(new window.InputEvent("input", { bubbles: true, isComposing: true }));
    key(editor, "Enter", { isComposing: true });
    editor.dispatchEvent(new window.CompositionEvent("compositionend", { bubbles: true }));
    await settle();
  });
  assert.equal(host.querySelector("input"), null, "IME confirmation must not select a template");
  await act(async () => { key(editor, "Enter"); });
  assert.ok(host.querySelector("input"));
  await act(async () => { key(host.querySelector("input"), "Escape"); });

  await open();
  await act(async () => { key(editor, "ArrowDown"); key(editor, "Enter"); });
  assert.ok(document.activeElement === host.querySelector("input"));
  const [name, amount] = host.querySelectorAll("input");
  await act(async () => {
    const label = host.querySelector("label");
    const mouseDown = new window.MouseEvent("mousedown", { bubbles: true, cancelable: true });
    label.dispatchEvent(mouseDown);
    assert.equal(mouseDown.defaultPrevented, false);
    name.value = "민";
    name.dispatchEvent(new window.Event("input", { bubbles: true }));
    const typing = new window.KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
    name.dispatchEvent(typing);
    assert.equal(typing.defaultPrevented, false);
    const tab = new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    name.dispatchEvent(tab);
    assert.equal(tab.defaultPrevented, false);
  });
  assert.equal(name.value, "민");
  await act(async () => {
    name.dispatchEvent(new window.CompositionEvent("compositionstart", { bubbles: true, composed: true }));
    key(name, "Enter", { isComposing: true });
    host.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  });
  assert.equal(inserted.length, 1);
  await act(async () => {
    name.dispatchEvent(new window.CompositionEvent("compositionend", { bubbles: true, composed: true }));
    // Browsers and page focus handlers can briefly leave focus on body while
    // moving to another input. This is not a request to dismiss the form.
    name.blur();
    await settle();
    assert.ok(host.querySelector(".variable-entry"));
    amount.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true }));
    amount.focus();
    await settle();
    amount.value = "";
    amount.dispatchEvent(new window.Event("input", { bubbles: true, composed: true }));
  });
  assert.ok(document.activeElement === amount);
  assert.ok(host.querySelector(".variable-entry"), "Moving focus between popup inputs keeps the form open");
  await act(async () => { host.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
  assert.equal(delivered.at(-1).request.data.text, "민님 {{금액}}원");
  assert.equal(host.querySelector('[role="status"]').textContent, "템플릿의 변수를 모두 입력해 주세요.");
  assert.equal(inserted.length, 1, "Missing variables must not be inserted");
  assert.equal(editor.textContent, "/");
  await act(async () => {
    const amountInput = host.querySelectorAll("input")[1];
    amountInput.value = "100";
    amountInput.dispatchEvent(new window.Event("input", { bubbles: true, composed: true }));
  });
  await act(async () => { host.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
  assert.equal(inserted.at(-1), "민님 100원");
  await open();
  await act(async () => { key(editor, "ArrowDown"); key(editor, "Enter"); });
  let pageEscapes = 0;
  const handlePageEscape = (event) => { if (event.key === "Escape") pageEscapes++; };
  document.addEventListener("keydown", handlePageEscape);
  await act(async () => { key(host.querySelector("input"), "Escape"); });
  document.removeEventListener("keydown", handlePageEscape);
  assert.equal(pageEscapes, 0, "Returning to the list must not trigger the mail page's Escape handling");
  assert.equal(editor.textContent, "/");
  assert.equal(inserted.length, 2);
  assert.equal(host.querySelectorAll('[role="option"]').length, 2);
  assert.ok(document.activeElement === host.querySelectorAll('[role="option"]')[1]);
  assert.equal(document.activeElement.getAttribute("aria-selected"), "true");
  await act(async () => host.querySelectorAll('[role="option"]')[1].click());
  let leakedInputKeys = 0;
  const observeInputKey = () => leakedInputKeys++;
  for (const type of ["keydown", "keyup", "keypress"]) window.addEventListener(type, observeInputKey, true);
  try {
    for (const type of ["keydown", "keyup", "keypress"]) {
      const event = new window.KeyboardEvent(type, { key: "a", bubbles: true, cancelable: true });
      await act(async () => host.querySelector("input").dispatchEvent(event));
      assert.equal(event.defaultPrevented, false, "Text entry keeps its native default action");
    }
    assert.equal(leakedInputKeys, 0, "Input keyboard events must stay inside the popup");
  } finally {
    for (const type of ["keydown", "keyup", "keypress"]) window.removeEventListener(type, observeInputKey, true);
  }
  await act(async () => host.querySelector('button[type="button"]').click());
  const requestsBeforeCancel = requests;
  await act(async () => { host.querySelectorAll('[role="option"]')[1].click(); });
  await act(async () => { host.querySelector('button[type="button"]').click(); });
  assert.equal(host.querySelectorAll('[role="option"]').length, 2, "Cancel returns to the previous list");
  assert.ok(document.activeElement === host.querySelectorAll('[role="option"]')[1]);
  assert.equal(requests, requestsBeforeCancel, "Returning to the list does not reload templates");
  let mailArrowCalls = 0;
  const mailWindowKeyHandler = (event) => {
    if (event.key !== "ArrowUp") return;
    mailArrowCalls++;
    document.body.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true }));
  };
  window.addEventListener("keydown", mailWindowKeyHandler, true);
  try {
    await act(async () => { key(document.activeElement, "ArrowUp"); });
    assert.notEqual(host.style.display, "none", "Input → cancel → ArrowUp keeps the popup open even with a mail window key handler");
    assert.equal(mailArrowCalls, 0, "Consumed navigation must not reach other window capture handlers");
    assert.equal(document.activeElement === host.querySelector('[role="option"]'), true);
    assert.equal(inserted.length, 2, "ArrowUp must not insert a template");
  } finally {
    window.removeEventListener("keydown", mailWindowKeyHandler, true);
  }

  await act(async () => { key(document.activeElement, "Escape"); });
  assert.notEqual(host.style.display, "none", "Escape must not close the popup");
  await act(async () => {
    editor.focus();
    const caret = document.createRange();
    caret.setStart(editor.firstChild, 0);
    caret.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(caret);
    document.dispatchEvent(new window.Event("selectionchange"));
    await settle();
  });
  assert.notEqual(host.style.display, "none", "Losing the slash trigger through caret movement keeps the popup open");


  await open();
  await act(async () => { key(editor, "ArrowDown"); key(editor, "Enter"); });
  const outside = document.createElement("input");
  document.body.append(outside);
  await act(async () => { outside.focus(); });
  assert.notEqual(host.style.display, "none", "Keyboard focus outside keeps the popup open");
  await act(async () => document.body.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true })));
  outside.remove();

  await open();
  await act(async () => { key(editor, "ArrowDown"); key(editor, "Enter"); });
  await act(async () => {
    document.body.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true }));
  });
  assert.equal(host.style.display, "none", "Pointer interaction outside closes the popup");

  await open();
  await act(async () => { key(editor, "Enter"); });
  assert.equal(editor.textContent, "일반 본문");
  assert.equal(window.getSelection().isCollapsed, true);

  await act(async () => {
    editor.focus();
    editor.innerHTML = '<span>앞 문장 </span><b>/</b><i>1</i><span> 뒷 문장</span>';
    const caret = document.createRange();
    caret.setStart(editor.querySelector("i").firstChild, 1);
    caret.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(caret);
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    await settle();
  });
  await act(async () => { host.querySelector('[role="option"]').click(); });
  assert.equal(editor.textContent, "일반 본문", "The existing insertion API replaces the full body");
  assert.ok(document.activeElement === editor);
  assert.equal(window.getSelection().isCollapsed, true);

  await open();
  await act(async () => { key(editor, "ArrowDown"); key(editor, "Enter"); });
  await act(async () => {
    editor.textContent = "메일 페이지에서 갱신한 본문";
    host.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  });
  assert.equal(editor.textContent, "메일 페이지에서 갱신한 본문", "A stale trigger must not overwrite the updated editor");
  assert.notEqual(host.style.display, "none", "A stale trigger reports an error without closing");
  assert.match(host.querySelector('[role="status"]').textContent, /작성 창이 변경/);

  const multilineEditor = document.createElement("div");
  multilineEditor.setAttribute("contenteditable", "true");
  multilineEditor.tabIndex = 0;
  multilineEditor.textContent = "앞 / 뒤";
  document.body.append(multilineEditor);
  const multiline = ' <b>본문</b>  & "문자"\r\n\r\n 다음 줄 \n';
  assert.equal(insertTextToEditor(multilineEditor, encodeEditorText(multiline)).isInserted, true);
  const visibleText = [...multilineEditor.childNodes].map((node) => node.nodeName === "BR" ? "\n" : node.textContent).join("");
  assert.equal(visibleText, encodeEditorText(multiline));
  assert.equal(multilineEditor.querySelectorAll("br").length, 3, "Empty and trailing lines are preserved");
  assert.equal(multilineEditor.querySelector("b"), null, "Template HTML remains literal text");
  assert.match(multilineEditor.innerHTML, /&lt;b&gt;본문&lt;\/b&gt;/);
  assert.equal(window.getSelection().isCollapsed, true);
  assert.equal(window.getSelection().getRangeAt(0).endContainer, multilineEditor);
  assert.equal(window.getSelection().getRangeAt(0).endOffset, multilineEditor.childNodes.length);
  multilineEditor.remove();

  const { createPopupDom } = await import(moduleUrl("../packages/mini-popup/src/dom/popup.ts"));
  const scrollFixture = document.createElement("div");
  scrollFixture.innerHTML = '<div role="listbox" style="scroll-padding-top: 10px; scroll-padding-bottom: 12px"><button role="option"></button><button role="option"></button><button role="option"></button></div>';
  document.body.append(scrollFixture);
  const paddedList = scrollFixture.firstElementChild;
  const middleOption = paddedList.children[1];
  Object.defineProperty(paddedList, "clientHeight", { value: 100 });
  paddedList.getBoundingClientRect = () => ({ top: 100, bottom: 200 });
  middleOption.getBoundingClientRect = () => ({ top: 180, bottom: 210 });
  createPopupDom(scrollFixture).revealOption(1);
  assert.equal(paddedList.scrollTop, 22, "Middle options leave the configured bottom spacing");
  middleOption.getBoundingClientRect = () => ({ top: 95, bottom: 125 });
  createPopupDom(scrollFixture).revealOption(1);
  assert.equal(paddedList.scrollTop, 7, "Middle options leave the configured top spacing");
  middleOption.getBoundingClientRect = () => ({ top: 115, bottom: 150 });
  createPopupDom(scrollFixture).revealOption(1);
  assert.equal(paddedList.scrollTop, 7, "Visible options with sufficient spacing do not scroll");
  scrollFixture.remove();

  assert.ok(delivered.every(({ tabId, options }) => tabId === 42 && options.frameId === 3), "Popup requests return to their sender tab and frame, not the active tab");
  const insertionRequest = { src: "CONTENT", dst: "BACKGROUND", method: "PUT", path: "/editor/insert-text", data: { text: "body" } };
  const beforeRejected = delivered.length;
  assert.equal(await backgroundRouter(insertionRequest, { ...contentSender, url: "https://example.com/" }), undefined);
  assert.equal((await backgroundRouter({ ...insertionRequest, data: { text: null } }, contentSender)).statusCode, 400);
  assert.equal(delivered.length, beforeRejected);
  await open();
  await act(async () => { key(editor, "ArrowDown"); key(editor, "Enter"); });
  failInsertion = true;
  await act(async () => { host.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
  assert.match(host.querySelector('[role="status"]').textContent, /삽입하지 못했습니다/);
  assert.ok(host.querySelector("input"), "A failed request keeps variable values available for retry");
  failInsertion = false;
  let finishInsertion;
  holdInsertion = new Promise((resolve) => { finishInsertion = resolve; });
  const beforePending = delivered.length;
  await act(async () => {
    host.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    host.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  });
  assert.equal(delivered.length, beforePending + 1, "Only one insertion request is allowed at a time");
  assert.equal(host.querySelector("input").disabled, true);
  await act(async () => document.body.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true })));
  assert.equal(host.style.display, "none", "Outside clicks close the popup even while insertion is pending");
  await act(async () => { finishInsertion(); await settle(); });
  holdInsertion = undefined;
  assert.equal(host.style.display, "none");

  const pageSender = { id: "extension", url: "chrome-extension://extension/src/page/index.html" };
  const statusRequest = { src: "PAGE", dst: "BACKGROUND", method: "GET", path: "/editor/status", data: { vendorName: "GOOGLE" } };
  assert.equal((await backgroundRouter(statusRequest, pageSender)).statusCode, 200);
  assert.equal(await backgroundRouter({ ...statusRequest, src: "CONTENT" }, contentSender), undefined);
  const updateRequest = { src: "CONTENT", dst: "BACKGROUND", method: "PUT", path: "/editor/update-status", data: { vendorName: "GOOGLE", status: { isEditable: true } } };
  assert.equal((await backgroundRouter(updateRequest, contentSender)).statusCode, 200);
  assert.equal(await backgroundRouter({ ...updateRequest, src: "PAGE" }, pageSender), undefined);
  assert.equal(await backgroundRouter({ ...updateRequest, data: { vendorName: "NAVER", status: { isEditable: true } } }, contentSender), undefined);
  assert.equal((await backgroundRouter({ ...updateRequest, data: { vendorName: "GOOGLE", status: { isEditable: "invalid" } } }, contentSender)).statusCode, 400);
  let pageResponse;
  await act(async () => { pageResponse = await backgroundRouter({ ...insertionRequest, src: "PAGE", data: { text: "사이드바 본문" } }, pageSender); });
  assert.equal(pageResponse.statusCode, 200);
  assert.equal(editor.textContent, "사이드바 본문", "Sidebar requests still replace the full body");
  assert.equal(delivered.at(-1).tabId, 99);
  assert.deepEqual(delivered.at(-1).request.data, { text: "사이드바 본문" });

  const normalizedRequest = {
    src: "BACKGROUND", dst: "CONTENT", method: "PUT", path: "/editor/insert-text",
    data: { text: "\u200b\u1100\u1161\u11a8 e\u0301  👩🏽‍💻\r\n 다음 " },
  };
  const originalRequestText = normalizedRequest.data.text;
  let normalizedResponse;
  await act(async () => { normalizedResponse = await contentRouter(normalizedRequest); });
  assert.equal(normalizedResponse.statusCode, 200);
  assert.equal([...editor.childNodes].map((node) => node.nodeName === "BR" ? "\n" : node.textContent).join(""), "각 é\u00a0\u00a0👩🏽‍💻\n\u00a0다음\u00a0");
  assert.equal(normalizedRequest.data.text, originalRequestText, "Normalization does not mutate the request");
  for (const text of [null, 123, {}, "\u200b"]) {
    assert.equal((await contentRouter({ ...normalizedRequest, data: { text } })).statusCode, 400);
  }

  const textRequest = { src: "CONTENT", dst: "BACKGROUND", method: "GET", path: "/editor/text", data: {} };
  const { service: editorService } = await import(moduleUrl("../src/background/editor/service.ts"));
  await editorService.updateEditorStatus("GOOGLE", { text: "저장된 본문" });
  const deliveredBeforeRead = delivered.length;
  assert.equal((await backgroundRouter(textRequest, contentSender)).data.text, "저장된 본문");
  assert.equal(await backgroundRouter(textRequest, { ...contentSender, url: "https://example.com/" }), undefined);
  assert.equal((await backgroundRouter({ ...textRequest, src: "PAGE", data: { vendorName: "GOOGLE" } }, pageSender)).data.text, "저장된 본문");
  assert.equal((await backgroundRouter({ ...textRequest, src: "PAGE" }, pageSender)).statusCode, 400);
  assert.equal(delivered.length, deliveredBeforeRead, "Text reads must not send messages to CONTENT");
  await editorService.updateEditorStatus("GOOGLE", { text: "" });
  assert.equal((await backgroundRouter(textRequest, contentSender)).data.text, "", "Empty stored bodies are valid responses");

  async function openTone(text = "작성한 본문 /톤교정") {
    await act(async () => {
      editor.focus();
      editor.textContent = text;
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      await editorService.updateEditorStatus("GOOGLE", { text });
      editor.dispatchEvent(new window.Event("input", { bubbles: true }));
      await settle();
    });
    assert.match(host.querySelector('[role="option"]').textContent, /톤교정/);
    await act(async () => { key(editor, "Enter"); });
    assert.equal(host.querySelectorAll('[role="option"]').length, 7);
    assert.equal(host.querySelectorAll('.popup-group > .popup').length, 2);
    assert.equal(document.activeElement === host.querySelector('.tone-menu [role="option"]'), true, "Enter moves focus into the right tone menu");
  }
  await openTone();
  await act(async () => { key(document.activeElement, "ArrowUp"); });
  assert.equal(document.activeElement.textContent, "감성/에세이");
  assert.equal(window.getComputedStyle(document.activeElement).backgroundColor, "rgb(217, 217, 217)", "Keyboard selection remains visibly highlighted in the tone menu");

  assert.notEqual(host.style.display, "none");
  await act(async () => { key(document.activeElement, "ArrowDown"); });
  assert.equal(document.activeElement.textContent, "상사/외부용");
  failTone = true;
  await act(async () => host.querySelector('[role="option"]').click());
  assert.match(host.querySelector('[role="status"]').textContent, /톤 교정 실패/);
  failTone = false;
  await act(async () => host.querySelectorAll('[role="option"]')[6].dispatchEvent(new window.Event("pointermove", { bubbles: true })));
  await act(async () => { key(document.activeElement, "Enter"); });
  assert.equal(inserted.at(-1), "(톤교정)작성한 본문");
  assert.equal(host.style.display, "none");
  assert.deepEqual(toneRequests, ["상사/외부용", "상사/외부용"]);

  await openTone("작성한 본문/톤교정");
  holdTone = true;
  const countBeforeTone = inserted.length;
  await act(async () => host.querySelector('[role="option"]').click());
  assert.equal(host.querySelector('.popup-spinner'), null, "Fast requests do not flash a spinner");
  await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
  assert.ok(host.querySelector('.popup-spinner'), "Delayed tone requests show a spinner");
  await act(async () => {
    editor.textContent = "요청 중 변경한 본문";
    await editorService.updateEditorStatus("GOOGLE", { text: editor.textContent });
    resolveTone("교정 결과");
    await settle();
  });
  assert.equal(inserted.length, countBeforeTone, "Late correction must not overwrite a changed editor");
  assert.equal(host.querySelector('.popup-spinner'), null, "Spinner clears when the request finishes");
  assert.match(host.querySelector('[role="status"]').textContent, /작성 창이 변경/);
  await act(async () => document.body.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true })));
  holdTone = false;

  await openTone();
  await act(async () => {
    editor.textContent = "작성한 본문 톤교정";
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  assert.equal(host.style.display, "none", "Removing the slash closes the tone menu");

  async function editCommand(text) {
    await act(async () => {
      editor.focus();
      editor.textContent = text;
      const caret = document.createRange();
      caret.selectNodeContents(editor);
      caret.collapse(false);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(caret);
      editor.dispatchEvent(new window.Event("input", { bubbles: true }));
      await settle();
    });
  }
  for (const prefix of ["", "작성한 본문", "작성한 본문 "]) {
    await editCommand(prefix + "/톤교");
    assert.match(host.querySelector('[role="option"]').textContent, /톤교정/);
    await editCommand(prefix + "/톤ㅇ");
    assert.equal(host.querySelector('.reserved-command'), null, "An invalid tone prefix must remove the reserved command");
    assert.equal(host.querySelector('.tone-menu'), null);
  }
  await openTone();
  await editCommand("작성한 본문/톤ㅇ");
  assert.equal(host.querySelector('.tone-menu'), null, "Editing the command also leaves the tone submenu");
  assert.equal(host.style.display, "none");

  failLoad = true;
  await open();
  assert.match(host.querySelector(".message").textContent, /불러오지 못했습니다/);
  failLoad = false;
  holdResponse = true;
  const insertedBeforeLoading = inserted.length;
  await open();
  assert.ok(deferred);
  const deletedTriggerResponse = deferred;
  await act(async () => {
    editor.textContent = "본문";
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    deletedTriggerResponse(templates);
    await settle();
  });
  assert.equal(host.style.display, "none", "Late results must not reopen a popup after slash deletion");
  await open();
  await act(async () => { key(editor, "Enter"); deferred(templates); await settle(); });
  assert.equal(inserted.length, insertedBeforeLoading, "Enter during loading must not queue insertion");
  assert.equal(host.querySelectorAll('[role="option"]').length, 2);
  await act(async () => { key(editor, "Escape"); });
  await open();
  await act(async () => {
    document.body.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true }));
    deferred(templates);
    await settle();
  });
  assert.equal(host.style.display, "none");

  await open();
  const pending = deferred;
  const requestCount = requests;
  await act(async () => { stop(); stop(); stop = () => {}; });
  assert.equal(host.isConnected, false);
  await act(async () => {
    pending(templates);
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    await settle();
  });
  assert.equal(requests, requestCount);
  assert.equal(host.isConnected, false);

});

test("popup actions synchronize current editor before tone correction", async (t) => {
  const { createMiniPopupActions } = await import(moduleUrl("../packages/mini-popup/src/actions.ts"));
  const requests = [];
  let text = "작성한 본문 /톤교정";
  const previousChrome = globalThis.chrome;
  t.after(() => { globalThis.chrome = previousChrome; });
  globalThis.chrome = { runtime: { sendMessage: async (request) => {
      requests.push(request);
      return { statusCode: 200, data: { text: "교정한 본문" } };
    } } };
  const actions = createMiniPopupActions({
    vendorName: "GOOGLE",
    getEditorStatus: () => ({ text, isEditable: true }),
  });
  assert.equal(await actions.correctTone("정중하게"), "교정한 본문");
  assert.deepEqual(requests.map(({ path }) => path), ["/editor/update-status", "/ai/tone-correction"]);
  assert.deepEqual(requests[0].data, { vendorName: "GOOGLE", status: { text, isEditable: true } });
  text = "/톤교정";
  await assert.rejects(actions.correctTone("정중하게"), /교정할 본문/);
  assert.equal(requests.length, 2);
});
