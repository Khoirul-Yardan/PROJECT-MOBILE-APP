import { api, esc, h, pageHead, icon, toast } from '../lib.js';

const dot = (ok) => `<span class="pill ${ok ? 'ok' : 'bad'}">${ok ? 'OK' : 'Bermasalah'}</span>`;
const sub = (x) => `<p class="muted small mono" style="margin:8px 0 0">${esc(x.ok ? `${x.ms} ms` : x.error || `HTTP ${x.status}`)}</p>`;

export default async function system(root) {
  root.append(pageHead('Sistem', 'Status & Setup', 'Kesehatan komponen, tabel yang dibutuhkan panel, dan SQL migrasi sekali jalan.',
    `<button class="btn" id="reload">${icon('refresh')} Periksa ulang</button>`));
  const body = h('<div><div class="empty">Memeriksa…</div></div>');
  root.append(body);

  async function load() {
    const s = await api('/status');
    const up = `${Math.floor(s.uptimeSec / 3600)}j ${Math.floor((s.uptimeSec % 3600) / 60)}m`;
    body.innerHTML = `
      <div class="grid stats">
        <div class="stat"><span class="eyebrow">Supabase</span><div style="margin-top:8px">${dot(s.supabase.ok)}</div>${sub(s.supabase)}</div>
        <div class="stat"><span class="eyebrow">Web (SPA :8090)</span><div style="margin-top:8px">${dot(s.web.ok)}</div>${sub(s.web)}</div>
        <div class="stat"><span class="eyebrow">Relay</span><div style="margin-top:8px">${dot(s.relay.ok)}</div>${sub(s.relay)}</div>
        <div class="stat"><span class="eyebrow">Server admin</span><div class="num" style="font-size:20px">${esc(up)}</div><p class="muted small mono" style="margin:4px 0 0">Node ${esc(s.node)}</p></div>
      </div>
      <div class="card" style="margin-top:20px"><h3>Tabel panel admin</h3>
        <p class="muted small">Tabel pendukung pengumuman, maintenance, dan audit admin. Status ini memeriksa ketersediaan tabel tanpa menampilkan isinya.</p>
        <table><tbody>${Object.entries(s.tables).map(([t, ok]) => `<tr><td class="mono">${esc(t)}</td><td style="text-align:right">${ok ? '<span class="pill ok">ada</span>' : '<span class="pill bad">belum ada</span>'}</td></tr>`).join('')}</tbody></table>
        ${s.setupDone ? '<p class="small" style="margin-bottom:0">✓ Setup lengkap.</p>' : '<div class="notice" style="margin:16px 0 0"><div><b>Setup belum lengkap</b><p>Salin SQL di bawah, tempel di Supabase → SQL Editor → Run. Cukup sekali; aman diulang.</p></div></div>'}
      </div>
      <div class="card"><div class="actions" style="justify-content:space-between"><h3>schema-admin.sql</h3><button class="btn btn-sm" id="copy">Salin SQL</button></div>
        <pre class="sql" id="sql">Memuat…</pre></div>`;
    api('/setup-sql').then((r) => {
      body.querySelector('#sql').textContent = r.sql;
      body.querySelector('#copy').onclick = async () => {
        try { await navigator.clipboard.writeText(r.sql); toast('SQL disalin'); } catch { toast('Gagal menyalin — blok manual lalu Ctrl+C', true); }
      };
    }).catch((e) => { body.querySelector('#sql').textContent = e.message; });
  }
  root.querySelector('#reload').onclick = () => load().catch((e) => toast(e.message, true));
  try { await load(); } catch (e) { body.innerHTML = `<div class="notice bad"><div><b>Gagal</b><p>${esc(e.message)}</p></div></div>`; }
}
