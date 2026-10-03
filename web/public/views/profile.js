import { h, header, initial, escapeHtml } from '../ui.js';
import { currentUser, signOut } from '../db.js';
import { confirmLeaveChat } from '../chat-state.js';
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
        <div class="avatar profile-avatar" style="margin:0 auto 14px;">${escapeHtml(initial(user?.email))}</div>
        <div class="item-title">${escapeHtml(user?.email ?? '')}</div>
      </div>
      <p class="muted small">Ganti akun akan mengeluarkan Anda terlebih dahulu.</p><p id="error" class="error-text" role="alert"></p>
      <button id="switch" class="btn btn-outline" style="margin-top:16px;">Ganti akun</button>
      <button id="logout" class="btn btn-danger-outline" style="margin-top:10px;">Keluar</button>
    </div>
  `)
  );
  root.appendChild(el);

  async function endSession() {
    if (!confirmLeaveChat()) return;
    el.querySelectorAll('button').forEach(b => b.disabled = true);
    try { await signOut(); navigate('/login'); }
    catch { el.querySelector('#error').textContent = 'Belum berhasil keluar. Coba lagi.'; }
    finally { el.querySelectorAll('button').forEach(b => b.disabled = false); }
  }

  el.querySelector('#switch').onclick = endSession;
  el.querySelector('#logout').onclick = endSession;
}
