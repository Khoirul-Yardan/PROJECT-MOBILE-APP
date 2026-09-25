import { h } from '../ui.js';
import { currentUser, signOut } from '../db.js';
import { Native } from '../bridge.js';
import { navigate } from '../router.js';

const TILES = [
  { icon: '&#9633;', title: 'Profil', subtitle: 'Atur nama tampilan, peran, dan bio.', go: '/settings/profile' },
  { icon: '&#9679;', title: 'Kunci API Penyedia AI', subtitle: 'Kelola kunci API penyedia AI-mu.', go: '/settings/apikeys' },
  { icon: '&#9670;', title: 'Teman', subtitle: 'Cari orang dan kelola permintaan pertemanan.', go: '/friends' },
  { icon: '&#9673;', title: 'Kredensial VPN', subtitle: 'Perbarui detail login VPN-mu.', go: '/vpn-config' },
  { icon: '&#9635;', title: 'Log Aktivitas', subtitle: 'Lihat aktivitas terbaru.', go: '/settings/activity' },
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
        <div class="avatar" style="background:var(--surface-sunken);color:var(--ink);font-size:18px;">${t.icon}</div>
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
    await Native.signOut();
    navigate('/login');
  };
}
