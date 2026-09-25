import { h } from '../ui.js';
import { currentUser, signOut } from '../db.js';
import { Native } from '../bridge.js';
import { navigate } from '../router.js';

const TILES = [
  { icon: '👤', title: 'Profile', subtitle: 'Set your display name, role, and bio.', go: '/settings/profile' },
  { icon: '🔑', title: 'AI Provider API Keys', subtitle: 'Manage your AI provider keys.', go: '/settings/apikeys' },
  { icon: '👥', title: 'Friends', subtitle: 'Find people and manage friend requests.', go: '/friends' },
  { icon: '🛡️', title: 'VPN Credentials', subtitle: 'Update your VPN login details.', go: '/vpn-config' },
  { icon: '🕘', title: 'Activity Log', subtitle: 'View recent activity.', go: '/settings/activity' },
];

export default async function render(root) {
  const user = await currentUser();
  const el = h(`
    <div class="page settings-page">
      <div class="topbar"><h1>Settings</h1></div>
      <div id="tiles" class="list"></div>
      <p class="muted small" style="margin-top:18px;">${user?.email ?? ''}</p>
      <button id="logout" class="btn btn-danger-outline" style="margin-top:8px;">Log out</button>
      <p class="center muted small" style="margin-top:20px;letter-spacing:1px;">
        AI HUB · ONE HUB. INFINITE POSSIBILITIES.
      </p>
    </div>
  `);
  root.appendChild(el);

  const tilesEl = el.querySelector('#tiles');
  TILES.forEach((t) => {
    const card = h(`
      <button type="button" class="card tappable row">
        <div class="avatar" style="background:var(--field);color:var(--text-dark);">${t.icon}</div>
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
