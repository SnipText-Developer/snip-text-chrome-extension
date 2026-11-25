import { test } from "node:test";
import assert from "node:assert/strict";

import { mockSessionStorage } from "./mock-session-storage.mjs";
import { moduleUrl } from "./module-url.mjs";

globalThis.__STORAGE_ENCRYPTION_KEY_HEX__ = "11".repeat(32);

globalThis.chrome = { storage: { session: mockSessionStorage() } };

const repositoryUrl = moduleUrl("../src/background/editor/repository.ts");
const { service, EditorValidationError } = await import(moduleUrl(
  "../src/background/editor/service.ts", { '"./repository"': JSON.stringify(repositoryUrl) },
));

test("editor service rejects invalid inputs before changing state", async () => {
  for (const vendor of [undefined, null, "", "OTHER", {}, 3]) {
    await assert.rejects(service.getEditorStatus(vendor), EditorValidationError);
  }
  const before = structuredClone(await service.getEditorStatus("GOOGLE"));
  for (const status of [
    null, [], "text", { isEditable: 1 }, { text: null },
    { prevTexts: "bad" }, { prevTexts: [1] }, { prevTexts: [null] },
    { vendorName: "OTHER" }, { vendorName: "NAVER" }, { unknown: true },
  ]) await assert.rejects(service.updateEditorStatus("GOOGLE", status), EditorValidationError);
  await assert.rejects(service.addPrevText("GOOGLE", 1), EditorValidationError);
  await assert.rejects(service.updateText("GOOGLE", null, "history"), EditorValidationError);
  await assert.rejects(service.updateText("GOOGLE", "new", undefined), EditorValidationError);
  assert.deepEqual(await service.getEditorStatus("GOOGLE"), before);
  const updated = await service.updateEditorStatus("GOOGLE", { isEditable: true, text: "", prevTexts: [] });
  assert.equal(updated.isEditable, true);
  assert.equal(updated.text, "");
  await service.updateText("GOOGLE", "", "previous");
  assert.deepEqual((await service.getEditorStatus("GOOGLE")).prevTexts, ["previous"]);
});

test("editor updates share encrypted session storage across repository instances", async (t) => {
  const session = mockSessionStorage();
  const previous = chrome.storage.session;
  chrome.storage.session = session;
  t.after(() => { chrome.storage.session = previous; });

  await Promise.all([
    service.updateText("GOOGLE", "private-google-draft", "prior draft"),
    service.updateEditorStatus("NAVER", { text: "private-naver-draft" }),
  ]);
  const { "snip.editors": encrypted } = await session.get("snip.editors");
  assert.match(encrypted, /^snip:encrypted-v2:/);
  assert.ok(!encrypted.includes("private-google-draft"));

  const { repository: restarted } = await import(moduleUrl("../src/background/editor/repository.ts", {
    "pending": "restartedPending",
  }));
  assert.deepEqual((await restarted.read("GOOGLE")).prevTexts, ["prior draft"]);
  assert.equal((await restarted.read("NAVER")).text, "private-naver-draft");
  await restarted.deleteOne("GOOGLE");
  assert.equal(await service.getEditorStatus("GOOGLE"), undefined);
});
