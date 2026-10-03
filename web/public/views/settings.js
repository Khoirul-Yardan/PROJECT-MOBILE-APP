import { h, icon, escapeHtml } from '../ui.js';
import { currentUser, signOut } from '../db.js';
import { navigate } from '../router.js';
import { confirmLeaveChat } from '../chat-state.js';

export default async function render(root) {
  const user = await currentUser();
  const el = h('<div class="page settings-page"><div class="topbar"><h1>Pengaturan</h1></div></div>');
  const groups = {
    Layanan: [['layers', 'Provider & Agent', 'Konfigurasi layanan AI', '/settings/apikeys'], ['shield', 'VPN', 'Server dan koneksi perangkat', '/vpn']],
    Dokumentasi: [['document', 'Riwayat Bot BPJS', 'Periksa sesi dan salin teks', '/bpjs']],
    Akun: [['users', 'Akun', user?.email ?? '', '/settings/profile'], ['document', 'Aktivitas', 'Riwayat kejadian aplikasi', '/settings/activity']],
  };
  for (const [group, rows] of Object.entries(groups)) {
    el.appendChild(h(`<h2 class="section-title">${group}</h2>`));
    const list = h('<div class="group-list"></div>');
    for (const [mark, title, subtitle, path] of rows) {
      const b = h(`<button class="list-row">${icon(mark)}<span class="grow"><strong>${title}</strong><span class="muted small">${escapeHtml(subtitle)}</span></span><span aria-hidden="true">›</span></button>`);
      b.onclick = () => navigate(path); list.appendChild(b);
    }
    el.appendChild(list);
  }
  const logout = h('<button class="btn btn-outline">Keluar</button>');
  const error = h('<p class="error-text" role="alert"></p>');
  logout.onclick = async () => {
    if (!confirmLeaveChat()) return;
    logout.disabled = true;
    try { await signOut(); navigate('/login'); }
    catch { error.textContent = 'Belum berhasil keluar. Coba lagi.'; }
    finally { logout.disabled = false; }
  };
  el.append(logout, error); root.appendChild(el);
}
