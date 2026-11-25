import { test } from "node:test";
import assert from "node:assert/strict";
import { mockSessionStorage } from "./mock-session-storage.mjs";
import { moduleUrl } from "./module-url.mjs";

globalThis.__STORAGE_ENCRYPTION_KEY_HEX__ = "11".repeat(32);

const { apiConfig } = await import(moduleUrl("../src/config/api.ts"));
apiConfig.templatesUrl = "";

const senderUrl = moduleUrl("../src/background/common/message-sender.ts");
const repositoryUrl = moduleUrl("../src/background/template/repository.ts");
const serviceUrl = moduleUrl("../src/background/template/service.ts", { '"./repository"': JSON.stringify(repositoryUrl) });
const routerUrl = moduleUrl("../src/background/template/router.ts", { '"./service"': JSON.stringify(serviceUrl), '"../common/message-sender"': JSON.stringify(senderUrl) });
const { router } = await import(routerUrl);
const { routeDashboardMessage } = await import(moduleUrl("../src/background/dashboard/router.ts", {
  '"../template/router"': JSON.stringify(routerUrl),
}));
const { repository } = await import(repositoryUrl);
const { service } = await import(serviceUrl);
let stored = {};
let failWrite = false;
const sender = { id: "extension-id", url: "chrome-extension://extension-id/src/page/index.html" };
globalThis.chrome = { runtime: { id: "extension-id", getURL: (path) => "chrome-extension://extension-id/" + path }, storage: { session: mockSessionStorage(), local: {
  get: async () => structuredClone(stored),
  set: async (data) => {
    if (failWrite) throw new Error("write failed");
    stored = structuredClone(data);
  },
} } };
const replace = (data, src = "PAGE") => router({ src, dst: "BACKGROUND", method: "PUT", path: "/template/replace", data }, sender);
const dates = { lastUsedAt: "2026-10-07T09:12:00+09:00", createdAt: "2026-09-20T14:03:00+09:00", editedAt: "2026-10-01T11:40:00+09:00" };
const template = (templateId, changes = {}) => ({ templateId, title: "이름", shortcut: "/" + templateId, content: "본문", variables: [], ...dates, ...changes });

test("template storage saves authenticated ciphertext and rejects tampering", async () => {
  try {
    await repository.replaceAll([template(1)]);
    const ciphertext = stored["snip.templates"];
    assert.equal(typeof ciphertext, "string");
    assert.ok(!ciphertext.includes("본문"));
    assert.deepEqual(await repository.readAll(), [template(1)]);

    const tampered = ciphertext.replace(/("ciphertext":")([0-9a-f])/, (_, prefix, first) =>
      prefix + (first === "0" ? "1" : "0"),
    );
    assert.notEqual(tampered, ciphertext);
    stored["snip.templates"] = tampered;
    await assert.rejects(repository.readAll());
  } finally {
    stored = {};
  }
});

test("full template replacement validates, persists and preserves concurrent writes", async () => {
  const listRequest = { src: "CONTENT", dst: "BACKGROUND", method: "GET", path: "/template/list", data: {} };
  const contentSender = { id: "extension-id", tab: { id: 1 }, url: "https://mail.google.com/mail/u/0/" };
  assert.equal((await router(listRequest, contentSender)).statusCode, 200);
  assert.equal(await router({ ...listRequest, src: "PAGE" }, contentSender), undefined);
  assert.equal(await router(listRequest, { ...contentSender, url: "https://evil.example/" }), undefined);
  assert.equal(await router(listRequest, { ...contentSender, id: "another-extension" }), undefined);
  await repository.replaceAll([template(1), template(2)]);
  const first = template(1, { title: "새 이름", shortcut: "/new", content: "새 본문" });
  assert.equal((await replace(first)).statusCode, 200);
  assert.deepEqual((await service.listTemplates())[0], first);
  const copy = await repository.readAll();
  copy[0].title = "mutated";
  assert.equal((await repository.readAll())[0].title, "새 이름");
  for (const field of ["templateId", "title", "shortcut", "content", "variables", "lastUsedAt", "createdAt", "editedAt"]) {
    const incomplete = { ...first };
    delete incomplete[field];
    assert.equal((await replace(incomplete)).statusCode, 400);
  }
  for (const data of [
    {}, template(1, { templateId: "1" }), template(1, { templateId: 1.5 }),
    template(1, { variables: ["missing"] }), template(1, { variables: [1] }),
    template(1, { createdAt: "invalid" }), template(1, { lastUsedAt: null }),
    template(1, { content: " " }), template(1, { title: 3 }),
    template(1, { shortcut: "/2" }), template(1, { shortcut: "/bad shortcut" }),
    template(1, { shortcut: "bad" }), { ...first, unknown: true },
  ]) assert.equal((await replace(data)).statusCode, 400);
  assert.deepEqual((await repository.readAll())[0], first);
  assert.equal((await replace(template(999))).statusCode, 404);
  assert.equal(await replace(first, "CONTENT"), undefined);
  assert.equal(await router({ src: "PAGE", dst: "BACKGROUND", method: "PATCH", path: "/template/update", data: first }), undefined);
  await Promise.all([replace(template(1)), replace(template(2))]);
  assert.deepEqual((await repository.readAll()).slice(0, 2), [template(1), template(2)]);
  const duplicate = await Promise.all([
    replace(template(1, { shortcut: "/same" })),
    replace(template(2, { shortcut: "/same" })),
  ]);
  assert.deepEqual(duplicate.map((result) => result.statusCode), [200, 400]);
  const withVariables = template(1, { content: "{{고객명}}님, {{금액}}원입니다. {{고객명}}님", variables: ["고객명", "금액"] });
  assert.equal((await replace(withVariables)).statusCode, 200);
  const variableCopy = await repository.readAll();
  variableCopy[0].variables.push("변경");
  assert.deepEqual((await repository.readAll())[0].variables, ["고객명", "금액"]);
  failWrite = true;
  assert.equal((await replace(first)).statusCode, 500);
  failWrite = false;
  assert.equal((await replace(first)).statusCode, 200);
  assert.deepEqual((await repository.readAll())[0], first);
});

test("startup sync validates API data and keeps cached templates on failure", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  await repository.replaceAll([template(1)]);
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.example.com/templates");
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ templates: [template(10)] }) };
  };
  await service.syncTemplates("");
  assert.equal(calls, 0);
  await service.syncTemplates("https://api.example.com/templates");
  assert.deepEqual(await repository.readAll(), [template(10)]);
  for (const data of [{}, { templates: [template(2), {}] }, { templates: [template(2), template(2)] }]) {
    globalThis.fetch = async () => ({ ok: true, json: async () => data });
    await assert.rejects(service.syncTemplates("https://api.example.com/templates"));
    assert.deepEqual(await repository.readAll(), [template(10)]);
  }
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(service.syncTemplates("https://api.example.com/templates"));
  assert.deepEqual(await repository.readAll(), [template(10)]);
  globalThis.fetch = async () => { throw new Error("network failure"); };
  await assert.rejects(service.syncTemplates("https://api.example.com/templates"));
  assert.deepEqual(await repository.readAll(), [template(10)]);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ templates: [] }) });
  await service.syncTemplates("https://api.example.com/templates");
  assert.deepEqual(await repository.readAll(), []);
});

test("Spring template DTO arrays are normalized without weakening edit validation", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => ({ ok: true, json: async () => [
    { templateId: "42", title: "서버 템플릿", shortcut: "/server", content: "{{이름}}님, {{이름}}님" },
  ] });
  await service.syncTemplates("http://localhost:8080/api/template");
  const [saved] = await repository.readAll();
  assert.equal(saved.templateId, 42);
  assert.deepEqual(saved.variables, ["이름"]);
  assert.equal(saved.createdAt, "1970-01-01T00:00:00.000Z");
  assert.equal((await replace({ ...saved, templateId: "42" })).statusCode, 400);
});

test("sync reports all invalid field paths and leaves storage unchanged", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  await repository.replaceAll([template(1)]);
  globalThis.fetch = async () => ({ ok: true, json: async () => [
    { templateId: "bad", title: 10, shortcut: "invalid", content: "{{이름}}", variables: [null], createdAt: null },
    null,
  ] });
  await assert.rejects(service.syncTemplates("https://api.example.com/templates"), (error) => {
    assert.equal(error.name, "TemplateApiValidationError");
    const paths = error.issues.map((issue) => issue.path);
    for (const path of ["templates[0].templateId", "templates[0].title", "templates[0].shortcut", "templates[0].variables[0]", "templates[0].createdAt", "templates[1]"]) {
      assert.ok(paths.includes(path), path);
    }
    assert.match(error.message, /받은 타입: number/);
    return true;
  });
  assert.deepEqual(await repository.readAll(), [template(1)]);
});

test("refresh requests fetch fresh templates and preserve the cache on failure", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; apiConfig.templatesUrl = ""; });
  const refresh = { src: "PAGE", dst: "BACKGROUND", method: "POST", path: "/template/refresh", data: {} };
  const dashboard = { origin: "https://sniptext.kr", url: "https://sniptext.kr/templates", frameId: 0 };
  assert.equal((await router(refresh, sender)).statusCode, 400);

  apiConfig.templatesUrl = "http://localhost:8080/api/template";
  await repository.replaceAll([template(1)]);
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, apiConfig.templatesUrl);
    assert.equal(options.cache, "no-store");
    calls++;
    return calls === 1
      ? Response.json([template(2)])
      : Response.json({}, { status: 503 });
  };

  assert.equal(await router(refresh, { ...sender, id: "other" }), undefined);
  assert.equal((await routeDashboardMessage(refresh, { ...dashboard, frameId: 1 })).statusCode, 403);
  assert.equal(calls, 0);
  assert.deepEqual(await router(refresh, sender), { statusCode: 200, data: { refreshed: true } });
  assert.equal((await routeDashboardMessage(refresh, dashboard)).statusCode, 500);
  assert.deepEqual(await repository.readAll(), [template(2)]);
  assert.equal(calls, 2);
});

test("production template refresh uses the stored Bearer token and parses the OpenAPI response", async (t) => {
  const { service: authService } = await import(moduleUrl("../src/background/auth/service.ts"));
  const originalFetch = globalThis.fetch;
  const originalUrl = apiConfig.templatesUrl;
  t.after(async () => {
    globalThis.fetch = originalFetch;
    apiConfig.templatesUrl = originalUrl;
    await authService.deleteOne("GOOGLE");
    await authService.deleteOne("NAVER");
  });

  apiConfig.templatesUrl = "https://api.sniptext.kr/api/v1/templates";
  const request = { src: "PAGE", method: "POST", path: "/template/refresh", data: {} };
  let requests = 0;
  globalThis.fetch = async (url, options) => {
    requests++;
    assert.equal(url, apiConfig.templatesUrl);
    assert.equal(new Headers(options.headers).get("Authorization"), "Bearer latest-access-token");
    assert.equal(options.redirect, "error");
    return Response.json({
      isSuccess: true,
      result: { totalCount: 1, templates: [template(3)] },
    });
  };

  assert.equal((await router(request, sender)).statusCode, 401);
  assert.equal(requests, 0);
  await authService.update({ vendor: "GOOGLE", token: "older-access-token" });
  await authService.update({ vendor: "NAVER", token: "latest-access-token" });
  await repository.replaceAll([template(1)]);
  const listRequest = { src: "PAGE", method: "GET", path: "/template/list", data: {} };
  const contentSender = { id: sender.id, tab: { id: 1 }, url: "https://mail.google.com/mail/u/0/" };
  for (const [src, caller] of [["PAGE", sender], ["CONTENT", contentSender]]) {
    assert.deepEqual(await router({ ...listRequest, src }, caller), {
      statusCode: 200, data: { templates: [template(1)] },
    });
  }
  assert.equal(requests, 0);
  assert.equal((await router(request, sender)).statusCode, 200);
  assert.equal(requests, 1);
  assert.deepEqual(await repository.readAll(), [template(3)]);

  globalThis.fetch = async () => Response.json({ isSuccess: false }, { status: 401 });
  assert.equal((await router(request, sender)).statusCode, 401);
  assert.deepEqual(await repository.readAll(), [template(3)]);

  globalThis.fetch = async (_url, options) => {
    assert.equal(new Headers(options.headers).has("Authorization"), false);
    return Response.json([template(3)]);
  };
  await service.syncTemplates("https://api.example.com/templates");

  const edit = template(3, { title: "수정 제목" });
  const updated = { ...edit, editedAt: "2026-10-08T09:12:00+09:00" };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, apiConfig.templatesUrl + "/3");
    assert.equal(options.method, "PUT");
    assert.equal(options.headers.get("Authorization"), "Bearer latest-access-token");
    assert.deepEqual(JSON.parse(options.body), { title: edit.title, shortcut: edit.shortcut, content: edit.content });
    return Response.json({ isSuccess: true, result: updated });
  };
  assert.deepEqual(await replace(edit), { statusCode: 200, data: { template: updated } });
  assert.deepEqual(await repository.readAll(), [updated]);
});
