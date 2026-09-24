import { route, start, navigate } from './router.js';
import { sb } from './db.js';
import { Native } from './bridge.js';

import login from './views/login.js';
import home from './views/home.js';
import chat from './views/chat.js';
import bots from './views/bots.js';
import friends from './views/friends.js';
import vpn from './views/vpn.js';
import vpnConfig from './views/vpn-config.js';
import settings from './views/settings.js';
import profile from './views/profile.js';
import apikeys from './views/apikeys.js';
import activity from './views/activity.js';

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
route('/friends', guard(friends));
route('/vpn', guard(vpn));
route('/vpn-config', guard(vpnConfig));
route('/settings', guard(settings));
route('/settings/profile', guard(profile));
route('/settings/apikeys', guard(apikeys));
route('/settings/activity', guard(activity));

const root = document.getElementById('app');
start(root, '/home');

// Let the native shell keep its bottom-nav highlight in sync with whatever
// route the web SPA is showing (e.g. tapping a card here that navigates,
// not just tapping the native tab bar).
window.addEventListener('hashchange', () => {
  Native.notifyRoute((location.hash || '#/home').slice(1));
});

// Re-render on sign-in/out so the guard above redirects appropriately, and
// mirror the session into native (see Native.notifySession's doc comment).
sb.auth.onAuthStateChange((_event, session) => {
  const path = (location.hash || '#/home').slice(1);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  Native.notifyRoute(path);
  if (session?.refresh_token) Native.notifySession(session.refresh_token);
});
