import test from 'node:test';
import assert from 'node:assert/strict';
import { textForModel } from '../public/chat-content.js';

test('large screenshot stays in history but does not inflate the next text request', () => {
  const text = 'Screenshot\n![Layar](data:image/png;base64,' + 'A'.repeat(400000) + ')';
  const cleaned = textForModel(text);
  assert.ok(cleaned.length < 16000);
  assert.ok(!cleaned.includes('base64'));
  assert.ok(text.length > 400000);
  assert.equal(textForModel('Apa hasil 6 kali 7?'), 'Apa hasil 6 kali 7?');
});
test('also strips bare image data and repeated image attachments', () => {
  const image = 'data:image/png;base64,AAAA';
  assert.ok(!textForModel(`![Satu](${image}) ![Dua](${image}) ${image}`).includes('base64'));
});
