import { h, header } from '../ui.js';
import { fetchActivity, watchActivity } from '../db.js';

const CATEGORIES = ['All', 'AI', 'Agents', 'VPN', 'Friends', 'System'];

export default async function render(root) {
  let cat = 'All';
  let rows = [];

  const el = h(`<div class="page activity-page"></div>`);
  el.appendChild(header('Activity Log', { back: true }));
  const tabsEl = h('<div class="tabs"></div>');
  CATEGORIES.forEach((c) => {
    const btn = h(`<button class="tab ${c === 'All' ? 'active' : ''}">${c}</button>`);
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
    const visible = cat === 'All' ? rows : rows.filter((r) => r.category === cat);
    listEl.innerHTML = '';
    if (visible.length === 0) {
      listEl.appendChild(h('<div class="empty-state">No activity yet.</div>'));
      return;
    }
    visible.forEach((r) => {
      const color = r.badge === 'Success' ? 'var(--success)' : r.badge === 'Error' ? 'var(--danger)' : 'var(--accent-blue)';
      listEl.appendChild(
        h(`
        <div class="card">
          <div class="row-between activity-meta">
            <span class="pill" style="color:${color};">${r.category}</span>
            <span class="muted small">${new Date(r.created_at).toLocaleString()}</span>
          </div>
          <h3 style="margin-top:8px;">${r.title}</h3>
          ${r.subtitle ? `<p>${r.subtitle}</p>` : ''}
        </div>
      `)
      );
    });
  }

  rows = await fetchActivity();
  renderList();
  const unwatch = watchActivity(async () => {
    rows = await fetchActivity();
    renderList();
  });

  return { dispose: unwatch };
}
