import { h, header, initial, escapeHtml, pageIntro } from '../ui.js';
import { currentUser, signOut } from '../db.js';
import { Native } from '../bridge.js';
import { navigate } from '../router.js';

// Kept deliberately minimal: this app has no multi-account switcher, so
// "switch account" and "log out" both just end the current session and
// hand back to Login — from there the user signs into whichever account
// they want next.
export default async function render(root) {
  const user = await currentUser();

  const el = h(`<div class="page profile-page"></div>`);
  el.appendChild(header('Akun', { back: true }));
  el.appendChild(pageIntro('Senang kamu di sini.', 'Satu akun untuk melanjutkan ide dan pekerjaanmu.', { label: 'AKUN PRIBADI', art: 'chat', tone: 'intro-sky' }));
  el.appendChild(
    h(`
    <div>
      <div class="card form-panel account-panel" style="text-align:center;">
        <div class="avatar profile-avatar" style="margin:0 auto 14px;">${escapeHtml(initial(user?.email))}</div>
        <span class="eyebrow">EMAIL AKUN</span>
        <div class="item-title">${escapeHtml(user?.email ?? '')}</div>
        <p class="muted small">Kelola sesi masukmu di bawah ini.</p>
      </div>
      <button id="switch" class="btn btn-outline" style="margin-top:16px;">Ganti Akun</button>
      <button id="logout" class="btn btn-danger-outline" style="margin-top:10px;">Keluar</button>
    </div>
  `)
  );
  root.appendChild(el);

  async function endSession() {
    await signOut();
    await Native.signOut();
    navigate('/login');
  }

  el.querySelector('#switch').onclick = endSession;
  el.querySelector('#logout').onclick = endSession;
}
