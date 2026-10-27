import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function moduleUrl(path, replacements = {}) {
  let source = readFileSync(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) source = source.replace(from, to);
  return "data:text/javascript;base64," + Buffer.from(
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText,
  ).toString("base64");
}
const configUrl = moduleUrl("../src/background/auth/config.ts", {
  "encryptionKeyHex: __AUTH_TOKEN_ENCRYPTION_KEY_HEX__": 'encryptionKeyHex: "' + "11".repeat(32) + '"',
});
const { tokenEncryptionConfig } = await import(configUrl);
tokenEncryptionConfig.encryptionKeyHex = "11".repeat(32);
const cryptoUrl = moduleUrl("../src/background/auth/token-crypto.ts", {
  '"./config"': JSON.stringify(configUrl),
  '"@noble/ciphers/aes.js"': JSON.stringify(import.meta.resolve("@noble/ciphers/aes.js")),
  '"@noble/ciphers/utils.js"': JSON.stringify(import.meta.resolve("@noble/ciphers/utils.js")),
});
const { encryptAuthToken, decryptAuthToken } = await import(cryptoUrl);
const repositoryUrl = moduleUrl("../src/background/auth/repository.ts", { '"./token-crypto"': JSON.stringify(cryptoUrl) });
const errorsUrl = moduleUrl("../src/background/auth/errors.ts");
const serviceUrl = moduleUrl("../src/background/auth/service.ts", {
  '"./repository"': JSON.stringify(repositoryUrl), '"./errors"': JSON.stringify(errorsUrl),
});
const senderUrl = moduleUrl("../src/background/common/message-sender.ts");
const { service } = await import(serviceUrl);
const { router } = await import(moduleUrl("../src/background/auth/router.ts", {
  '"./service"': JSON.stringify(serviceUrl), '"./errors"': JSON.stringify(errorsUrl),
  '"../common/message-sender"': JSON.stringify(senderUrl),
}));
globalThis.chrome = { runtime: { id: "extension", getURL: (path) => "chrome-extension://extension/" + path } };
const sender = { id: "extension", url: chrome.runtime.getURL("src/page/index.html") };
const request = (method, data, source = sender) => router({ src: "PAGE", dst: "BACKGROUND", method, path: "/auth/token", data }, source);

test("auth token CRUD isolates vendors, validates input and ignores untrusted senders", async (t) => {
  t.after(() => { service.deleteOne("google"); service.deleteOne("naver"); });
  assert.equal(await request("POST", { vendor: "google", token: "secret" }, { ...sender, tab: { id: 1 } }), undefined);
  assert.equal((await request("GET", { vendor: "google" })).statusCode, 404);
  assert.equal((await request("POST", { vendor: "google", token: "google-token" })).statusCode, 200);
  assert.equal((await request("POST", { vendor: "naver", token: "naver-token" })).statusCode, 200);
  assert.equal((await request("POST", { vendor: "google", token: "duplicate" })).statusCode, 400);
  assert.deepEqual((await request("GET", { vendor: "google" })).data, { vendor: "google", token: "google-token" });
  assert.equal((await request("PUT", { vendor: "google", token: "updated" })).statusCode, 200);
  assert.equal(service.read("google").token, "updated");
  assert.equal(service.read("naver").token, "naver-token");
  for (const value of [null, {}, { vendor: "other", token: "x" }, { vendor: "google", token: " " }, { vendor: "google", token: 2 }, { vendor: "google", token: "x", expiresAt: 0 }]) {
    assert.equal((await request("PUT", value)).statusCode, 400);
  }
  assert.equal(service.read("google").token, "updated");
  assert.equal((await request("DELETE", { vendor: "google" })).data.deleted, true);
  assert.equal((await request("GET", { vendor: "google" })).statusCode, 404);
  assert.equal((await request("PUT", { vendor: "google", token: "missing" })).statusCode, 404);
  assert.equal((await request("DELETE", { vendor: "google" })).data.deleted, false);
});

test("AES-GCM encryption rejects altered ciphertext and vendor", () => {
  const context = { vendor: "google", expiresAt: Date.now() + 60_000 };
  const encrypted = encryptAuthToken("secret", context);
  assert.equal(decryptAuthToken(encrypted, context), "secret");
  assert.notEqual(encryptAuthToken("secret", context), encrypted);
  assert.throws(() => decryptAuthToken(encrypted, { ...context, vendor: "naver" }));
  const payload = JSON.parse(encrypted);
  payload.ciphertext = (payload.ciphertext[0] === "0" ? "1" : "0") + payload.ciphertext.slice(1);
  assert.throws(() => decryptAuthToken(JSON.stringify(payload), context));
});

test("tokens expire within five minutes and corrupted credentials are discarded", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100_000 });
  t.after(() => { service.deleteOne("google"); service.deleteOne("naver"); t.mock.timers.reset(); });
  service.create({ vendor: "google", token: "short", expiresAt: 100_100 });
  service.create({ vendor: "naver", token: "long", expiresAt: 999_999 });
  t.mock.timers.tick(100);
  assert.equal(service.read("google"), null);
  t.mock.timers.tick(299_900);
  assert.equal(service.read("naver"), null);
  service.create({ vendor: "google", token: "token" });
  tokenEncryptionConfig.encryptionKeyHex = "22".repeat(32);
  try { assert.equal(service.read("google"), null); }
  finally { tokenEncryptionConfig.encryptionKeyHex = "11".repeat(32); }
  assert.equal(service.read("google"), null);
});
