import { test } from "node:test";
import assert from "node:assert/strict";
import { mockSessionStorage } from "./mock-session-storage.mjs";
import { moduleUrl } from "./module-url.mjs";

globalThis.__STORAGE_ENCRYPTION_KEY_HEX__ = "11".repeat(32);
const { encrypt, decrypt } = await import(moduleUrl("../src/background/common/crypto.ts"));
const { service } = await import(moduleUrl("../src/background/auth/service.ts"));
const { router } = await import(moduleUrl("../src/background/auth/router.ts"));
const { routeDashboardMessage } = await import(moduleUrl("../src/background/dashboard/router.ts"));
globalThis.chrome = { storage: { session: mockSessionStorage() }, runtime: { id: "extension", getURL: (path) => "chrome-extension://extension/" + path } };
const sender = { id: "extension", url: chrome.runtime.getURL("src/page/index.html") };
const request = (method, data, source = sender) => router({ src: "PAGE", dst: "BACKGROUND", method, path: "/auth/token", data }, source);

test("auth token CRUD isolates vendors, validates input and ignores untrusted senders", async (t) => {
  t.after(async () => { await service.deleteOne("GOOGLE"); await service.deleteOne("NAVER"); });
  assert.equal(await request("PUT", { vendor: "GOOGLE", token: "secret" }, { ...sender, tab: { id: 1 } }), undefined);
  assert.equal((await request("GET", { vendor: "GOOGLE" })).statusCode, 404);
  assert.equal((await request("PUT", { vendor: "GOOGLE", token: "google-token" })).statusCode, 200);
  assert.equal((await request("PUT", { vendor: "NAVER", token: "naver-token" })).statusCode, 200);
  assert.equal(await request("POST", { vendor: "GOOGLE", token: "ignored" }), undefined);
  assert.deepEqual((await request("GET", { vendor: "GOOGLE" })).data, { vendor: "GOOGLE", token: "google-token" });
  assert.equal((await request("PUT", { vendor: "GOOGLE", token: "updated" })).statusCode, 200);
  assert.equal((await service.read("GOOGLE")).token, "updated");
  assert.equal((await service.read("NAVER")).token, "naver-token");
  for (const value of [null, {}, { vendor: "other", token: "x" }, { vendor: "GOOGLE", token: " " }, { vendor: "GOOGLE", token: 2 }, { vendor: "GOOGLE", token: "x", expiresAt: 0 }]) {
    assert.equal((await request("PUT", value)).statusCode, 400);
  }
  assert.equal((await service.read("GOOGLE")).token, "updated");
  assert.equal((await request("DELETE", { vendor: "GOOGLE" })).data.deleted, true);
  assert.equal((await request("GET", { vendor: "GOOGLE" })).statusCode, 404);
  assert.deepEqual(await request("PUT", { vendor: "GOOGLE", token: "recreated" }), { statusCode: 200, data: { vendor: "GOOGLE", token: "recreated" } });
  assert.equal((await service.read("GOOGLE")).token, "recreated");
  assert.equal((await request("DELETE", { vendor: "GOOGLE" })).data.deleted, true);
  assert.equal((await request("DELETE", { vendor: "GOOGLE" })).data.deleted, false);
});

test("encrypted session tokens can be read by a fresh repository", async (t) => {
  const key = "snip.auth.tokens";
  const { repository: restarted } = await import(moduleUrl("../src/background/auth/repository.ts", {
    "timer": "restartedTimer",
  }));
  t.after(async () => {
    await restarted.deleteAll();
    await service.readLatest();
  });

  await Promise.all([
    service.update({ vendor: "GOOGLE", token: "first-token" }),
    service.update({ vendor: "NAVER", token: "second-token" }),
  ]);
  const { [key]: encrypted } = await chrome.storage.session.get(key);
  assert.match(encrypted, /^snip:encrypted-v2:/);
  assert.ok(!encrypted.includes("first-token") && !encrypted.includes("second-token"));
  assert.deepEqual(await restarted.read("GOOGLE"), { vendor: "GOOGLE", token: "first-token" });
  assert.deepEqual(await restarted.readLatest(), { vendor: "NAVER", token: "second-token" });
  await restarted.deleteAll();
  assert.equal((await chrome.storage.session.get(key))[key], undefined);
});

test("AES-GCM encryption rejects altered ciphertext and vendor", () => {
  const expiresAt = Date.now() + 60_000;
  const context = JSON.stringify(["auth", "GOOGLE", expiresAt]);
  const encrypted = encrypt("secret", context);
  assert.equal(decrypt(encrypted, context), "secret");
  assert.notEqual(encrypt("secret", context), encrypted);
  assert.throws(() => decrypt(encrypted, JSON.stringify(["auth", "NAVER", expiresAt])));
  const payload = JSON.parse(encrypted);
  payload.ciphertext = (payload.ciphertext[0] === "0" ? "1" : "0") + payload.ciphertext.slice(1);
  assert.throws(() => decrypt(JSON.stringify(payload), context));
});

test("tokens honor the five-minute minimum and corrupted credentials are discarded", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100_000 });
  t.after(async () => { await service.deleteOne("GOOGLE"); await service.deleteOne("NAVER"); t.mock.timers.reset(); });
  await service.update({ vendor: "GOOGLE", token: "short", expiresAt: 100_100 });
  await service.update({ vendor: "NAVER", token: "long", expiresAt: 999_999 });
  t.mock.timers.tick(100);
  assert.equal((await service.read("GOOGLE")).token, "short");
  t.mock.timers.tick(299_900);
  assert.equal(await service.read("GOOGLE"), null);
  await service.update({ vendor: "GOOGLE", token: "renewed" });
  assert.equal((await service.read("GOOGLE")).token, "renewed");
  t.mock.timers.tick(599_999);
  assert.equal(await service.read("NAVER"), null);
  await service.update({ vendor: "GOOGLE", token: "token" });
  globalThis.__STORAGE_ENCRYPTION_KEY_HEX__ = "22".repeat(32);
  try { assert.equal(await service.read("GOOGLE"), null); }
  finally { globalThis.__STORAGE_ENCRYPTION_KEY_HEX__ = "11".repeat(32); }
  assert.equal(await service.read("GOOGLE"), null);
});

test("auth status reports valid tokens without exposing their contents", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100_000 });
  t.after(async () => { await service.deleteOne("GOOGLE"); await service.deleteOne("NAVER"); t.mock.timers.reset(); });
  const status = (source = sender) =>
    router({ src: "PAGE", dst: "BACKGROUND", method: "GET", path: "/auth/status", data: {} }, source);
  assert.equal(await status({ ...sender, tab: { id: 1 } }), undefined);
  assert.deepEqual(await status(), { statusCode: 200, data: { authenticated: false } });
  for (const vendor of ["GOOGLE", "NAVER"]) {
    await service.update({ vendor, token: "secret", expiresAt: Date.now() + 100 });
    assert.deepEqual(await status(), { statusCode: 200, data: { authenticated: true } });
    t.mock.timers.tick(300_000);
    assert.deepEqual(await status(), { statusCode: 200, data: { authenticated: false } });
  }
});

test("dashboard authentication returns the Google token only to the top-level dashboard", async (t) => {
  t.after(async () => { await service.deleteOne("GOOGLE"); });
  const send = (source, method, path, data) =>
    routeDashboardMessage({ dst: "BACKGROUND", method, path, data }, source);
  const production = { origin: "https://sniptext.kr", url: "https://sniptext.kr/templates", frameId: 0 };
  const token = { vendor: "GOOGLE", token: "dashboard-token" };
  for (const source of [
    { ...production, frameId: 1 },
    { ...production, id: "other-extension" },
    { ...production, url: "blob:https://sniptext.kr/document" },
    { ...production, url: "https://sniptext.kr.example/" },
    { origin: "http://localhost:3000", url: "http://localhost:3000/", frameId: 0 },
  ]) {
    assert.equal((await send(source, "PUT", "/auth/token", token)).statusCode, 403);
  }
  assert.deepEqual(await send(production, "PUT", "/auth/token", token), { statusCode: 200, data: { vendor: "GOOGLE" } });
  assert.deepEqual(await send(production, "GET", "/auth/status", {}), { statusCode: 200, data: { authenticated: true } });
  const dashboard = { ...production, url: "https://sniptext.kr/dashboard/templates" };
  assert.deepEqual(await send(dashboard, "GET", "/auth/token", { vendor: "GOOGLE" }), { statusCode: 200, data: token });
  assert.equal((await send(dashboard, "GET", "/auth/token", { vendor: "NAVER" })).statusCode, 404);
  assert.equal((await send({ ...dashboard, frameId: 1 }, "GET", "/auth/token", token)).statusCode, 403);
  assert.equal((await send(production, "GET", "/auth/token", token)).statusCode, 404);
  assert.equal((await send(production, "GET", "/template/list", {})).statusCode, 404);
  assert.deepEqual(await send(production, "DELETE", "/auth/token", { vendor: "GOOGLE" }), { statusCode: 200, data: { deleted: true } });
});

test("dashboard token changes notify open sidebars without including token data", async (t) => {
  const notifications = [];
  const originalSend = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = async (message) => { notifications.push(message); };
  t.after(async () => {
    chrome.runtime.sendMessage = originalSend;
    await service.deleteOne("GOOGLE");
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
  t.after(async () => {
    delete chrome.runtime.sendMessage;
    await service.deleteOne("GOOGLE");
    await service.deleteOne("NAVER");
  });
  const logout = { src: "PAGE", dst: "BACKGROUND", method: "POST", path: "/auth/logout", data: {} };
  for (const vendor of ["GOOGLE", "NAVER"]) {
    await service.update({ vendor, token: "test-token" });
  }
  notifications.length = 0;

  assert.equal(await router(logout, { ...sender, tab: { id: 1 } }), undefined);
  assert.ok(await service.readLatest());
  assert.deepEqual(await router(logout, sender), { statusCode: 200, data: { authenticated: false } });
  assert.equal(await service.read("GOOGLE"), null);
  assert.equal(await service.read("NAVER"), null);
  assert.equal((await router(logout, sender)).statusCode, 200);
  assert.deepEqual(notifications, [
    { src: "BACKGROUND", dst: "PAGE", method: "NOTIFY", path: "/auth/status", data: {} },
  ]);
});
