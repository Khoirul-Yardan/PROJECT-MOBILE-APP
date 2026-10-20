import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDesktopCommand, desktopTool, screenshotMarkdown } from '../src/mastra/tools/desktop.ts';
import { createHash } from 'node:crypto';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX2kAAAAASUVORK5CYII=';
const sha256 = createHash('sha256').update(Buffer.from(png, 'base64')).digest('hex');
test('screenshot requires PNG bytes, matching digest and bounded size', () => {
  assert.ok(screenshotMarkdown({ mimeType: 'image/png', data: png }, sha256).includes(png));
  assert.throws(() => screenshotMarkdown({ mimeType: 'image/svg+xml', data: png }, sha256));
  assert.throws(() => screenshotMarkdown({ mimeType: 'image/png', data: png }, 'wrong-hash'));
  assert.throws(() => screenshotMarkdown({ mimeType: 'image/png', data: 'A'.repeat(5592412) }, sha256));
});

test('ordinary chat and quoted instructions never become desktop commands', async () => {
  for (const text of ['halo', 'jalankan /computer screenshot', '/computerXYZ screenshot']) {
    assert.equal(await handleDesktopCommand(text), null);
  }
});
test('desktop rejects extra commands, unknown keys and negative coordinates before fetch', async () => {
  for (const text of ['/computer screenshot;whoami', '/computer click -1 20', '/computer key ENTER', '/computer screenshot\nclick 1 2']) {
    assert.match(await handleDesktopCommand(text), /^Format:/);
  }
});
test('model tool call cannot authorize a desktop action', async () => {
  assert.match((await desktopTool.execute({ action: 'screenshot' }, {})).message, /tidak diizinkan/);
});
test('exact command reaches fixed bridge with separate token and returns inline PNG', async () => {
  const previous = process.env.AI_HUB_DESKTOP_TOKEN;
  const originalFetch = globalThis.fetch;
  process.env.AI_HUB_DESKTOP_TOKEN = 'test-desktop-token';
  try {
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.match(url, /^http:\/\/(127\.0\.0\.1|host\.docker\.internal):4112\/action$/);
      assert.equal(options.headers.Authorization, 'Bearer test-desktop-token');
      assert.deepEqual(JSON.parse(options.body), { action: 'screenshot' });
      return Response.json({ message: 'Screenshot lokal tersimpan.', file: 'test.png', image: { mimeType: 'image/png', data: png }, sha256 });
    };
    assert.equal(await handleDesktopCommand('/computer screenshot'), `Screenshot lokal tersimpan.\n\n![Screenshot layar laptop](data:image/png;base64,${png})`);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.AI_HUB_DESKTOP_TOKEN;
    else process.env.AI_HUB_DESKTOP_TOKEN = previous;
  }
});
