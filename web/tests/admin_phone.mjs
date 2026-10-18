// Smoke baca admin Fly pada Chrome Android lewat ADB/CDP. Node >=22.
// adb forward tcp:9222 localabstract:chrome_devtools_remote
// node web/tests/admin_phone.mjs
// Tidak mencetak nilai akun, secret, isi tabel, atau screenshot perangkat.
import fs from 'node:fs/promises';

const origin = 'https://ai-hub-admin.fly.dev';
const debuggerUrl = 'http://127.0.0.1:9222';
const targets = await (await fetch(`${debuggerUrl}/json/list`)).json();
const target = targets.find(t => t.type === 'page' && t.url.startsWith(origin));
if (!target) throw new Error('Buka admin Fly di Chrome HP terlebih dahulu.');
await fetch(`${debuggerUrl}/json/activate/${target.id}`);
const wsUrl = new URL(target.webSocketDebuggerUrl);
wsUrl.host = '127.0.0.1:9222';
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let seq = 0;
const pending = new Map();
ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  const call = pending.get(message.id);
  if (!call) return;
  pending.delete(message.id);
  clearTimeout(call.timer);
  if (message.error) call.reject(new Error(`CDP ${call.method} gagal`));
  else call.resolve(message.result);
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP ${method} timeout`)); }, 20000);
    pending.set(id, { resolve, reject, timer, method });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error('Evaluasi halaman gagal; isi tidak dicetak.');
  return result.result.value;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(expression) {
  for (let i = 0; i < 60; i++) {
    if (await evaluate(expression)) return;
    await pause(300);
  }
  throw new Error('Halaman belum siap setelah 18 detik.');
}
async function tap(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center', inline:'nearest', behavior:'instant'})`);
  // Tunggu transisi sidebar selesai sebelum menghitung koordinat sentuhan.
  await pause(250);
  const point = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {x:r.left+r.width/2, y:r.top+r.height/2};
  })()`);
  if (!point) throw new Error('Kontrol sentuh tidak ditemukan.');
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const failures = [];
function check(name, valid) {
  console.log(`${valid ? 'PASS' : 'FAIL'} HP: ${name}`);
  if (!valid) failures.push(name);
}
try {
  await send('Page.navigate', { url: origin });
  await waitFor(`!!document.querySelector('#u, .shell')`);
  if (await evaluate(`!!document.querySelector('#u')`)) {
    const credentials = {};
    for (const line of (await fs.readFile(new URL('../.env', import.meta.url), 'utf8')).split(/\r?\n/)) {
      const match = line.match(/^\s*(ADMIN_USER|ADMIN_PASSWORD)=(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
      credentials[match[1]] = value;
    }
    if (!credentials.ADMIN_PASSWORD) throw new Error('Password admin lokal belum tersedia.');
    await evaluate(`(() => {
      document.querySelector('#u').value = ${JSON.stringify(credentials.ADMIN_USER || 'admin')};
      document.querySelector('#p').value = ${JSON.stringify(credentials.ADMIN_PASSWORD)};
    })()`);
    await tap('#f button');
    await waitFor(`!!document.querySelector('.shell')`);
  }
  check('login Fly berhasil', await evaluate(`!!document.querySelector('.shell')`));
  check('Menu tampil pada layar kecil', await evaluate(`getComputedStyle(document.querySelector('#menu')).display !== 'none'`));
  check('katalog lama tidak tampil', await evaluate(`!document.querySelector('.nav a[href="#/r/remote_bots"], .nav a[href="#/r/remote_providers"], .nav a[href="#/r/app_settings"]')`));
  await waitFor(`!!document.querySelector('#view .stat')`);
  check('dashboard tidak melebar', await evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1'));
  const links = await evaluate(`[...document.querySelectorAll('.nav a')].map(a => ({href:a.getAttribute('href'),label:a.textContent.trim()}))`);
  const schema = await evaluate(`fetch('/api/schema').then(r => r.json())`);
  // Dashboard sudah diuji pada pembukaan halaman. Sisanya lewat sentuhan menu.
  for (const link of links.filter(link => link.href !== '#/dashboard')) {
    await tap('#menu');
    await waitFor(`document.querySelector('#menu').getAttribute('aria-expanded') === 'true'`);
    await tap(`.nav a[href="${link.href}"]`);
    await waitFor(`location.hash === ${JSON.stringify(link.href)} && document.querySelector('#menu').getAttribute('aria-expanded') === 'false'`);
    const expectedTitle = link.href.startsWith('#/r/') ? schema[link.href.slice(4)].label : link.label;
    await waitFor(`document.querySelector('#view h1')?.textContent.trim() === ${JSON.stringify(expectedTitle)} && ![...document.querySelectorAll('#view .empty')].some(el => /^(Memuat|Memeriksa)/.test(el.textContent.trim()))`);
    const pageResult = await evaluate(`(() => ({
      ready: document.querySelector('#view h1')?.textContent.trim(),
      failed: !!document.querySelector('#view .notice.bad') || [...document.querySelectorAll('#view .empty')].some(el => /Gagal memuat|Tabel tidak dikenal/.test(el.textContent)),
      fits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      role: !!document.querySelector('#role, #f-role') || [...document.querySelectorAll('#view th')].some(el => /^(role|peran)$/i.test(el.textContent.trim()))
    }))()`);
    check(link.label + ' terbuka', !!pageResult.ready && !pageResult.failed);
    check(link.label + ' sesuai lebar layar', pageResult.fits);
    if (link.href === '#/users' || link.href === '#/r/profiles') check(link.label + ' tanpa peran', !pageResult.role);
  }
  await tap('#menu');
  await waitFor(`document.querySelector('#menu').getAttribute('aria-expanded') === 'true'`);
  await tap('#close-menu');
  await waitFor(`document.querySelector('#menu').getAttribute('aria-expanded') === 'false'`);
  check('tombol Tutup menu berfungsi', true);
  await send('Page.navigate', { url: origin + '/#/dashboard' });
} finally {
  ws.close();
}
if (failures.length) process.exitCode = 1;
