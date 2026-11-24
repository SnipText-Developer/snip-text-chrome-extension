import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { moduleUrl } from "./module-url.mjs";

const { default: App } = await import(moduleUrl("../packages/sidebar/src/App.tsx"));

test("the sidebar refreshes templates upon login and supports logout and guest templates", async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  let checks = 0;
  let refreshes = 0;
  let authenticated = false;
  let resolveRecheck;
  let loggedOut = false;
  const event = { addListener() {}, removeListener() {} };
  const storageListeners = new Set();
  let templates = [];
  globalThis.chrome = {
    runtime: {
      onMessage: event,
      async sendMessage(request) {
        if (request.path === "/template/list") {
          return { statusCode: 200, data: { templates } };
        }
        if (request.path === "/template/refresh") {
          assert.equal(request.method, "POST");
          refreshes++;
          templates = [{ templateId: 1, title: "새 템플릿 제목", content: "본문", shortcut: "/새" }];
          for (const listener of storageListeners) listener({}, "local");
          return { statusCode: 200, data: { refreshed: true } };
        }
        if (request.path === "/auth/logout") {
          assert.equal(request.method, "POST");
          loggedOut = true;
          return { statusCode: 200, data: { authenticated: false } };
        }
        assert.equal(request.path, "/auth/status");
        if (loggedOut) return { statusCode: 200, data: { authenticated: false } };
        if (authenticated) return { statusCode: 200, data: { authenticated: true } };
        if (++checks === 1) return { statusCode: 200, data: { authenticated: false } };
        return new Promise((resolve) => { resolveRecheck = resolve; });
      },
    },
    tabs: { query: async () => [] },
    storage: { onChanged: {
      addListener: (listener) => storageListeners.add(listener),
      removeListener: (listener) => storageListeners.delete(listener),
    } },
  };

  const root = createRoot(document.getElementById("root"));
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
  });
  await act(async () => root.render(createElement(App)));
  assert.ok(document.querySelector(".login-page"));
  assert.equal(checks, 2);
  assert.equal(refreshes, 0);

  authenticated = true;
  await act(async () => resolveRecheck({ statusCode: 200, data: { authenticated: true } }));
  assert.equal(document.querySelector(".templates h1")?.textContent, "내 템플릿");
  assert.equal(document.querySelector(".login-page"), null);
  assert.equal(checks, 2);
  assert.equal(refreshes, 1);
  assert.equal(document.querySelector(".template-card h2")?.textContent, "새 템플릿 제목");
  assert.equal(document.querySelector(".template-card .template-command")?.textContent, "\\새");
  assert.equal(document.querySelector(".template-card .template-command")?.title, "\\새");
  await act(async () => window.dispatchEvent(new window.Event("focus")));
  assert.equal(refreshes, 1);

  await act(async () => document.querySelector('[aria-label="프로필 메뉴"]').click());
  assert.equal(document.querySelector(".profile-menu-panel a")?.textContent, "대시보드 열기");
  assert.equal(document.querySelector(".profile-menu-panel a")?.target, "_blank");
  await act(async () => document.querySelector(".profile-menu-panel button").click());
  assert.equal(loggedOut, true);
  assert.ok(document.querySelector(".login-page"));

  await act(async () => document.querySelector(".login-continue").click());
  await act(async () => document.querySelector('[aria-label="프로필 메뉴"]').click());
  assert.ok(document.querySelector(".profile-menu-panel a"));
  assert.equal(document.querySelector(".profile-menu-panel button"), null);
  assert.equal(refreshes, 1);
});
