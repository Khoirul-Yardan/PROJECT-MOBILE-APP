// Minimal hash router — no build step needed, so this container stays a
// plain static site nginx can serve as-is. Flutter's native bottom nav
// drives this by running `location.hash = '#/chat'` etc. inside the WebView.
const routes = new Map();
let current = null;

export function route(path, render) {
  routes.set(path, render);
}

export async function start(root, fallback = '/home') {
  window.addEventListener('hashchange', () => render(root, fallback));
  render(root, fallback);
}

async function render(root, fallback) {
  const path = (location.hash || `#${fallback}`).slice(1).split('?')[0];
  const view = routes.get(path) ?? routes.get(fallback);
  if (current?.dispose) {
    try {
      current.dispose();
    } catch (e) {
      console.error('[router] dispose failed for previous view', e);
    }
  }
  root.innerHTML = '';
  try {
    current = (await view?.(root)) ?? null;
  } catch (e) {
    console.error('[router] view failed to render', path, e);
    current = null;
    root.innerHTML = `
      <div class="empty-state">
        Something went wrong loading this screen.<br/>
        <button class="btn btn-outline" style="margin-top:12px;" onclick="location.reload()">Reload</button>
      </div>
    `;
  }
}

export function navigate(path) {
  location.hash = `#${path}`;
}
