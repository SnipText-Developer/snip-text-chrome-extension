import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { moduleUrl } from "./module-url.mjs";

const { default: App } = await import(moduleUrl("../packages/sidebar/src/App.tsx"));

test("the rendered login page rechecks background auth and opens templates", async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  let checks = 0;
  let resolveRecheck;
  const event = { addListener() {}, removeListener() {} };
  globalThis.chrome = {
    runtime: {
      onMessage: event,
      async sendMessage(request) {
        if (request.path === "/template/list") {
          return { statusCode: 200, data: { templates: [] } };
        }
        assert.equal(request.path, "/auth/status");
        if (++checks === 1) return { statusCode: 200, data: { authenticated: false } };
        return new Promise((resolve) => { resolveRecheck = resolve; });
      },
    },
    tabs: { query: async () => [] },
    storage: { onChanged: event },
  };

  const root = createRoot(document.getElementById("root"));
  t.after(async () => {
    await act(async () => root.unmount());
    dom.window.close();
  });
  await act(async () => root.render(createElement(App)));
  assert.ok(document.querySelector(".login-page"));
  assert.equal(checks, 2);

  await act(async () => resolveRecheck({ statusCode: 200, data: { authenticated: true } }));
  assert.equal(document.querySelector(".templates h1")?.textContent, "내 템플릿");
  assert.equal(document.querySelector(".login-page"), null);
  assert.equal(checks, 2);
});
