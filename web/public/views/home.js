import { h, icon, escapeHtml, initial } from '../ui.js';
import { currentUser, fetchActivity, watchActivity } from '../db.js';
import { listRegisteredProviders } from '../ai.js';
import { Native } from '../bridge.js';
import { navigate } from '../router.js';

export default async function render(root) {
  const user = await currentUser();
  const el = h(`<div class="page home-page">
    <div class="topbar"><h1>Beranda</h1><button class="avatar" data-go="/settings/profile" aria-label="Buka akun">${escapeHtml(initial(user?.email))}</button></div>
    <section class="card task-panel"><h2>Mulai bekerja</h2><p>Buka percakapan atau siapkan dokumentasi Anda.</p>
      <button class="btn btn-primary" data-go="/chat">${icon('chat')} Buka Chat</button>
      <button class="list-row" data-go="/bots">${icon('document')}<span class="grow"><strong>Dokumentasi Bot BPJS</strong><span class="muted small">Rekam, periksa draf, lalu ekspor</span></span><span aria-hidden="true">›</span></button>
    </section>
    <section aria-label="Status layanan" class="group-list">
      <button class="list-row" data-go="/settings/apikeys">${icon('layers')}<span class="grow"><strong>Provider &amp; Agent</strong><span id="provider-count" class="muted small">Memuat layanan…</span></span><span>Kelola</span></button>
      <button class="list-row" data-go="/vpn">${icon('shield')}<span class="grow"><strong>VPN</strong><span id="vpn-status" class="muted small">Memeriksa status…</span></span><span>Lihat</span></button>
    </section>
    <div class="row-between"><h2 class="section-title">Aktivitas terbaru</h2><button class="btn-text" data-go="/settings/activity">Lihat semua</button></div>
    <div id="recent-activity" aria-live="polite"></div>
  </div>`);
  root.appendChild(el);
  el.querySelectorAll('[data-go]').forEach(b => b.onclick = () => navigate(b.dataset.go));
  let disposed = false;
  async function loadProviders() {
    try {
      const rows = await listRegisteredProviders();
      el.querySelector('#provider-count').textContent = rows.length ? `${rows.length} layanan tersimpan` : 'Tambahkan provider untuk mulai chat';
    } catch { el.querySelector('#provider-count').textContent = 'Layanan belum dapat dimuat. Buka Kelola untuk mencoba lagi.'; }
  }
  function vpnStatus(payload) {
    el.querySelector('#vpn-status').textContent = !Native.attached ? 'Tersedia di aplikasi mobile' : typeof payload?.connected === 'boolean' ? (payload.connected ? 'Terhubung' : 'Tidak terhubung') : 'Status belum diketahui';
  }
  async function refreshActivity() {
    const list = el.querySelector('#recent-activity');
    list.textContent = 'Memuat aktivitas…';
    try {
      const rows = await fetchActivity();
      if (disposed) return;
      list.replaceChildren();
      if (!rows.length) list.appendChild(h('<p class="empty-state">Belum ada aktivitas.</p>'));
      for (const row of rows.slice(0, 3)) list.appendChild(h(`<div class="row activity-row">${icon(row.category === 'VPN' ? 'shield' : 'document')}<div class="grow"><strong>${escapeHtml(row.category === 'Bots' ? 'Aktivitas dokumentasi BPJS' : row.title)}</strong><time>${escapeHtml(new Date(row.created_at).toLocaleString('id-ID'))}</time></div></div>`));
    } catch {
      list.replaceChildren(h('<p role="alert">Aktivitas belum dapat dimuat.</p>'));
      const retry = h('<button class="btn-text">Coba lagi</button>');
      retry.onclick = refreshActivity; list.appendChild(retry);
    }
  }
  loadProviders();
  Native.getVpnStatus().then(vpnStatus);
  refreshActivity();
  const unwatch = watchActivity(refreshActivity);
  const unvpn = Native.on('vpn_status', vpnStatus);
  return { dispose() { disposed = true; unwatch(); unvpn(); } };
}
