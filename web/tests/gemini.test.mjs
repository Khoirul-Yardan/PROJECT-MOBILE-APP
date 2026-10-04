import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGemini, listGeminiModels, geminiEndpoint } from '../public/gemini.js';

const entry = { model: 'gemini-1.5-flash', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent' };
const history = [{ role: 'system', text: 'Use Indonesian.' }, { role: 'user', text: 'Halo' }];
const reply = { candidates: [{ content: { parts: [{ text: 'Halo!' }, { text: ' Ada yang bisa dibantu?' }] } }] };
const model = (id, methods = ['generateContent']) => ({ name: `models/${id}`, displayName: id, supportedGenerationMethods: methods });
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const missing = () => response({ error: { message: 'models/old is not found for API version v1beta, or is not supported for generateContent.' } }, 404);

test('legacy 404 discovers supported text models, retries, preserves history and reports actual model', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return missing();
    if (calls.length === 2) return response({ models: [model('text-embedding', ['embedContent']), model('gemini-4-image'), model('gemini-3-pro'), model('gemini-3-flash')] });
    return response(reply);
  });
  const result = await generateGemini(entry, 'test-key', history);
  assert.equal(result.model, 'gemini-3-flash');
  assert.equal(result.previousModel, 'gemini-1.5-flash');
  assert.equal(result.changed, true);
  assert.equal(result.text, 'Halo! Ada yang bisa dibantu?');
  assert.equal(calls.length, 3);
  assert.match(calls[2].url, /models\/gemini-3-flash:generateContent$/);
  assert.deepEqual(JSON.parse(calls[0].options.body), JSON.parse(calls[2].options.body));
  assert.equal(JSON.parse(calls[2].options.body).systemInstruction.parts[0].text, 'Use Indonesian.');
  for (const call of calls) {
    assert.ok(!call.url.includes('test-key'));
    assert.equal(call.options.headers['x-goog-api-key'], 'test-key');
  }
});

test('discovery follows pagination and removes duplicate/unsupported models', async (t) => {
  let count = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    count++;
    if (count === 1) return response({ models: [model('gemini-2-flash')], nextPageToken: 'a+b' });
    assert.equal(new URL(url).searchParams.get('pageToken'), 'a+b');
    return response({ models: [model('gemini-2-flash'), model('gemini-3-flash'), model('gemini-live'), model('gemini-tts'), model('embed', ['embedContent'])] });
  });
  assert.deepEqual((await listGeminiModels(entry, 'key')).map((m) => m.id), ['gemini-3-flash', 'gemini-2-flash']);
});

test('explicit model updates URL even when stored endpoint still points to old model', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/models/gemini-custom:generateContent');
    return response(reply);
  });
  const result = await generateGemini({ ...entry, model: 'models/gemini-custom' }, 'key', history);
  assert.equal(result.changed, false);
});

test('auto discovers rather than requesting a hardcoded retired model; cached success can be reused', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls++;
    if (String(url).includes('?')) return response({ models: [model('gemini-9-flash')] });
    assert.match(String(url), /gemini-9-flash:generateContent$/);
    return response(reply);
  });
  const automatic = { ...entry, model: 'auto' };
  const result = await generateGemini(automatic, 'key', history);
  assert.equal(result.model, 'gemini-9-flash');
  automatic._resolvedModel = result.model;
  await generateGemini(automatic, 'key', history);
  assert.equal(calls, 3);
});

for (const status of [401, 403, 429, 500, 503]) {
  test(`HTTP ${status} stops without model hopping`, async (t) => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; return response({ error: { message: 'Request denied' } }, status); });
    await assert.rejects(generateGemini(entry, 'key', history), /Request denied/);
    assert.equal(calls, 1);
  });
}

test('invalid request and safety refusals do not trigger fallback', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return response({ error: { message: 'contents is invalid' } }, 400); });
  await assert.rejects(generateGemini(entry, 'key', history), /contents is invalid/);
  assert.equal(calls, 1);
  t.mock.method(globalThis, 'fetch', async () => response({ promptFeedback: { blockReason: 'SAFETY' } }));
  await assert.rejects(generateGemini(entry, 'key', history), /tidak dapat menjawab/);
});

test('unsupported model 400 retries, but retries are bounded when all candidates are unavailable', async (t) => {
  let posts = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.method === 'GET') return response({ models: Array.from({ length: 10 }, (_, i) => model(`gemini-${i + 2}-flash`)) });
    posts++;
    return response({ error: { message: 'This model is not supported for generateContent' } }, 400);
  });
  await assert.rejects(generateGemini(entry, 'key', history), /Pilih model/);
  assert.equal(posts, 4);
});

test('network errors stop; empty catalog returns actionable message', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new TypeError('Network offline'); });
  await assert.rejects(generateGemini(entry, 'key', history), /Network offline/);
  assert.equal(calls, 1);
  t.mock.method(globalThis, 'fetch', async () => response({ models: [] }));
  await assert.rejects(generateGemini({ ...entry, model: 'auto' }, 'key', history), /Tidak ada model chat/);
});

test('payload removes leading assistant greeting, merges same-role turns, and excludes thoughts from reply', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(body.contents, [{ role: 'user', parts: [{ text: 'One' }, { text: 'Two' }] }]);
    return response({ candidates: [{ content: { parts: [{ thought: true, text: 'private thought' }, { text: 'Answer' }] } }] });
  });
  const result = await generateGemini(entry, 'key', [{ role: 'assistant', text: 'Greeting' }, { role: 'user', text: 'One' }, { role: 'user', text: 'Two' }]);
  assert.equal(result.text, 'Answer');
});

test('URL construction preserves host/version, strips stale query credentials, rejects path injection', () => {
  assert.equal(geminiEndpoint('https://example.test/v1/models/old:generateContent?key=secret', 'models/new'), 'https://example.test/v1/models/new:generateContent');
  assert.throws(() => geminiEndpoint(entry.endpoint, '../other'), /tidak valid/);
});
