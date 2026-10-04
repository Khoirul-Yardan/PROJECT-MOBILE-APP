import { h, header, pageIntro, emptyState, escapeHtml } from '../ui.js';
import { fetchActivity, watchActivity } from '../db.js';

const CATEGORIES = ['All', 'AI', 'VPN', 'System'];

export default async function render(root) {
  let cat = 'All';
  let rows = [];

  const el = h(`<div class="page activity-page"></div>`);
  el.appendChild(header('Log Aktivitas', { back: true }));
  el.appendChild(pageIntro('Jejak produktivitasmu.', 'Lihat kembali aktivitas AI, koneksi, dan pembaruan akun.', { label: 'CATATAN AKTIVITAS', art: 'providers', tone: 'intro-sky' }));
  const tabsEl = h('<div class="tabs"></div>');
  CATEGORIES.forEach((c) => {
    const btn = h(`<button class="tab ${c === 'All' ? 'active' : ''}">${c === 'All' ? 'Semua' : c === 'System' ? 'Sistem' : c}</button>`);
    btn.onclick = () => {
      cat = c;
      tabsEl.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
      renderList();
    };
    tabsEl.appendChild(btn);
  });
  el.appendChild(tabsEl);
  const listEl = h('<div class="list activity-timeline"></div>');
  el.appendChild(listEl);
  root.appendChild(el);

  function renderList() {
    const visible = cat === 'All' ? rows : rows.filter((r) => r.category === cat);
    listEl.innerHTML = '';
    if (visible.length === 0) {
      listEl.appendChild(emptyState('Belum ada cerita di sini.', 'Aktivitasmu akan muncul setelah kamu mulai menggunakan AI Hub.'));
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
          <h3 style="margin-top:8px;">${escapeHtml(r.title)}</h3>
          ${r.subtitle ? `<p>${escapeHtml(r.subtitle)}</p>` : ''}
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
