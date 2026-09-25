// Minimal hash router — no build step needed, so this container stays a
// plain static site nginx can serve as-is. Flutter's native bottom nav
// drives this by running `location.hash = '#/chat'` etc. inside the WebView.
const routes = new Map();
let current = null;

// Supabase's onAuthStateChange can fire more than once in quick succession
// during startup (e.g. an INITIAL_SESSION event followed by a SIGNED_IN
// event), and app.js re-dispatches `hashchange` on every one of them. Two
// overlapping async render() calls would otherwise both leave their output
// in the live #app root — visible as duplicated page content stacked
// vertically. Each view mounts into a detached, off-DOM container instead
// of `root` directly; only the render call that's still current by the
// time its view finishes loading gets to swap its container into `root`.
let renderToken = 0;

export function route(path, render) {
  routes.set(path, render);
}

export async function start(root, fallback = '/home') {
  window.addEventListener('hashchange', () => render(root, fallback));
  render(root, fallback);
}

async function render(root, fallback) {
  const myToken = ++renderToken;
  const path = (location.hash || `#${fallback}`).slice(1).split('?')[0];
  const view = routes.get(path) ?? routes.get(fallback);

  // Views call container.appendChild(...) themselves, so give each render
  // attempt its own detached container — concurrent attempts can never
  // stomp on the same live DOM node while they're both mid-flight.
  const container = document.createElement('div');
  let result = null;
  let failed = false;
  try {
    result = (await view?.(container)) ?? null;
  } catch (e) {
    console.error('[router] view failed to render', path, e);
    failed = true;
  }

  // A newer render started (and possibly already finished) while this one
  // was awaiting its view — that render owns `root` now. Discard this
  // stale attempt instead of disposing or touching the live DOM.
  if (myToken !== renderToken) {
    try {
      result?.dispose?.();
    } catch {
      /* the view's container was never attached; nothing to clean up */
    }
    return;
  }

  if (current?.dispose) {
    try {
      current.dispose();
    } catch (e) {
      console.error('[router] dispose failed for previous view', e);
    }
  }

  if (failed) {
    current = null;
    root.replaceChildren();
    root.innerHTML = `
      <div class="empty-state">
        Halaman ini gagal dimuat.<br/>
        <button class="btn btn-outline" style="margin-top:12px;" onclick="location.reload()">Muat ulang</button>
      </div>
    `;
    return;
  }

  current = result;
  root.replaceChildren(...container.childNodes);
}

export function navigate(path) {
  location.hash = `#${path}`;
}
