// Shell panel admin: login, sidebar, router hash.
import { api, h, esc, icon, toast, setToken } from './lib.js';
import dashboard from './pages/dashboard.js';
import resource from './pages/resource.js';
import users from './pages/users.js';
import maintenance from './pages/maintenance.js';
import system from './pages/system.js';

const rootEl = document.getElementById('root');
let schema = {};
let me = null;
let disposeShell = () => {};

const NAV = [
  { group: 'Ringkasan', items: [['#/dashboard', 'Dashboard', 'home']] },
  { group: 'Operasional', items: [['#/maintenance', 'Maintenance', 'tool'], ['#/r/announcements', 'Pengumuman', 'bell']] },
  { group: 'Pengguna', items: [['#/users', 'Akun pengguna', 'users'], ['#/r/profiles', 'Profil pengguna', 'users']] },
  { group: 'Data (metadata)', items: [
    ['#/r/bpjs_sessions', 'Sesi Bot BPJS', 'db'], ['#/r/bpjs_transcripts', 'Segmen transkrip', 'db'], ['#/r/bpjs_documents', 'Dokumentasi LLM', 'db'],
    ['#/r/komunikasi_events', 'Papan: event', 'db'], ['#/r/komunikasi_rooms', 'Papan: ruangan', 'db'], ['#/r/chat_messages', 'Pesan Chat', 'db'],
    ['#/r/api_credentials', 'API key pengguna', 'shield'], ['#/r/vpn_configs', 'Konfigurasi VPN', 'shield'], ['#/r/activity_log', 'Log aktivitas', 'db'],
  ] },
  { group: 'Sistem', items: [['#/r/admin_audit_log', 'Audit log', 'log'], ['#/system', 'Status & Setup', 'pulse']] },
];

function renderLogin(message = '') {
  disposeShell();
  rootEl.replaceChildren(h(`<div class="login-wrap"><div class="login">
    <div class="card"><span class="eyebrow">AI HUB</span><h1>Panel Admin</h1>
      <p class="muted" style="margin:0 0 20px">Masuk untuk memeriksa database, akun pengguna, dan kondisi sistem.</p>
      <form id="f"><div class="field"><label for="u">Username</label><input id="u" autocomplete="username" required></div>
        <div class="field"><label for="p">Password</label><input id="p" type="password" autocomplete="current-password" required></div>
        <p class="error-text" id="err" ${message ? '' : 'hidden'}>${esc(message)}</p>
        <button class="btn btn-primary" style="width:100%;margin-top:6px">Masuk</button></form></div>
    <p class="muted small" style="text-align:center;margin-top:16px">Akses terbatas. Semua tindakan tercatat.</p></div></div>`));
  rootEl.querySelector('#u').focus();
  rootEl.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const err = rootEl.querySelector('#err');
    try {
      const r = await api('/login', { method: 'POST', body: { username: rootEl.querySelector('#u').value, password: rootEl.querySelector('#p').value } });
      setToken(r.token);
      await boot(true);
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  };
}

function renderShell() {
  disposeShell();
  const shell = h(`<div class="shell"><aside class="sidebar" id="sidebar" aria-label="Navigasi admin">
    <button class="btn btn-sm menu-toggle" id="close-menu" style="margin-bottom:14px">${icon('menu')} Tutup menu</button>
    <div class="brand"><svg width="30" height="30" viewBox="0 0 100 100" fill="none"><path d="M20 48 64 12M20 84 74 42M44 64 76 84" stroke="#286a64" stroke-width="5" stroke-linecap="round"/><g stroke="#1c504b" stroke-width="1.5" fill="#286a64"><circle cx="64" cy="12" r="10"/><circle cx="20" cy="48" r="10"/><circle cx="74" cy="42" r="10"/><circle cx="44" cy="64" r="10"/><circle cx="20" cy="84" r="10"/><circle cx="76" cy="84" r="10"/></g></svg><div>AI Hub<small>PANEL ADMIN</small></div></div>
    <nav class="nav">${NAV.map((g) => `<div class="nav-group">${esc(g.group)}</div>${g.items.map(([href, label, ic]) => `<a href="${href}" data-href="${href}">${icon(ic)}<span>${esc(label)}</span></a>`).join('')}`).join('')}</nav>
    <div class="sidebar-foot"><div class="small muted" style="margin-bottom:8px">Masuk sebagai <b>${esc(me.user)}</b></div>
      <button class="btn btn-sm" id="logout">${icon('out')} Keluar</button></div>
  </aside><button class="nav-backdrop" id="menu-backdrop" aria-label="Tutup menu" tabindex="-1"></button><main class="main"><button class="btn btn-sm menu-toggle" id="menu" aria-label="Buka menu navigasi" aria-controls="sidebar" aria-expanded="false" style="margin-bottom:14px">${icon('menu')} Menu</button><div id="view"></div></main></div>`);
  shell.querySelector('#logout').onclick = async () => { await api('/logout', { method: 'POST' }).catch(() => {}); setToken(null); renderLogin(); };
  const menu = shell.querySelector('#menu');
  const sidebar = shell.querySelector('.sidebar');
  const mobile = window.matchMedia('(max-width:900px)');
  const setMenu = (open) => {
    shell.classList.toggle('nav-open', open);
    menu.setAttribute('aria-expanded', String(open));
    sidebar.inert = mobile.matches && !open;
    shell.querySelector('.main').inert = mobile.matches && open;
  };
  const closeMenu = () => { setMenu(false); if (mobile.matches) menu.focus(); };
  menu.onclick = () => { setMenu(true); shell.querySelector('#close-menu').focus(); };
  shell.querySelector('#close-menu').onclick = closeMenu;
  shell.querySelector('#menu-backdrop').onclick = closeMenu;
  sidebar.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
  shell.addEventListener('keydown', (e) => { if (e.key === 'Escape' && shell.classList.contains('nav-open')) closeMenu(); });
  const resetMenu = () => setMenu(false);
  mobile.addEventListener('change', resetMenu);
  disposeShell = () => mobile.removeEventListener('change', resetMenu);
  setMenu(false);
  rootEl.replaceChildren(shell);
}

let token = 0;
async function route() {
  const view = rootEl.querySelector('#view');
  if (!view) return;
  const hash = location.hash || '#/dashboard';
  rootEl.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.href === hash));
  const my = ++token;
  const box = document.createElement('div');
  const [, kind, arg] = hash.split('/');
  try {
    if (kind === 'r') await resource(box, arg, schema);
    else if (kind === 'users') await users(box);
    else if (kind === 'maintenance') await maintenance(box);
    else if (kind === 'system') await system(box);
    else await dashboard(box);
  } catch (e) {
    box.innerHTML = `<div class="notice bad"><div><b>Halaman gagal dimuat</b><p>${esc(e.message)}</p></div></div>`;
  }
  if (my === token) { view.replaceChildren(box); window.scrollTo(0, 0); }
}

async function boot(justLoggedIn = false) {
  try {
    me = await api('/me');
  } catch { return renderLogin(); }
  // Password benar tapi sesi tidak terbaca = browser menolak cookie (jendela
  // pratinjau/iframe, cookie diblokir, atau alamat berbeda). Jangan diam saja.
  if (!me.user) {
    return renderLogin(justLoggedIn
      ? 'Password benar, tetapi browser memblokir cookie dan penyimpanan sesi. Buka http://localhost:8095 di tab Chrome biasa (bukan pratinjau/iframe) dan izinkan cookie/situs untuk localhost.'
      : '');
  }
  if (!me.configured) {
    rootEl.replaceChildren(h('<div class="login-wrap"><div class="login"><div class="card"><h1>Belum dikonfigurasi</h1><p>Isi <b>SUPABASE_SERVICE_KEY</b> di <code>web/.env</code> lalu <code>docker compose up -d</code>. Lihat docs/PANEL-ADMIN.md.</p></div></div></div>'));
    return;
  }
  try { schema = await api('/schema'); } catch (e) { toast(e.message, true); }
  renderShell();
  await route();
}

window.addEventListener('hashchange', route);
window.addEventListener('admin:unauth', () => renderLogin('Sesi berakhir, silakan masuk lagi.'));
boot();
