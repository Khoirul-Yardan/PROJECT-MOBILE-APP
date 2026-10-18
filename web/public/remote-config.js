// Konfigurasi jarak jauh dari Panel Admin (admin/): maintenance, pengumuman,
// bot tambahan, provider tambahan. Semuanya dibaca lewat RLS (hanya SELECT),
// jadi perubahan admin langsung berlaku tanpa rilis ulang APK/web.
//
// Prinsip: tidak boleh pernah merusak aplikasi. Tabel belum dibuat, jaringan
// putus, atau data aneh -> diam-diam diabaikan dan aplikasi jalan seperti biasa.

import { sb } from './db.js';
import { KNOWN_PROVIDERS } from './providers.js';
import { escapeHtml } from './ui.js';

const DISMISS_KEY = 'aihub.dismissedNotices';
const state = { maintenance: null, announcements: [], bots: [] };

function dismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')); } catch { return new Set(); }
}
function dismiss(id) {
  try {
    const s = dismissed(); s.add(id);
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...s].slice(-50)));
  } catch { /* penyimpanan diblokir: banner muncul lagi, tidak fatal */ }
}

export const getRemoteBots = () => state.bots;

/** Maintenance yang sedang memblokir pemakaian? */
export function activeMaintenance(now = Date.now()) {
  const m = state.maintenance;
  if (!m?.enabled) return null;
  const s = m.starts_at ? Date.parse(m.starts_at) : 0;
  const e = m.ends_at ? Date.parse(m.ends_at) : Infinity;
  return now >= s && now < e ? m : null;
}

// ---- pengambilan data --------------------------------------------------------
async function fetchAll() {
  const [m, a, b, p] = await Promise.allSettled([
    sb.from('app_settings').select('value').eq('key', 'maintenance').maybeSingle(),
    sb.from('announcements').select('id,title,body,kind,starts_at,ends_at').eq('active', true).order('starts_at', { ascending: false }).limit(20),
    sb.from('remote_bots').select('slug,title,subtitle,icon,kind,target,sort_order').eq('active', true).order('sort_order'),
    sb.from('remote_providers').select('slug,label,vendor,type,format,endpoint,model,key_pattern,icon').eq('active', true),
  ]);
  const ok = (r) => (r.status === 'fulfilled' && !r.value.error ? r.value.data : null);
  state.maintenance = ok(m)?.value ?? null;
  state.announcements = ok(a) ?? [];
  state.bots = ok(b) ?? [];
  mergeProviders(ok(p) ?? []);
}

// Provider tambahan masuk ke katalog yang sama dengan bawaan, jadi deteksi key
// dan daftar provider tidak perlu tahu asalnya. Entri bawaan menang bila id sama.
function mergeProviders(rows) {
  for (const r of rows) {
    if (KNOWN_PROVIDERS.some((p) => p.id === r.slug)) continue;
    let pattern = /^$/; // tanpa pola = tidak pernah cocok otomatis, dipilih manual
    if (r.key_pattern) { try { pattern = new RegExp(r.key_pattern); } catch { /* regex rusak: abaikan pola */ } }
    if (!/^https?:\/\//.test(r.endpoint)) continue;
    KNOWN_PROVIDERS.push({
      id: r.slug, label: r.label, vendor: r.vendor || r.label, type: r.type, format: r.format,
      endpoint: r.endpoint, model: r.model || '', keyPattern: pattern, icon: r.icon || 'spark', remote: true,
    });
  }
}

// ---- tampilan ----------------------------------------------------------------
function ensureStyle() {
  if (document.getElementById('remote-config-style')) return;
  const st = document.createElement('style');
  st.id = 'remote-config-style';
  st.textContent = `
    #notice-stack { position:fixed; z-index:900; left:0; right:0; top:0; display:flex; flex-direction:column; gap:8px; padding:10px 12px; pointer-events:none; }
    .notice-bar { pointer-events:auto; max-width:656px; width:100%; margin:0 auto; display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border:1px solid var(--line-strong); border-radius:12px; background:var(--sky); box-shadow:var(--shadow); font-size:13px; }
    .notice-bar.kind-warning { background:var(--butter); } .notice-bar.kind-success { background:var(--ok-tint); }
    .notice-bar.kind-maintenance { background:var(--warn-tint); }
    .notice-bar b { display:block; font-size:13px; } .notice-bar p { margin:2px 0 0; color:var(--ink-muted); white-space:pre-wrap; }
    .notice-bar button { flex-shrink:0; min-width:32px; min-height:32px; font-size:18px; line-height:1; }
    #maintenance-overlay { position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center; padding:24px; background:var(--bg); text-align:center; }
    #maintenance-overlay .box { max-width:420px; padding:28px; border:1.5px solid var(--line-strong); border-radius:var(--radius); background:var(--butter); box-shadow:var(--shadow); }
    #maintenance-overlay h2 { margin:6px 0 10px; font-size:22px; } #maintenance-overlay p { margin:0 0 14px; white-space:pre-wrap; }
    #maintenance-overlay .until { font-weight:700; }
  `;
  document.head.appendChild(st);
}

const fmt = (iso) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
// Tautan pasien/keluarga (#/p) memanggil bantuan: jangan pernah diblokir maintenance.
const onPatientLink = () => /^#\/p(\?|$)/.test(location.hash);

function render() {
  ensureStyle();
  const now = Date.now();
  const maint = activeMaintenance(now);
  const seen = dismissed();

  // Overlay maintenance
  let ov = document.getElementById('maintenance-overlay');
  if (maint && maint.block !== false && !onPatientLink()) {
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'maintenance-overlay';
      ov.setAttribute('role', 'alertdialog');
      document.body.appendChild(ov);
    }
    ov.innerHTML = `<div class="box"><span class="eyebrow">AI HUB</span><h2>Sedang dalam pemeliharaan</h2>
      <p>${escapeHtml(maint.message || 'Layanan sementara tidak tersedia.')}</p>
      ${maint.ends_at ? `<p class="until">Perkiraan selesai: ${escapeHtml(fmt(maint.ends_at))}</p>` : ''}
      <button class="btn btn-outline" id="maint-retry">Periksa lagi</button></div>`;
    ov.querySelector('#maint-retry').onclick = refresh;
  } else if (ov) ov.remove();

  // Banner pengumuman (+ pengingat maintenance terjadwal yang belum mulai)
  let stack = document.getElementById('notice-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'notice-stack';
    document.body.appendChild(stack);
  }
  const visible = state.announcements.filter((a) => {
    const s = a.starts_at ? Date.parse(a.starts_at) : 0;
    const e = a.ends_at ? Date.parse(a.ends_at) : Infinity;
    if (now < s || now >= e || seen.has(a.id)) return false;
    // Saat overlay sudah menutup layar, banner maintenance dobel tidak perlu.
    return !(maint && maint.block !== false && a.kind === 'maintenance' && !onPatientLink());
  });
  const m = state.maintenance;
  const upcoming = m?.enabled && m.starts_at && Date.parse(m.starts_at) > now && !visible.some((a) => a.kind === 'maintenance');
  stack.innerHTML = '';
  if (upcoming) {
    const bar = document.createElement('div');
    bar.className = 'notice-bar kind-maintenance';
    bar.innerHTML = `<div style="flex:1"><b>Pemeliharaan terjadwal</b><p>${escapeHtml(m.message)}\nMulai ${escapeHtml(fmt(m.starts_at))}${m.ends_at ? `, selesai ${escapeHtml(fmt(m.ends_at))}` : ''}.</p></div>`;
    stack.appendChild(bar);
  }
  visible.slice(0, 3).forEach((a) => {
    const bar = document.createElement('div');
    const kind = ['info', 'success', 'warning', 'maintenance'].includes(a.kind) ? a.kind : 'info';
    bar.className = `notice-bar kind-${kind}`;
    bar.setAttribute('role', 'status');
    bar.innerHTML = `<div style="flex:1"><b>${escapeHtml(a.title)}</b>${a.body ? `<p>${escapeHtml(a.body)}</p>` : ''}</div>
      <button type="button" aria-label="Tutup">×</button>`;
    bar.querySelector('button').onclick = () => { dismiss(a.id); render(); };
    stack.appendChild(bar);
  });
}

async function refresh() {
  try { await fetchAll(); } catch { /* tetap pakai data terakhir */ }
  render();
}

let started = false;
/** Dipanggil sekali dari app.js. */
export async function initRemoteConfig() {
  if (started) return;
  started = true;
  await refresh();
  // Realtime: pengumuman/maintenance baru muncul tanpa muat ulang.
  try {
    sb.channel(`remote-config-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, refresh)
      .subscribe();
  } catch { /* realtime opsional; timer di bawah tetap menyegarkan */ }
  setInterval(render, 30000); // jendela waktu bergeser (mulai/selesai) tanpa perlu event
  setInterval(refresh, 5 * 60000);
  window.addEventListener('hashchange', render);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}
