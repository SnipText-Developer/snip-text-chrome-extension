import { test } from "node:test";
import assert from "node:assert/strict";
import { moduleUrl } from "./module-url.mjs";

globalThis.__AUTH_TOKEN_ENCRYPTION_KEY_HEX__ = "11".repeat(32);
const { encryptAuthToken, decryptAuthToken } = await import(moduleUrl("../src/background/auth/token-crypto.ts"));
const { service } = await import(moduleUrl("../src/background/auth/service.ts"));
const { router } = await import(moduleUrl("../src/background/auth/router.ts"));
globalThis.chrome = { runtime: { id: "extension", getURL: (path) => "chrome-extension://extension/" + path } };
const sender = { id: "extension", url: chrome.runtime.getURL("src/page/index.html") };
const request = (method, data, source = sender) => router({ src: "PAGE", dst: "BACKGROUND", method, path: "/auth/token", data }, source);

test("auth token CRUD isolates vendors, validates input and ignores untrusted senders", async (t) => {
  t.after(() => { service.deleteOne("GOOGLE"); service.deleteOne("NAVER"); });
  assert.equal(await request("POST", { vendor: "GOOGLE", token: "secret" }, { ...sender, tab: { id: 1 } }), undefined);
  assert.equal((await request("GET", { vendor: "GOOGLE" })).statusCode, 404);
  assert.equal((await request("POST", { vendor: "GOOGLE", token: "google-token" })).statusCode, 200);
  assert.equal((await request("POST", { vendor: "NAVER", token: "naver-token" })).statusCode, 200);
  assert.equal((await request("POST", { vendor: "GOOGLE", token: "duplicate" })).statusCode, 400);
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
  assert.equal((await request("PUT", { vendor: "GOOGLE", token: "missing" })).statusCode, 404);
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
  service.create({ vendor: "GOOGLE", token: "short", expiresAt: 100_100 });
  service.create({ vendor: "NAVER", token: "long", expiresAt: 999_999 });
  t.mock.timers.tick(100);
  assert.equal(service.read("GOOGLE"), null);
  t.mock.timers.tick(299_900);
  assert.equal(service.read("NAVER"), null);
  service.create({ vendor: "GOOGLE", token: "token" });
  globalThis.__AUTH_TOKEN_ENCRYPTION_KEY_HEX__ = "22".repeat(32);
  try { assert.equal(service.read("GOOGLE"), null); }
  finally { globalThis.__AUTH_TOKEN_ENCRYPTION_KEY_HEX__ = "11".repeat(32); }
  assert.equal(service.read("GOOGLE"), null);
});
