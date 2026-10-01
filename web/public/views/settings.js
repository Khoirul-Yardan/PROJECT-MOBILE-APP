import { h, icon } from '../ui.js';
import { currentUser, signOut } from '../db.js';
import { navigate } from '../router.js';

const TILES = [
  { icon: 'users', title: 'Teman', subtitle: 'Perawat & dokter — dibutuhkan untuk kirim dokumentasi Bot BPJS.', go: '/friends' },
  { icon: 'lock', title: 'API &amp; Agent', subtitle: 'Kelola provider dan agent yang terhubung.', go: '/settings/apikeys' },
  { icon: 'shield', title: 'VPN', subtitle: 'Kelola koneksi dan akses aman.', go: '/vpn' },
  { icon: 'document', title: 'Log Aktivitas', subtitle: 'Lihat aktivitas terbaru.', go: '/settings/activity' },
  { icon: 'users', title: 'Profil', subtitle: 'Nama, peran, dan bio.', go: '/settings/profile' },
];

export default async function render(root) {
  const user = await currentUser();
  const el = h(`
    <div class="page settings-page">
      <div class="topbar"><h1>Pengaturan</h1></div>
      <div id="tiles" class="list"></div>
      <p class="muted small" style="margin-top:18px;">${user?.email ?? ''}</p>
      <button id="logout" class="btn btn-danger-outline" style="margin-top:8px;">Keluar</button>
    </div>
  `);
  root.appendChild(el);

  const tilesEl = el.querySelector('#tiles');
  TILES.forEach((t) => {
    const card = h(`
      <button type="button" class="card tappable row">
        <div class="avatar" style="background:var(--surface-sunken);color:var(--ink);font-size:18px;">${icon(t.icon)}</div>
        <div style="flex:1;">
          <div class="item-title">${t.title}</div>
          <div class="muted small">${t.subtitle}</div>
        </div>
        <span aria-hidden="true">›</span>
      </button>
    `);
    card.onclick = () => navigate(t.go);
    tilesEl.appendChild(card);
  });

  el.querySelector('#logout').onclick = async () => {
    await signOut();
    navigate('/login');
  };
}
