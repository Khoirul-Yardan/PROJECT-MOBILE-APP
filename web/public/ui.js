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
      ${back ? '<button class="btn-text" id="back-btn" aria-label="Kembali" style="font-size:20px;padding:0 8px 0 0;">←</button>' : ''}
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
    el = h(`<div id="toast" style="position:fixed;left:50%;bottom:calc(24px + var(--nav-space, 0px));transform:translateX(-50%);
      background:#111d42;color:#ffffff;padding:10px 18px;border-radius:12px;font-size:12px;
      z-index:999;opacity:0;transition:opacity .2s;border:1px solid #334d80;"></div>`);
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

// Connected nodes mirror the native HubLogo painter.
export function logoSvg(size = 44) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" role="img" aria-label="AI Hub">
    <path d="M20 48 64 12M20 84 74 42M44 64 76 84" stroke="#0b66c3" stroke-width="5" stroke-linecap="round"/>
    <g stroke="#0a4f97" stroke-width="1.5">
      <circle cx="64" cy="12" r="10" fill="#0b66c3"/><circle cx="20" cy="48" r="10" fill="#0b66c3"/>
      <circle cx="74" cy="42" r="10" fill="#0b66c3"/><circle cx="44" cy="64" r="10" fill="#0b66c3"/>
      <circle cx="20" cy="84" r="10" fill="#0b66c3"/><circle cx="76" cy="84" r="10" fill="#0b66c3"/>
    </g></svg>`;
}

export function escapeHtml(value) {
  const el = document.createElement('span');
  el.textContent = String(value ?? '');
  return el.innerHTML;
}

const ICONS = {
  home: '<path d="m3 10 9-7 9 7v10H15v-7H9v7H3z"/>',
  chat: '<path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z"/><path d="M8 10h8M8 14h5"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  bot: '<rect x="4" y="7" width="16" height="14" rx="4"/><path d="M12 3v4M1 12v4m22-4v4M8 12v2m8-2v2m-7 3h6"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  users: '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 5v2"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  document: '<path d="M14 2H5v20h14V7zM14 2v6h5M8 12h8m-8 4h6"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a3.5 3.5 0 0 0-5-5L4 14z"/>',
  chart: '<path d="M3 3v18h18M7 16v-5m5 5V7m5 9V4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18M7 15h3m4 0h3"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',
  lock: '<rect x="5" y="10" width="14" height="12" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v3"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13"/>',
};
export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.spark}</svg>`;
}
