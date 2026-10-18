// Helper bersama: fetch API, DOM, modal, toast, format.

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Cadangan bila browser menolak cookie: token sesi disimpan per-tab dan dikirim
// sebagai Bearer. Hilang saat tab ditutup.
const TOKEN_KEY = 'aihub.admin.token';
const getToken = () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* diblokir: cookie saja */ } };

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'aihub-admin', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch { /* tubuh kosong */ }
  if (res.status === 401 && path !== '/login') window.dispatchEvent(new Event('admin:unauth'));
  if (!res.ok) throw new ApiError(res.status, data?.error || `Gagal (${res.status})`);
  return data;
}

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const ICONS = {
  home: '<path d="m3 10 9-7 9 7v10H15v-7H9v7H3z"/>',
  bot: '<rect x="4" y="7" width="16" height="14" rx="4"/><path d="M12 3v4M1 12v4m22-4v4M8 12v2m8-2v2m-7 3h6"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  users: '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 5v2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  sliders: '<path d="M4 6h10m4 0h2M4 12h4m4 0h8M4 18h12m4 0h0M14 4v4m-6 2v4m8 2v4"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  log: '<path d="M14 2H5v20h14V7zM14 2v6h5M8 12h8m-8 4h6"/>',
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a3.5 3.5 0 0 0-5-5L4 14z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  out: '<path d="M10 4H5v16h5M15 8l4 4-4 4M9 12h10"/>',
};
export const icon = (n) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ICONS.db}</svg>`;

export function toast(msg, bad = false) {
  const el = h(`<div class="toast ${bad ? 'bad' : ''}" role="status"></div>`);
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), bad ? 6000 : 3200);
}

/** Modal generik. `build(body, close)` mengisi isi; mengembalikan fungsi close. */
export function modal(title, build, { wide = false } = {}) {
  const ov = h(`<div class="overlay"><div class="modal" role="dialog" aria-modal="true" ${wide ? 'style="max-width:820px"' : ''}><h2></h2><div class="body"></div></div></div>`);
  ov.querySelector('h2').textContent = title;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  document.body.appendChild(ov);
  build(ov.querySelector('.body'), close);
  ov.querySelector('input,select,textarea')?.focus();
  return close;
}

/** Konfirmasi; bila `typed` diisi, pengguna harus mengetik teks itu. */
export function confirmBox(title, message, { okLabel = 'Hapus', typed = null } = {}) {
  return new Promise((resolve) => {
    modal(title, (body, close) => {
      body.innerHTML = `<p style="margin-top:0"></p>
        ${typed ? `<div class="field"><label>Ketik <b class="mono"></b> untuk melanjutkan</label><input id="typed" autocomplete="off"></div>` : ''}
        <div class="modal-actions"><button class="btn" data-no>Batal</button><button class="btn btn-danger" data-ok>${esc(okLabel)}</button></div>`;
      body.querySelector('p').textContent = message;
      if (typed) body.querySelector('b').textContent = typed;
      const ok = body.querySelector('[data-ok]');
      if (typed) {
        ok.disabled = true;
        body.querySelector('#typed').oninput = (e) => { ok.disabled = e.target.value !== typed; };
      }
      body.querySelector('[data-no]').onclick = () => { close(); resolve(false); };
      ok.onclick = () => { close(); resolve(true); };
    });
  });
}

export const fmtDate = (v) => (v ? new Date(v).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
/** ISO → nilai <input type=datetime-local> (zona waktu lokal). */
export const toLocalInput = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function pageHead(eyebrow, title, desc, actionsHtml = '') {
  return h(`<div class="topbar"><div><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1>${desc ? `<p>${esc(desc)}</p>` : ''}</div><div class="actions">${actionsHtml}</div></div>`);
}
