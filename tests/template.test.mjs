import { test } from "node:test";
import assert from "node:assert/strict";
import { moduleUrl } from "./module-url.mjs";

const senderUrl = moduleUrl("../src/background/common/message-sender.ts");
const repositoryUrl = moduleUrl("../src/background/template/repository.ts");
const serviceUrl = moduleUrl("../src/background/template/service.ts", { '"./repository"': JSON.stringify(repositoryUrl) });
const routerUrl = moduleUrl("../src/background/template/router.ts", { '"./service"': JSON.stringify(serviceUrl), '"../common/message-sender"': JSON.stringify(senderUrl) });
const { router } = await import(routerUrl);
const { repository } = await import(repositoryUrl);
const { service } = await import(serviceUrl);
let stored = {};
let failWrite = false;
const sender = { id: "extension-id", url: "chrome-extension://extension-id/src/page/index.html" };
globalThis.chrome = { runtime: { id: "extension-id", getURL: (path) => "chrome-extension://extension-id/" + path }, storage: { local: {
  get: async () => structuredClone(stored),
  set: async (data) => {
    if (failWrite) throw new Error("write failed");
    stored = structuredClone(data);
  },
} } };
const replace = (data, src = "PAGE") => router({ src, dst: "BACKGROUND", method: "PUT", path: "/template/replace", data }, sender);
const dates = { lastUsedAt: "2026-10-07T09:12:00+09:00", createdAt: "2026-09-20T14:03:00+09:00", editedAt: "2026-10-01T11:40:00+09:00" };
const template = (templateId, changes = {}) => ({ templateId, title: "이름", shortcut: "/" + templateId, content: "본문", variables: [], ...dates, ...changes });

test("full template replacement validates, persists and preserves concurrent writes", async () => {
  const listRequest = { src: "CONTENT", dst: "BACKGROUND", method: "GET", path: "/template/list", data: {} };
  const contentSender = { id: "extension-id", tab: { id: 1 }, url: "https://mail.google.com/mail/u/0/" };
  assert.equal((await router(listRequest, contentSender)).statusCode, 200);
  assert.equal(await router({ ...listRequest, src: "PAGE" }, contentSender), undefined);
  assert.equal(await router(listRequest, { ...contentSender, url: "https://evil.example/" }), undefined);
  assert.equal(await router(listRequest, { ...contentSender, id: "another-extension" }), undefined);
  stored = { "snip.templates": [{ id: "1", name: "기존 제목", command: "/old", text: "기존 본문" }] };
  assert.deepEqual(await repository.readAll(), [
    { templateId: 1, title: "기존 제목", shortcut: "/old", content: "기존 본문", variables: [], lastUsedAt: "1970-01-01T00:00:00.000Z", createdAt: "1970-01-01T00:00:00.000Z", editedAt: "1970-01-01T00:00:00.000Z" },
  ]);
  stored = {};
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
