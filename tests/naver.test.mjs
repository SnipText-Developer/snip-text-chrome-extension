import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { moduleUrl } from "./module-url.mjs";

const { getContentVendor } = await import(moduleUrl("../src/background/common/message-sender.ts"));
const { router: templateRouter } = await import(moduleUrl("../src/background/template/router.ts"));
const { vendors } = await import(moduleUrl("../src/config/vendors.ts"));
const vendor = vendors.find((item) => item.script === "naver");
const { runWhenElementExists } = await import(moduleUrl("../src/content/common/run-when-element-exists.ts"));
const asModule = (source) => "data:text/javascript;base64," + Buffer.from(source).toString("base64");

function createDocument(t, markup = "<!doctype html><body></body>") {
  const dom = new JSDOM(markup, { url: "about:blank" });
  for (const name of ["window", "document", "MutationObserver"]) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value: name === "window" ? dom.window : dom.window[name], configurable: true, writable: true });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else delete globalThis[name];
    });
  }
  t.after(() => dom.window.close());
  return dom.window;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test("네이버 관련 프레임은 Chrome이 제공한 origin으로 템플릿 조회 가능", async (t) => {
  const previous = globalThis.chrome;
  globalThis.chrome = {
    runtime: { id: "extension", getURL: (path) => "chrome-extension://extension/" + path },
    storage: { local: { get: async () => ({ "snip.templates": [] }) } },
  };
  t.after(() => { globalThis.chrome = previous; });
  const base = { id: "extension", tab: { id: 3 }, frameId: 7, origin: `https://${vendor.hostname}` };
  const request = { src: "CONTENT", dst: "BACKGROUND", method: "GET", path: "/template/list", data: {} };
  for (const url of ["about:blank", "about:srcdoc", `blob:https://${vendor.hostname}/document`, "data:text/html,editor"]) {
    const sender = { ...base, url };
    assert.equal(getContentVendor(sender), vendor.id);
    const response = await templateRouter(request, sender);
    assert.equal(response.statusCode, 200);
    assert.ok(Array.isArray(response.data.templates));
  }
  for (const sender of [
    { ...base, url: "about:blank", origin: "null" },
    { ...base, url: "about:blank", origin: undefined },
    { ...base, url: "about:blank", origin: "https://example.com" },
    { ...base, url: "https://example.com" },
    { ...base, url: "http://mail.naver.com" },
    { ...base, url: "about:blank", id: "another-extension" },
    { ...base, url: "about:blank", tab: undefined },
  ]) {
    assert.equal(getContentVendor(sender), null);
    assert.equal(await templateRouter(request, sender), undefined);
  }
});

test("늦게 생성된 네이버 편집기도 팝업과 라우터를 한 번만 초기화", async (t) => {
  const window = createDocument(t);
  await import(moduleUrl("../src/content/naver.ts", {
    '"./common/wrap-run-after-render"': JSON.stringify(asModule('export function runAfterRender(callback) { callback(); }')),
    '"./controller/editor-handler/observer/url-observer"': JSON.stringify(asModule('export class UrlObserver { start() {} }')),
    '"./controller/editor-handler"': JSON.stringify(asModule('export function startEditorObserver(options) { window.boots = (window.boots || 0) + 1; window.options = options; return { getEditor: () => document.querySelector(options.selector), getEditorStatus: () => ({}) }; }')),
    '"./editor-router"': JSON.stringify(asModule('export function createEditorRouter() { return () => {}; } export function listenEditorRouter() { window.routes = (window.routes || 0) + 1; }')),
  }));
  assert.equal(window.boots, undefined);
  const editor = window.document.createElement("div");
  editor.className = "workseditor-content additional-class";
  editor.setAttribute("contenteditable", "true");
  window.document.body.append(editor);
  await flush();
  assert.equal(window.boots, 1);
  assert.equal(window.routes, 1);
  assert.equal(window.options.vendorName, vendor.id);
  assert.ok(editor.matches(window.options.selector));
  editor.append("later text");
  await flush();
  assert.equal(window.boots, 1);
});

test("편집기의 contenteditable 속성이 나중에 설정되어도 감지", async (t) => {
  const window = createDocument(t, '<!doctype html><body><div class="workseditor-content"></div></body>');
  let started = 0;
  runWhenElementExists(vendor.editorSelector, () => { started++; });
  window.document.querySelector("div").setAttribute("contenteditable", "true");
  await flush();
  assert.equal(started, 1);
});

test("페이지가 종료되면 편집기 대기를 중단", async (t) => {
  const window = createDocument(t);
  let started = 0;
  runWhenElementExists(vendor.editorSelector, () => { started++; });
  window.dispatchEvent(new window.Event("pagehide"));
  window.document.body.innerHTML = '<div class="workseditor-content" contenteditable="true"></div>';
  await flush();
  assert.equal(started, 0);
});
