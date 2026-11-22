import { test } from "node:test";
import assert from "node:assert/strict";
import { moduleUrl } from "./module-url.mjs";

globalThis.__AUTH_TOKEN_ENCRYPTION_KEY_HEX__ = "11".repeat(32);
const { encryptAuthToken, decryptAuthToken } = await import(moduleUrl("../src/background/auth/token-crypto.ts"));
const { service } = await import(moduleUrl("../src/background/auth/service.ts"));
const { router } = await import(moduleUrl("../src/background/auth/router.ts"));
const { routeDashboardMessage } = await import(moduleUrl("../src/background/dashboard/router.ts"));
globalThis.chrome = { runtime: { id: "extension", getURL: (path) => "chrome-extension://extension/" + path } };
const sender = { id: "extension", url: chrome.runtime.getURL("src/page/index.html") };
const request = (method, data, source = sender) => router({ src: "PAGE", dst: "BACKGROUND", method, path: "/auth/token", data }, source);

test("auth token CRUD isolates vendors, validates input and ignores untrusted senders", async (t) => {
  t.after(() => { service.deleteOne("GOOGLE"); service.deleteOne("NAVER"); });
  assert.equal(await request("PUT", { vendor: "GOOGLE", token: "secret" }, { ...sender, tab: { id: 1 } }), undefined);
  assert.equal((await request("GET", { vendor: "GOOGLE" })).statusCode, 404);
  assert.equal((await request("PUT", { vendor: "GOOGLE", token: "google-token" })).statusCode, 200);
  assert.equal((await request("PUT", { vendor: "NAVER", token: "naver-token" })).statusCode, 200);
  assert.equal(await request("POST", { vendor: "GOOGLE", token: "ignored" }), undefined);
  assert.deepEqual((await request("GET", { vendor: "GOOGLE" })).data, { vendor: "GOOGLE", token: "google-token" });
  assert.equal((await request("PUT", { vendor: "GOOGLE", token: "updated" })).statusCode, 200);
  assert.equal(service.read("GOOGLE").token, "updated");
  assert.equal(service.read("NAVER").token, "naver-token");
  for (const value of [null, {}, { vendor: "other", token: "x" }, { vendor: "GOOGLE", token: " " }, { vendor: "GOOGLE", token: 2 }, { vendor: "GOOGLE", token: "x", expiresAt: 0 }]) {
    assert.equal((await request("PUT", value)).statusCode, 400);
  }
  assert.equal(service.read("GOOGLE").token, "updated");
  assert.equal((await request("DELETE", { vendor: "GOOGLE" })).data.deleted, true);
  assert.equal((await request("GET", { vendor: "GOOGLE" })).statusCode, 404);
  assert.deepEqual(await request("PUT", { vendor: "GOOGLE", token: "recreated" }), { statusCode: 200, data: { vendor: "GOOGLE", token: "recreated" } });
  assert.equal(service.read("GOOGLE").token, "recreated");
  assert.equal((await request("DELETE", { vendor: "GOOGLE" })).data.deleted, true);
  assert.equal((await request("DELETE", { vendor: "GOOGLE" })).data.deleted, false);
});

test("AES-GCM encryption rejects altered ciphertext and vendor", () => {
  const context = { vendor: "GOOGLE", expiresAt: Date.now() + 60_000 };
  const encrypted = encryptAuthToken("secret", context);
  assert.equal(decryptAuthToken(encrypted, context), "secret");
  assert.notEqual(encryptAuthToken("secret", context), encrypted);
  assert.throws(() => decryptAuthToken(encrypted, { ...context, vendor: "NAVER" }));
  const payload = JSON.parse(encrypted);
  payload.ciphertext = (payload.ciphertext[0] === "0" ? "1" : "0") + payload.ciphertext.slice(1);
  assert.throws(() => decryptAuthToken(JSON.stringify(payload), context));
});

test("tokens expire within five minutes and corrupted credentials are discarded", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100_000 });
  t.after(() => { service.deleteOne("GOOGLE"); service.deleteOne("NAVER"); t.mock.timers.reset(); });
  service.update({ vendor: "GOOGLE", token: "short", expiresAt: 100_100 });
  service.update({ vendor: "NAVER", token: "long", expiresAt: 999_999 });
  t.mock.timers.tick(100);
  assert.equal(service.read("GOOGLE"), null);
  service.update({ vendor: "GOOGLE", token: "renewed" });
  assert.equal(service.read("GOOGLE").token, "renewed");
  t.mock.timers.tick(299_900);
  assert.equal(service.read("NAVER"), null);
  service.update({ vendor: "GOOGLE", token: "token" });
  globalThis.__AUTH_TOKEN_ENCRYPTION_KEY_HEX__ = "22".repeat(32);
  try { assert.equal(service.read("GOOGLE"), null); }
  finally { globalThis.__AUTH_TOKEN_ENCRYPTION_KEY_HEX__ = "11".repeat(32); }
  assert.equal(service.read("GOOGLE"), null);
});

test("auth status reports valid tokens without exposing their contents", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100_000 });
  t.after(() => { service.deleteOne("GOOGLE"); service.deleteOne("NAVER"); t.mock.timers.reset(); });
  const status = (source = sender) =>
    router({ src: "PAGE", dst: "BACKGROUND", method: "GET", path: "/auth/status", data: {} }, source);
  assert.equal(await status({ ...sender, tab: { id: 1 } }), undefined);
  assert.deepEqual(await status(), { statusCode: 200, data: { authenticated: false } });
  for (const vendor of ["GOOGLE", "NAVER"]) {
    service.update({ vendor, token: "secret", expiresAt: Date.now() + 100 });
    assert.deepEqual(await status(), { statusCode: 200, data: { authenticated: true } });
    t.mock.timers.tick(100);
    assert.deepEqual(await status(), { statusCode: 200, data: { authenticated: false } });
  }
});

test("dashboard authentication accepts only the allowed top-level origins and does not return tokens", async (t) => {
  t.after(() => { service.deleteOne("GOOGLE"); });
  const send = (source, method, path, data) =>
    routeDashboardMessage({ dst: "BACKGROUND", method, path, data }, source);
  const production = { origin: "https://sniptext.kr", url: "https://sniptext.kr/templates", frameId: 0 };
  const local = { origin: "http://localhost:3000", url: "http://localhost:3000/", frameId: 0 };
  const token = { vendor: "GOOGLE", token: "dashboard-token" };
  for (const source of [
    { ...production, frameId: 1 },
    { ...production, id: "other-extension" },
    { ...production, url: "blob:https://sniptext.kr/document" },
    { ...production, url: "https://sniptext.kr.example/" },
    { origin: "http://localhost:3001", url: "http://localhost:3001/", frameId: 0 },
  ]) {
    assert.equal((await send(source, "PUT", "/auth/token", token)).statusCode, 403);
  }
  assert.deepEqual(await send(production, "PUT", "/auth/token", token), { statusCode: 200, data: { vendor: "GOOGLE" } });
  assert.deepEqual(await send(local, "GET", "/auth/status", {}), { statusCode: 200, data: { authenticated: true } });
  assert.equal((await send(local, "GET", "/auth/token", token)).statusCode, 404);
  assert.equal((await send(production, "GET", "/template/list", {})).statusCode, 404);
  assert.deepEqual(await send(local, "DELETE", "/auth/token", { vendor: "GOOGLE" }), { statusCode: 200, data: { deleted: true } });
});

test("dashboard token changes notify open sidebars without including token data", async (t) => {
  const notifications = [];
  const originalSend = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = async (message) => { notifications.push(message); };
  t.after(() => {
    chrome.runtime.sendMessage = originalSend;
    service.deleteOne("GOOGLE");
  });
  const dashboard = { origin: "https://sniptext.kr", url: "https://sniptext.kr/", frameId: 0 };
  const update = { dst: "BACKGROUND", method: "PUT", path: "/auth/token", data: { vendor: "GOOGLE", token: "access-token" } };
  const status = { src: "PAGE", method: "GET", path: "/auth/status" };
  const notification = { src: "BACKGROUND", dst: "PAGE", method: "NOTIFY", path: "/auth/status", data: {} };

  assert.equal((await routeDashboardMessage(update, dashboard)).statusCode, 200);
  assert.deepEqual(notifications, [notification]);
  assert.deepEqual((await router(status, sender)).data, { authenticated: true });

  assert.equal((await routeDashboardMessage({ ...update, method: "DELETE", data: { vendor: "GOOGLE" } }, dashboard)).statusCode, 200);
  assert.deepEqual(notifications, [notification, notification]);
  assert.deepEqual((await router(status, sender)).data, { authenticated: false });
});

test("sidebar logout clears all vendors and notifies other sidebars once", async (t) => {
  const notifications = [];
  chrome.runtime.sendMessage = async (message) => { notifications.push(message); };
  t.after(() => {
    delete chrome.runtime.sendMessage;
    service.deleteOne("GOOGLE");
    service.deleteOne("NAVER");
  });
  const logout = { src: "PAGE", dst: "BACKGROUND", method: "POST", path: "/auth/logout", data: {} };
  for (const vendor of ["GOOGLE", "NAVER"]) {
    service.update({ vendor, token: "test-token" });
  }
  notifications.length = 0;

  assert.equal(await router(logout, { ...sender, tab: { id: 1 } }), undefined);
  assert.ok(service.readLatest());
  assert.deepEqual(await router(logout, sender), { statusCode: 200, data: { authenticated: false } });
  assert.equal(service.read("GOOGLE"), null);
  assert.equal(service.read("NAVER"), null);
  assert.equal((await router(logout, sender)).statusCode, 200);
  assert.deepEqual(notifications, [
    { src: "BACKGROUND", dst: "PAGE", method: "NOTIFY", path: "/auth/status", data: {} },
  ]);
});
