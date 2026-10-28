import { test } from "node:test";
import assert from "node:assert/strict";
import { moduleUrl } from "./module-url.mjs";

const { router } = await import(moduleUrl("../src/background/ai/router.ts"));

const { service } = await import(moduleUrl("../src/background/editor/service.ts"));

test("AI tone correction prefixes the stored editor text and validates callers", async (t) => {
  const previous = globalThis.chrome;
  globalThis.chrome = {
    runtime: { id: "extension", getURL: (path) => "chrome-extension://extension/" + path },
  };
  t.after(() => { globalThis.chrome = previous; });
  const content = { id: "extension", tab: { id: 1 }, url: "https://mail.google.com/" };
  const page = { id: "extension", url: "chrome-extension://extension/src/page/index.html" };
  const request = {
    src: "CONTENT", dst: "BACKGROUND", method: "POST", path: "/ai/tone-correction",
    data: { tone: "상사/외부용" },
  };
  await service.updateEditorStatus("GOOGLE", { text: "작성한 본문\n둘째 줄" });
  await service.updateEditorStatus("NAVER", { text: "다른 메일 본문" });
  t.after(async () => {
    await service.updateEditorStatus("GOOGLE", { text: "" });
    await service.updateEditorStatus("NAVER", { text: "" });
  });
  const received = { statusCode: 200, data: { text: "(톤교정)작성한 본문\n둘째 줄" } };
  assert.deepEqual(await router(request, content), received);
  assert.deepEqual(await router({ ...request, src: "PAGE", data: { tone: "격식", vendorName: "GOOGLE" } }, page), received);
  assert.equal(await router(request, { ...content, url: "https://example.com/" }), undefined);
  assert.equal(await router({ ...request, src: "PAGE" }, content), undefined);
  assert.equal(await router({ ...request, method: "GET" }, content), undefined);
  assert.equal(await router({ ...request, dst: "CONTENT" }, content), undefined);
  assert.equal(await router({ ...request, path: "/ai/unknown" }, content), undefined);
  for (const data of [null, [], {}, { tone: " " }, { tone: 1 }]) {
    assert.equal((await router({ ...request, data }, content)).statusCode, 400);
  }
  assert.deepEqual(await router({ ...request, data: { tone: "격식", vendorName: "NAVER", text: "요청 본문" } }, content), received, "CONTENT uses its sender vendor and stored body");
  assert.equal((await router({ ...request, src: "PAGE" }, page)).statusCode, 400);
  await service.updateEditorStatus("GOOGLE", { text: "본문 /톤교정" });
  assert.equal((await router(request, content)).data.text, "(톤교정)본문 ");
  await service.updateEditorStatus("GOOGLE", { text: "본문/톤교정" });
  assert.equal((await router(request, content)).data.text, "(톤교정)본문");
  for (const command of ["/톤", "/톤교", "/톤교정"]) {
    await service.updateEditorStatus("GOOGLE", { text: `본문${command}  ` });
    assert.equal((await router(request, content)).data.text, "(톤교정)본문");
    await service.updateEditorStatus("GOOGLE", { text: command });
    assert.equal((await router(request, content)).statusCode, 400);
  }
  for (const text of ["본문/톤ㅇ", "본문/톤교정안내", "본문/다른예약어", "/톤교정 뒤에 본문"]) {
    await service.updateEditorStatus("GOOGLE", { text });
    assert.equal((await router(request, content)).data.text, `(톤교정)${text}`);
  }
  await service.updateEditorStatus("GOOGLE", { text: "/톤교정" });
  assert.equal((await router(request, content)).statusCode, 400);
  await service.updateEditorStatus("GOOGLE", { text: " " });
  assert.equal((await router(request, content)).statusCode, 400);
});

test("AI service validates inputs independently of the router", async (t) => {
  const { service: aiService, AiValidationError } = await import(moduleUrl("../src/background/ai/service.ts"));
  await service.updateEditorStatus("NAVER", { text: "안녕하세요/톤교" });
  t.after(() => service.updateEditorStatus("NAVER", { text: "" }));
  assert.deepEqual(await aiService.correctTone({ vendorName: "NAVER", tone: "공지", removeCommand: true }), { text: "(톤교정)안녕하세요" });
  assert.deepEqual(await aiService.correctTone({ vendorName: "NAVER", tone: "공지" }), { text: "(톤교정)안녕하세요/톤교" });
  for (const input of [{ vendorName: "INVALID", tone: "공지" }, { vendorName: "NAVER", tone: " " }, { vendorName: "NAVER", tone: 1 }]) {
    await assert.rejects(aiService.correctTone(input), AiValidationError);
  }
});
