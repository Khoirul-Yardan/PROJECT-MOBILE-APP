import { route, start, navigate } from './router.js';
import { sb } from './db.js';
import { Native } from './bridge.js';
import { mountNavigation } from './navigation.js';
import { mountMobileViewport } from './mobile.js';
import { finishOAuthReturn } from './oauth.js';
import { toast } from './ui.js';

import login from './views/login.js';
import home from './views/home.js';
import chat from './views/chat.js';
import historyView from './views/history.js';
import bots from './views/bots.js';
import vpn from './views/vpn.js';
import vpnConfig from './views/vpn-config.js';
import terminal from './views/terminal.js';
import settings from './views/settings.js';
import profile from './views/profile.js';
import apikeys from './views/apikeys.js';
import addApiKey from './views/add-api-key.js';
import activity from './views/activity.js';
import bpjsReview from './views/bpjs-review.js';
import papanKomunikasi, { patientView } from './views/papan-komunikasi.js';

const PUBLIC_ROUTES = new Set(['/login']);

function guard(render) {
  return async (root) => {
    const { data } = await sb.auth.getSession();
    const path = (location.hash || '#/home').slice(1).split('?')[0];
    const loggedIn = !!data.session;
    if (!loggedIn && !PUBLIC_ROUTES.has(path)) {
      navigate('/login');
      return null;
    }
    if (loggedIn && PUBLIC_ROUTES.has(path)) {
      navigate('/home');
      return null;
    }
    return render(root);
  };
}

route('/login', guard(login));
route('/home', guard(home));
route('/chat', guard(chat));
route('/history', guard(historyView));
route('/bots', guard(bots));
route('/vpn', guard(vpn));
route('/vpn-config', guard(vpnConfig));
route('/terminal', guard(terminal));
route('/settings', guard(settings));
route('/settings/profile', guard(profile));
route('/settings/apikeys', guard(apikeys));
route('/settings/add-api-key', guard(addApiKey));
route('/settings/activity', guard(activity));
route('/bpjs', guard(bpjsReview));
route('/papan-komunikasi', guard(papanKomunikasi));
// Tautan pasien/keluarga: sengaja tanpa guard (tanpa login).
route('/p', patientView);

const root = document.getElementById('app');
mountNavigation();
mountMobileViewport();
start(root, '/home');

// Back from an OAuth provider login (see oauth.js): exchange the code for a
// key once the Supabase session is available, then tell the user the result.
finishOAuthReturn().then((r) => {
  if (!r) return;
  toast(r.error ? `Login akun gagal: ${r.error}` : `${r.label} terhubung lewat login akun.`);
});

// Re-render on sign-in/out so the guard above redirects appropriately, and
// mirror the session into native (see Native.notifySession's doc comment —
// it's how the native-only Bot BPJS screen still gets an authenticated
// Supabase client for its activity_log writes, without a second login UI).
//
// Only re-render when the signed-in USER actually changes (login, logout,
// first session load). supabase-js also emits SIGNED_IN/TOKEN_REFRESHED every
// time the page regains focus — e.g. coming back from the native file picker
// or any other Android activity — and re-rendering on those wiped whatever
// form the user was in the middle of (the picked .ovpn vanished).
let lastUserId; // undefined until the first auth event arrives
sb.auth.onAuthStateChange((_event, session) => {
  const uid = session?.user?.id ?? null;
  if (uid !== lastUserId) {
    lastUserId = uid;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  if (session?.refresh_token) Native.notifySession(session.refresh_token);
});
