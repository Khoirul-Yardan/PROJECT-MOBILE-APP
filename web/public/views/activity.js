import { h, header, escapeHtml } from '../ui.js';
import { fetchActivity, watchActivity } from '../db.js';

const CATEGORIES = ['Semua', 'AI', 'VPN', 'Bots', 'System'];

export default async function render(root) {
  let cat = 'Semua';
  let rows = [];

  const el = h(`<div class="page activity-page"></div>`);
  el.appendChild(header('Aktivitas', { back: true }));
  const tabsEl = h('<div class="tabs"></div>');
  CATEGORIES.forEach((c) => {
    const btn = h(`<button class="tab ${c === 'Semua' ? 'active' : ''}">${c}</button>`);
    btn.onclick = () => {
      cat = c;
      tabsEl.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
      renderList();
    };
    tabsEl.appendChild(btn);
  });
  el.appendChild(tabsEl);
  const listEl = h('<div class="list"></div>');
  el.appendChild(listEl);
  root.appendChild(el);

  function renderList() {
    const visible = cat === 'Semua' ? rows : rows.filter((r) => r.category === cat);
    listEl.innerHTML = '';
    if (visible.length === 0) {
      listEl.appendChild(h('<div class="empty-state">Belum ada aktivitas.</div>'));
      return;
    }
    visible.forEach((r) => {
      const color = r.badge === 'Success' ? 'var(--success)' : r.badge === 'Error' ? 'var(--danger)' : 'var(--accent-blue)';
      listEl.appendChild(
        h(`
        <div class="card">
          <div class="row-between activity-meta">
            <span class="pill" style="color:${color};">${escapeHtml(r.category)}</span>
            <span class="muted small">${new Date(r.created_at).toLocaleString()}</span>
          </div>
          <h3 style="margin-top:8px;">${escapeHtml(r.category === 'Bots' ? 'Aktivitas dokumentasi BPJS' : r.title)}</h3>
          ${r.subtitle && r.category !== 'Bots' ? `<p>${escapeHtml(r.subtitle)}</p>` : ''}
        </div>
      `)
      );
    });
  }

  async function load() {
    listEl.textContent = 'Memuat aktivitas…';
    try { rows = await fetchActivity(); renderList(); }
    catch { listEl.replaceChildren(h('<p role="alert">Aktivitas belum dapat dimuat.</p>')); const retry = h('<button class="btn-text">Coba lagi</button>'); retry.onclick = load; listEl.appendChild(retry); }
  }
  await load();
  const unwatch = watchActivity(load);
  return { dispose: unwatch };
}
