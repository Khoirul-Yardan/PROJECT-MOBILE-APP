import { h, icon } from '../ui.js';
import { currentUser } from '../db.js';
import { navigate } from '../router.js';

const TILES = [
  { icon: 'lock', title: 'API &amp; Agent', subtitle: 'Kelola provider dan agent yang terhubung.', go: '/settings/apikeys' },
  { icon: 'shield', title: 'VPN', subtitle: 'Kelola koneksi dan akses aman.', go: '/vpn' },
  { icon: 'document', title: 'Log Aktivitas', subtitle: 'Lihat aktivitas terbaru.', go: '/settings/activity' },
  { icon: 'users', title: 'Akun', subtitle: 'Ganti akun atau keluar.', go: '/settings/profile' },
];

export default async function render(root) {
  const user = await currentUser();
  const el = h(`
    <div class="page settings-page">
      <div class="topbar"><h1>Pengaturan</h1></div>
      <div id="tiles" class="list"></div>
      <p class="muted small" style="margin-top:18px;">${user?.email ?? ''}</p>
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
}
