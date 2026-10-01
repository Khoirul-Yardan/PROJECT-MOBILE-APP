import { h, icon } from './ui.js';
import { navigate } from './router.js';

// The bottom nav lives here, not in Flutter — the native shell is just a
// WebView + a bridge for the things that must stay native (credentials,
// VPN connection, Bot BPJS's mic). That means this same nav renders
// identically whether the page is opened in a plain desktop browser (for
// fast iteration without a device) or inside the app's WebView.
export function mountNavigation() {
  const items = [
    ['/home', 'home', 'Home'], ['/chat', 'chat', 'Chat'],
    ['/bots', 'bot', 'Bot'], ['/vpn', 'shield', 'VPN'],
    ['/settings', 'more', 'More'],
  ];
  const nav = h(`<nav class="web-nav" aria-label="Navigasi utama" hidden></nav>`);
  for (const [path, mark, label] of items) {
    const button = h(`<button type="button" data-path="${path}">${icon(mark)}<span>${label}</span></button>`);
    button.onclick = () => navigate(path);
    nav.appendChild(button);
  }
  document.body.appendChild(nav);
  function sync() {
    const path = (location.hash || '#/home').slice(1).split('?')[0];
    nav.hidden = path === '/login';
    document.body.classList.toggle('has-web-nav', !nav.hidden);
    const selected = path.startsWith('/settings') ? '/settings' : path.startsWith('/vpn') ? '/vpn' : path;
    nav.querySelectorAll('button').forEach((button) => {
      if (button.dataset.path === selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange', sync);
  sync();
}
