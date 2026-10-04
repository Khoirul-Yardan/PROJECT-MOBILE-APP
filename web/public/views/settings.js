import { h, icon, initial, escapeHtml, pageIntro } from '../ui.js';
import { currentUser, signOut } from '../db.js';
import { navigate } from '../router.js';

const TILES = [
  { icon: 'document', title: 'Riwayat Bot BPJS', subtitle: 'Lihat dan ekspor dokumentasi sesi.', go: '/bpjs' },
  { icon: 'lock', title: 'API &amp; Agent', subtitle: 'Kelola asisten yang terhubung.', go: '/settings/apikeys' },
  { icon: 'shield', title: 'VPN', subtitle: 'Kelola koneksi dan akses aman.', go: '/vpn' },
  { icon: 'document', title: 'Log Aktivitas', subtitle: 'Lihat aktivitas terbaru.', go: '/settings/activity' },
  { icon: 'users', title: 'Akun', subtitle: 'Informasi akun dan akses masuk.', go: '/settings/profile' },
];

export default async function render(root) {
  const user = await currentUser();
  const el = h(`
    <div class="page settings-page">
      <div class="topbar"><h1>Pengaturan</h1></div>
      <button class="account-strip" id="account-link"><span class="avatar">${escapeHtml(initial(user?.email))}</span><span class="grow"><strong>Akun pribadimu</strong><span>${escapeHtml(user?.email ?? '')}</span></span><span aria-hidden="true">↗</span></button>
      <h2 class="section-title">Atur sesuai caramu</h2>
      <div id="tiles" class="settings-menu"></div>
      <button id="logout" class="btn btn-danger-outline" style="margin-top:8px;">Keluar</button>
      <p class="app-signature">AI HUB <span>Ruang untuk ide &amp; pekerjaanmu.</span></p>
    </div>
  `);
  root.appendChild(el);
  el.querySelector('.topbar').after(pageIntro('Ruangmu, caramu.', 'Kelola asisten, koneksi, dan akun dalam satu tempat.', { label: 'PERSONALISASI', tone: 'intro-lilac' }));
  el.querySelector('#account-link').onclick = () => navigate('/settings/profile');

  const tilesEl = el.querySelector('#tiles');
  TILES.forEach((t) => {
    const card = h(`
      <button type="button" class="settings-item row">
        <div class="feature-icon">${icon(t.icon)}</div>
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
