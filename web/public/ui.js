// Tiny render/DOM helpers shared by every view — no framework, just enough
// sugar to keep the view files readable.

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function header(title, { back = false } = {}) {
  const el = h(`
    <div class="topbar">
      ${back ? '<button class="btn-text" id="back-btn" style="font-size:20px;padding:0 8px 0 0;">←</button>' : ''}
      <h1 style="flex:1">${title}</h1>
    </div>
  `);
  if (back) el.querySelector('#back-btn').onclick = () => history.back();
  return el;
}

let toastTimer;
export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h(`<div id="toast" style="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);
      background:#23262b;color:#fffcf6;padding:10px 18px;border-radius:3px;font-size:12px;
      z-index:999;opacity:0;transition:opacity .2s;border:1px solid #ad4426;"></div>`);
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.style.opacity = '0'), 2600);
}

export function initial(name) {
  return name && name.length ? name[0].toUpperCase() : '?';
}

/**
 * The AI Hub mark — a compass/waypoint stamp, not another gradient
 * blob. Flat ink lines with a single rust accent needle; reads clearly
 * at 20px (nav icon) and 96px (splash) without a gradient defs block.
 * Mirrors the native splash screen mark in app/lib — see theme.dart.
 */
export function logoSvg(size = 44) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="41" stroke="#23262b" stroke-width="5.5" />
      <circle cx="50" cy="50" r="41" stroke="#23262b" stroke-width="1" stroke-dasharray="1 7.2" stroke-linecap="round" opacity=".55" />
      <path d="M50 22 L61 50 L50 78 L39 50 Z" fill="#ad4426" />
      <path d="M50 22 L61 50 L50 50 Z" fill="#23262b" />
      <circle cx="50" cy="50" r="5" fill="#fffcf6" stroke="#23262b" stroke-width="3.5" />
    </svg>
  `;
}
