import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText).toString('base64');
const source = readFileSync(new URL('../src/common/email-ai.ts', import.meta.url), 'utf8')
  .replace('import.meta.env.VITE_AI_PROXY_URL', 'globalThis.__proxyUrl');
const api = await import(compile(source));
const input = { senderName: '홍길동', recipientName: '김담당님', details: '10월 20일 회의 가능 여부 문의' };
const output = '안녕하세요.\n\n홍길동입니다.\n\n10월 20일 회의가 가능하신가요?\n\n감사합니다.';
const completion = (content, finish_reason = 'stop') => Response.json({ choices: [{ finish_reason, message: { content } }] });
let calls;
function run(signal = new AbortController().signal, language = 'ko', value = input) {
  return api.generate({ language }, value, signal);
}
beforeEach(() => {
  calls = [];
  globalThis.__proxyUrl = 'https://proxy.example/api/chat/completions';
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options, request: JSON.parse(options.body) });
    return completion(output);
  };
});
test('one proxy request sends only sender, recipient, details and selected language', async () => {
  assert.equal(await run(), output);
  assert.equal(calls.length, 1);
  const { url, options, request } = calls[0];
  assert.equal(url, globalThis.__proxyUrl);
  assert.equal(options.method, 'POST');
  assert.equal(options.credentials, 'include');
  assert.deepEqual(options.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(request, { ...input, language: 'ko' });
});
test('missing or invalid configuration prevents network calls', async () => {
  for (const value of ['', '/api/chat', 'ftp://proxy.example', 'https://user:secret@proxy.example']) {
    globalThis.__proxyUrl = value;
    await assert.rejects(run(), /서버 주소/);
  }
  assert.equal(calls.length, 0);
});
test('input validation runs before network calls', async () => {
  for (const value of [{ ...input, senderName: '' }, { ...input, senderName: '이름\n이름' }, { ...input, recipientName: '' }, { ...input, recipientName: '   ' }, { ...input, recipientName: '김담당\n님' }, { ...input, recipientName: '가'.repeat(101) }, { ...input, details: '' }, { ...input, details: '가'.repeat(4001) }])
    await assert.rejects(run(undefined, 'ko', value), /입력해주세요/);
  await assert.rejects(run(undefined, 'fr'), /지원하지 않는 언어/);
  assert.equal(calls.length, 0);
});
test('HTTP, network, invalid JSON and malformed completion failures allow subsequent runs', async () => {
  const normal = globalThis.fetch;
  for (const response of [new Response('unauthorized', { status: 401 }), new Response('busy', { status: 429 }), new Response('invalid json'), Response.json({}), Response.json({ choices: [{ message: { content: 42 } }] })]) {
    globalThis.fetch = async () => response;
    await assert.rejects(run(), /API 호출 실패/);
  }
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(run(), /Failed to fetch/);
  globalThis.fetch = normal;
  assert.ok(await run());
});
test('empty and truncated results fail without partial email', async () => {
  for (const response of [completion(''), completion('부분 본문', 'length')]) {
    globalThis.fetch = async () => response;
    await assert.rejects(run(), /생성되지|길이 제한/);
  }
});
test('English selection and normalized input are sent without added instructions', async () => {
  await run(undefined, 'en', { senderName: '  홍길동  ', recipientName: '  김담당님  ', details: '  회의 일정\r\n확인 요청  ' });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].request, { senderName: '홍길동', recipientName: '김담당님', details: '회의 일정\n확인 요청', language: 'en' });
});
test('server output is returned without local rewriting or additional requests', async () => {
  const content = '서버가 완성한 메일 본문';
  globalThis.fetch = async () => { calls.push({}); return completion(content); };
  assert.equal(await run(), content);
  assert.equal(calls.length, 1);
});
test('cancellation aborts fetch and blocks concurrent generation', async () => {
  let started;
  const waiting = new Promise(resolve => { started = resolve; });
  const normal = globalThis.fetch;
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    started();
  });
  const controller = new AbortController();
  const pending = run(controller.signal);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await waiting;
  await assert.rejects(run(), /이미 진행/);
  controller.abort();
  await rejected;
  globalThis.fetch = normal;
  assert.ok(await run());
});
test('request timeout aborts fetch and permits retry', async t => {
  const normal = globalThis.fetch;
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const pending = assert.rejects(run(), /3분/);
    t.mock.timers.tick(180_000);
    await pending;
  } finally { t.mock.timers.reset(); globalThis.fetch = normal; }
  assert.ok(await run());
});
