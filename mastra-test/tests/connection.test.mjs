import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionHandlers } from '../src/mastra/connection-adapter.ts';
import { CONNECTION_PREFIX, parseMastraConnection, mastraConnectionEntry } from '../../web/public/mastra-connection.js';

const token = 'fixture-agent-token-123456';
const connection = { endpoint: 'https://agent.example.test', agentId: 'helper', token };
const encode = data => CONNECTION_PREFIX + Buffer.from(JSON.stringify(data)).toString('base64url');
const req = (body, key = token) => new Request('https://agent.example.test', {
  method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${key}` }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const metadata = { protocol: 'ai-hub-mastra-agent-v1', agent: { id: 'helper', name: 'Asisten', provider: 'Provider pemilik' } };
test('connection validates envelope and isolates server/agent identity', async () => {
  assert.deepEqual(parseMastraConnection(encode(connection)), connection);
  for (const endpoint of ['http://public.test', 'https://user:pass@host.test', 'https://host.test/?token=x', 'javascript:alert(1)']) {
    assert.throws(() => parseMastraConnection(encode({ ...connection, endpoint })));
  }
  assert.throws(() => parseMastraConnection('some-ordinary-api-key'));
  assert.throws(() => parseMastraConnection(encode({ ...connection, agentId: '../other' })));
  const a = await mastraConnectionEntry(connection, metadata);
  const b = await mastraConnectionEntry({ ...connection, endpoint: 'https://other.test' }, metadata);
  assert.notEqual(a.id, b.id);
  assert.equal(a.format, 'mastra-agent');
  assert.equal(a.token, undefined);
  await assert.rejects(mastraConnectionEntry(connection, { ...metadata, agent: { id: 'other' } }));
});
test('discovery and chat require agent token; provider selection stays on server', async () => {
  let received;
  const handlers = connectionHandlers({ id: 'helper', name: 'Asisten', provider: 'Any provider', token: () => token,
    generate: async messages => { received = messages; return 'Jawaban fixture'; } });
  assert.equal((await handlers.capabilities(req(null, 'wrong-token-123456'))).status, 401);
  assert.equal((await handlers.chat(req({ messages: [] }, 'wrong-token-123456'))).status, 401);
  assert.equal((await handlers.capabilities(req())).status, 200);
  const messages = [{ role: 'user', content: 'Contoh fiktif' }];
  assert.equal((await handlers.chat(req({ messages }))).status, 200);
  assert.deepEqual(received, messages);
  assert.equal((await handlers.chat(req({ messages, model: 'user-cannot-override' }))).status, 400);
  assert.equal((await handlers.chat(req({ messages: [{ role: 'assistant', content: 'wrong last role' }] }))).status, 400);
  assert.equal((await handlers.chat(req({ messages: [{ role: 'user', content: 'x'.repeat(270000) }] }))).status, 413);
});
test('missing config fails closed and upstream errors disclose no secrets', async () => {
  const config = { id: 'helper', name: 'Asisten', token: () => undefined, generate: async () => { throw new Error(token); } };
  assert.equal((await connectionHandlers(config).capabilities(req())).status, 401);
  const result = await connectionHandlers({ ...config, token: () => token }).chat(req({ messages: [{ role: 'user', content: 'fiktif' }] }));
  assert.equal(result.status, 502);
  assert.ok(!(await result.text()).includes(token));
});
