import { test } from "node:test";
import assert from "node:assert/strict";

import { moduleUrl } from "./module-url.mjs";

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
