import { test } from "node:test";
import assert from "node:assert/strict";
import { moduleUrl } from "./module-url.mjs";

const { getContentVendor } = await import(moduleUrl("../src/background/common/message-sender.ts"));
const { router: templateRouter } = await import(moduleUrl("../src/background/template/router.ts"));
const { vendors } = await import(moduleUrl("../src/config/vendors.ts"));

function mockChrome(t) {
  const previous = globalThis.chrome;
  globalThis.chrome = {
    runtime: { id: "extension", getURL: (path) => "chrome-extension://extension/" + path },
    storage: { local: { get: async () => ({ "snip.templates": [] }) } },
  };
  t.after(() => { globalThis.chrome = previous; });
}

const request = { src: "CONTENT", dst: "BACKGROUND", method: "GET", path: "/template/list", data: {} };

for (const vendor of vendors) {
  test(vendor.id + ": HTTPS 메일과 검증된 blank/srcdoc 하위 프레임만 허용", async (t) => {
    mockChrome(t);
    const base = { id: "extension", tab: { id: 3 }, origin: `https://${vendor.hostname}` };
    for (const frameId of [0, 7, undefined]) {
      const sender = { ...base, frameId, url: `https://${vendor.hostname}/` };
      assert.equal(getContentVendor(sender), vendor.id);
      assert.equal((await templateRouter(request, sender)).statusCode, 200);
      for (const url of ["about:blank", "about:blank#editor", "about:srcdoc"]) {
        const inheritedSender = { ...sender, url };
        assert.equal(getContentVendor(inheritedSender), frameId === 7 ? vendor.id : null);
        const response = await templateRouter(request, inheritedSender);
        assert.equal(response?.statusCode, frameId === 7 ? 200 : undefined);
      }
      for (const url of [
        `blob:https://${vendor.hostname}/document`, `filesystem:https://${vendor.hostname}/temporary/editor`,
        "data:text/html,editor",
      ]) {
        assert.equal(getContentVendor({ ...sender, url }), null);
        assert.equal(await templateRouter(request, { ...sender, url }), undefined);
      }
    }
  });
}

test("허용된 HTTPS URL도 잘못된 출처·탭·프레임이면 거부", async (t) => {
  mockChrome(t);
  const vendor = vendors[0];
  const base = { id: "extension", tab: { id: 3 }, frameId: 7, url: `https://${vendor.hostname}/`, origin: `https://${vendor.hostname}` };
  for (const change of [
    { id: "another-extension" }, { tab: undefined }, { tab: { id: -1 } },
    { frameId: -1 }, { frameId: 1.5 }, { origin: "null" }, { origin: "https://example.com" },
    { url: "https://example.com" }, { url: `http://${vendor.hostname}` },
    { url: undefined }, { url: "malformed URL" },
  ]) {
    const sender = { ...base, ...change };
    assert.equal(getContentVendor(sender), null);
    assert.equal(await templateRouter(request, sender), undefined);
  }
  assert.equal(getContentVendor({ ...base, origin: undefined }), vendor.id);
});

test("blank/srcdoc 프레임의 불투명·외부·누락 origin은 거부", async (t) => {
  mockChrome(t);
  for (const url of ["about:blank", "about:srcdoc"]) {
    for (const origin of [undefined, "null", "https://example.com", "http://mail.naver.com", "malformed"]) {
      const sender = { id: "extension", tab: { id: 3, url: "https://mail.naver.com/" }, frameId: 7, url, origin };
      assert.equal(getContentVendor(sender), null);
      assert.equal(await templateRouter(request, sender), undefined);
    }
  }
});
