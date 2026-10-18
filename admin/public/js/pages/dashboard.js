import { api, esc, h, pageHead, fmtDate, icon } from '../lib.js';

const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('id-ID'));

export default async function dashboard(root) {
  root.append(pageHead('Ringkasan', 'Dashboard', 'Kondisi sistem sekilas. Angka hanya jumlah; isi percakapan pasien tidak pernah ditampilkan di panel ini.',
    `<button class="btn" id="reload">${icon('refresh')} Muat ulang</button>`));
  const body = h('<div><div class="empty">Memuat…</div></div>');
  root.append(body);

  async function load() {
    const d = await api('/dashboard');
    const c = d.counts;
    const m = d.maintenance;
    const days = Object.entries(d.sessionsPerDay);
    const max = Math.max(1, ...days.map(([, n]) => n));
    const total14 = days.reduce((a, [, n]) => a + n, 0);
    body.innerHTML = `
      ${m.enabled ? `<div class="notice bad"><div><b>Mode maintenance AKTIF</b><p>${esc(m.message)} ${m.ends_at ? `Selesai: ${esc(fmtDate(m.ends_at))}.` : ''} <a href="#/maintenance">Kelola</a></p></div></div>` : ''}
      <div class="grid stats">
        <div class="stat t-mint"><span class="eyebrow">Pengguna</span><div class="num">${fmt(c.users)}</div></div>
        <div class="stat t-butter"><span class="eyebrow">Sesi Bot BPJS</span><div class="num">${fmt(c.sessions)}</div></div>
        <div class="stat t-sky"><span class="eyebrow">Segmen transkrip</span><div class="num">${fmt(c.transcripts)}</div></div>
        <div class="stat t-lilac"><span class="eyebrow">Event Papan Komunikasi</span><div class="num">${fmt(c.komunikasi)}</div></div>
        <div class="stat"><span class="eyebrow">Pesan Chat</span><div class="num">${fmt(c.chats)}</div></div>
        <div class="stat"><span class="eyebrow">Pengumuman aktif</span><div class="num">${fmt(c.announcements)}</div></div>
      </div>
      <div class="grid two" style="margin-top:20px">
        <div class="card"><h3>Sesi Bot BPJS, 14 hari terakhir</h3><p class="muted small" style="margin:0">${total14} sesi dalam periode ini</p>
          <div class="bars">${days.map(([, n]) => `<div class="bar" style="height:${Math.round((n / max) * 100)}%"><span>${n || ''}</span></div>`).join('')}</div>
          <div class="bar-labels">${days.map(([dt]) => `<span>${esc(dt.slice(8))}</span>`).join('')}</div></div>
        <div class="card"><h3>Aktivitas admin terbaru</h3>
          ${d.recentAudit.length ? `<table><tbody>${d.recentAudit.map((a) => `<tr><td class="small">${esc(fmtDate(a.created_at))}</td><td><b>${esc(a.action)}</b> <span class="muted">${esc(a.resource)}</span></td><td class="muted small">${esc(a.admin)}</td></tr>`).join('')}</tbody></table>`
            : '<p class="muted">Belum ada aktivitas tercatat (atau tabel audit belum dibuat — lihat <a href="#/system">Status &amp; Setup</a>).</p>'}</div>
      </div>`;
  }
  root.querySelector('#reload').onclick = () => load().catch((e) => { body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
  try { await load(); } catch (e) { body.innerHTML = `<div class="notice bad"><div><b>Gagal memuat dashboard</b><p>${esc(e.message)}</p></div></div>`; }
}
