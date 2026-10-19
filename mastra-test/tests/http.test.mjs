import test from 'node:test';
import assert from 'node:assert/strict';
import { handleChat, capabilities } from '../src/mastra/http.ts';
import { calculate, currentTime, agentTools } from '../src/mastra/tools/ai-hub.ts';

const input = { model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: 'Data fiktif: 6 kali 7' }] };
const request = (body = input, key = 'fixture-key') => new Request('http://localhost/ai-hub/chat', {
  method: 'POST', headers: { Authorization: key ? `Bearer ${key}` : '', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('missing key never uses server environment key', async () => {
  let called = false;
  const response = await handleChat(request(input, ''), async () => { called = true; return 'bad'; });
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test('keys and history stay scoped to simultaneous requests', async () => {
  const seen = [];
  const invoke = async (payload, key) => {
    await new Promise((resolve) => setTimeout(resolve, key === 'alice' ? 20 : 1));
    seen.push([key, payload.messages[0].content]);
    return '42';
  };
  const replies = await Promise.all([
    handleChat(request(input, 'alice'), invoke),
    handleChat(request({ ...input, messages: [{ role: 'user', content: 'Sesi Bob fiktif' }] }, 'bob'), invoke),
  ]);
  assert.deepEqual(seen, [['bob', 'Sesi Bob fiktif'], ['alice', 'Data fiktif: 6 kali 7']]);
  for (const reply of replies) {
    assert.equal(reply.status, 200);
    assert.equal(reply.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await reply.json(), { protocol: 'ai-hub-mastra-v1', text: '42' });
  }
});

test('reject invalid models, roles, history and extra configuration before generation', async () => {
  for (const body of [
    { ...input, model: 'openai/gpt-4o' },
    { ...input, messages: [] },
    { ...input, messages: [{ role: 'tool', content: 'bad' }] },
    { ...input, messages: [{ role: 'assistant', content: 'bad' }] },
    { ...input, messages: [{ role: 'user', content: 'x'.repeat(16001) }] },
    { ...input, apiKey: 'override', threadId: 'shared' },
  ]) {
    const response = await handleChat(request(body), async () => { throw new Error('must not invoke'); });
    assert.equal(response.status, 400);
  }
  const malformed = new Request('http://localhost/chat', { method: 'POST', headers: { Authorization: 'Bearer fixture' }, body: '{' });
  assert.equal((await handleChat(malformed)).status, 400);
});

test('bound body size even without Content-Length', async () => {
  const response = await handleChat(request({ ...input, messages: [{ role: 'user', content: 'x'.repeat(270000) }] }));
  assert.equal(response.status, 413);
});

test('upstream errors preserve retry status without leaking prompts or keys', async () => {
  for (const [error, expected] of [
    [{ statusCode: 429, message: 'secret-key + confidential prompt' }, 429],
    [{ cause: { status: 403 }, message: 'secret-key' }, 401],
    [{ name: 'TimeoutError', message: 'secret-key' }, 504],
    [{ statusCode: 500, message: 'secret-key' }, 502],
  ]) {
    const response = await handleChat(request(), async () => { throw error; });
    assert.equal(response.status, expected);
    assert.doesNotMatch(await response.text(), /secret-key|confidential prompt/);
  }
});

test('empty model response is an error', async () => {
  assert.equal((await handleChat(request(), async () => '')).status, 502);
});

test('discovery matches registered tools and tools execute bounded operations', () => {
  assert.deepEqual(capabilities().skills.map((s) => s.name), Object.keys(agentTools));
  assert.equal(calculate(6, 7, 'multiply').value, 42);
  assert.throws(() => calculate(1, 0, 'divide'));
  assert.throws(() => calculate(Number.MAX_VALUE, Number.MAX_VALUE, 'multiply'));
  assert.equal(currentTime('Asia/Jakarta').timeZone, 'Asia/Jakarta');
  assert.throws(() => currentTime('invalid/timezone'));
});
