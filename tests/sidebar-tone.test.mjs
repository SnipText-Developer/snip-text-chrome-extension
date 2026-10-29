import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { moduleUrl } from "./module-url.mjs";

const { default: ToneCorrectionPage } = await import(moduleUrl("../packages/sidebar/src/components/ToneCorrectionPage.tsx", {
  'import "./ToneCorrectionPage.css";': '',
}));
const { EditorStatusContext } = await import(moduleUrl("../packages/sidebar/src/context/editorStatusContext.ts"));

test("sidebar requests tone correction and shows loading, success and retry states", async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  for (const name of ["window", "document", "HTMLElement", "Element", "Node"]) {
    globalThis[name] = name === "window" ? dom.window : dom.window[name];
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const previousChrome = globalThis.chrome;
  const requests = [];
  let resolveRequest;
  globalThis.chrome = { runtime: { sendMessage: (request) => {
    requests.push(request);
    return new Promise((resolve) => { resolveRequest = resolve; });
  } } };
  const root = createRoot(document.querySelector("#root"));
  const editor = { vendorName: "GOOGLE", text: "작성한 본문", isEditable: true, prevTexts: [], receivedAt: 0, updateCount: 1 };
  t.after(async () => {
    await act(async () => root.unmount());
    globalThis.chrome = previousChrome;
    dom.window.close();
  });
  await act(async () => root.render(createElement(EditorStatusContext.Provider, {
    value: { latestStatus: editor, statuses: { GOOGLE: editor } },
  }, createElement(ToneCorrectionPage, { onClose() {} }))));
  assert.equal(document.querySelector("#tone-text").value, "작성한 본문");
  assert.equal(document.querySelector("#tone-text").readOnly, true);
  await act(async () => document.querySelector('input[type="radio"]').click());
  const submit = () => document.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await act(async () => { submit(); submit(); });
  assert.equal(requests.length, 1, "Duplicate submissions are suppressed");
  assert.deepEqual(requests[0], {
    src: "PAGE", dst: "BACKGROUND", method: "POST", path: "/ai/tone-correction",
    data: { vendorName: "GOOGLE", tone: "상사/외부용" },
  });
  assert.ok(document.querySelector(".tone-spinner"));
  assert.equal(document.querySelector('button[type="submit"]').disabled, true);
  assert.equal(document.querySelector("fieldset").disabled, true);
  await act(async () => resolveRequest({ statusCode: 200, data: { text: "(톤교정)작성한 본문" } }));
  assert.equal(document.querySelector("#tone-result"), null);
  assert.equal(document.querySelector('button[type="submit"]').disabled, true);
  assert.equal(document.querySelector('[role="status"]').textContent, "본문에 삽입 중입니다.");
  await act(async () => { submit(); submit(); });
  assert.equal(requests.length, 2, "Automatic insertion suppresses duplicate correction requests");
  assert.deepEqual(requests[1], {
    src: "PAGE", dst: "BACKGROUND", method: "PUT", path: "/editor/insert-text",
    data: { text: "(톤교정)작성한 본문" },
  });
  await act(async () => resolveRequest({ statusCode: 500, data: { msg: "작성 창 없음" } }));
  assert.equal(document.querySelector('[role="status"]').textContent, "작성 창 없음");
  assert.equal(document.querySelector('button[type="submit"]').disabled, false);
  await act(async () => submit());
  await act(async () => resolveRequest({ statusCode: 200, data: { text: "교정된 본문" } }));
  assert.deepEqual(requests.at(-1).data, { text: "교정된 본문" });
  await act(async () => resolveRequest({ statusCode: 200, data: {} }));
  assert.equal(document.querySelector('[role="status"]').textContent, "교정 결과를 본문에 삽입했습니다.");
  assert.equal(document.querySelector('button[type="submit"]').disabled, false);
  await act(async () => submit());
  await act(async () => resolveRequest({ statusCode: 500, data: { msg: "요청 실패" } }));
  assert.equal(document.querySelector('[role="status"]').textContent, "요청 실패");
  assert.equal(document.querySelector(".tone-spinner"), null);
  assert.equal(document.querySelector('button[type="submit"]').disabled, false);
  await act(async () => submit());
  await act(async () => resolveRequest({ statusCode: 200, data: {} }));
  assert.match(document.querySelector('[role="status"]').textContent, /교정 결과를 받지 못했습니다/);
});

test("InsertBodyButton inserts its text without an onClick prop", async (t) => {
  const { default: InsertBodyButton } = await import(moduleUrl("../packages/sidebar/src/components/InsertBodyButton.tsx"));
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  for (const name of ["window", "document", "HTMLElement", "Element", "Node"]) {
    globalThis[name] = name === "window" ? dom.window : dom.window[name];
  }
  const previousChrome = globalThis.chrome;
  const requests = [];
  let resolve;
  globalThis.chrome = { runtime: { sendMessage: (request) => {
    requests.push(request);
    return new Promise((done) => { resolve = done; });
  } } };
  const root = createRoot(document.querySelector("#root"));
  t.after(async () => {
    await act(async () => root.unmount());
    globalThis.chrome = previousChrome;
    dom.window.close();
  });
  await act(async () => root.render(createElement(InsertBodyButton, { text: "{{이름}}님\n안녕하세요." })));
  await act(async () => { document.querySelector("button").click(); document.querySelector("button").click(); });
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].data, { text: "{{이름}}님\n안녕하세요." });
  assert.equal(document.querySelector("button").disabled, false, "Pending requests must not flash the disabled style");
  await act(async () => resolve({ statusCode: 500, data: { msg: "본문 삽입 실패" } }));
  assert.equal(document.querySelector('[role="status"]').textContent, "본문 삽입 실패");
  assert.equal(document.querySelector("button").disabled, false);
  await act(async () => document.querySelector("button").click());
  await act(async () => resolve({ statusCode: 200, data: {} }));
  assert.equal(document.querySelector('[role="status"]').textContent, "본문에 삽입했습니다.");
});
