import { h, header, initial } from '../ui.js';
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
  el.appendChild(
    h(`
    <div>
      <div class="card form-panel" style="text-align:center;">
        <div class="avatar profile-avatar" style="margin:0 auto 14px;">${initial(user?.email)}</div>
        <div class="item-title">${user?.email ?? ''}</div>
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
