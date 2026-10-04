import { route, start, navigate } from './router.js';
import { sb } from './db.js';
import { Native } from './bridge.js';
import { mountNavigation } from './navigation.js';
import { mountMobileViewport } from './mobile.js';

import login from './views/login.js';
import home from './views/home.js';
import chat from './views/chat.js';
import bots from './views/bots.js';
import vpn from './views/vpn.js';
import vpnConfig from './views/vpn-config.js';
import settings from './views/settings.js';
import profile from './views/profile.js';
import apikeys from './views/apikeys.js';
import addApiKey from './views/add-api-key.js';
import activity from './views/activity.js';
import bpjsReview from './views/bpjs-review.js';

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
route('/bots', guard(bots));
route('/vpn', guard(vpn));
route('/vpn-config', guard(vpnConfig));
route('/settings', guard(settings));
route('/settings/profile', guard(profile));
route('/settings/apikeys', guard(apikeys));
route('/settings/add-api-key', guard(addApiKey));
route('/settings/activity', guard(activity));
route('/bpjs', guard(bpjsReview));

const root = document.getElementById('app');
mountNavigation();
mountMobileViewport();
start(root, '/home');

// Re-render on sign-in/out so the guard above redirects appropriately, and
// mirror the session into native (see Native.notifySession's doc comment —
// it's how the native-only Bot BPJS screen still gets an authenticated
// Supabase client for its activity_log writes, without a second login UI).
sb.auth.onAuthStateChange((_event, session) => {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  if (session?.refresh_token) Native.notifySession(session.refresh_token);
});
