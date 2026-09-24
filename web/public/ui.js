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
      background:#101d3d;color:#fff;padding:10px 18px;border-radius:20px;font-size:12px;
      z-index:999;opacity:0;transition:opacity .2s;"></div>`);
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

/** The AI Hub hexagon mark — mirrors the native splash screen's logo. */
export function logoSvg(size = 44) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="hubGrad" x1="0" y1="0" x2="100" y2="100">
          <stop offset="0" stop-color="#20d7e5" />
          <stop offset=".5" stop-color="#6588ff" />
          <stop offset="1" stop-color="#c15aff" />
        </linearGradient>
      </defs>
      <polygon points="50,6 89,28 89,72 50,94 11,72 11,28"
        stroke="url(#hubGrad)" stroke-width="5.5" stroke-linejoin="round" />
      <circle cx="50" cy="6" r="5.5" fill="url(#hubGrad)" />
      <circle cx="89" cy="28" r="5.5" fill="url(#hubGrad)" />
      <circle cx="89" cy="72" r="5.5" fill="url(#hubGrad)" />
      <circle cx="50" cy="94" r="5.5" fill="url(#hubGrad)" />
      <circle cx="11" cy="72" r="5.5" fill="url(#hubGrad)" />
      <circle cx="11" cy="28" r="5.5" fill="url(#hubGrad)" />
    </svg>
  `;
}
