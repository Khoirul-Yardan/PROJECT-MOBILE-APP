import { h, header, initial, toast } from '../ui.js';
import {
  currentUser,
  myProfile,
  upsertProfile,
  searchProfiles,
  sendFriendRequest,
  respondFriendRequest,
  fetchFriendships,
  watchFriendships,
} from '../db.js';

export default async function render(root) {
  const user = await currentUser();
  let tab = 0;
  let searchResults = [];
  let unwatch = null;

  const el = h(`<div></div>`);
  el.appendChild(header('Friends', { back: true }));
  const tabsEl = h(`
    <div class="tabs">
      <button class="tab active" data-tab="0">Teman</button>
      <button class="tab" data-tab="1">Permintaan Masuk</button>
      <button class="tab" data-tab="2">Cari Pengguna</button>
    </div>
  `);
  el.appendChild(tabsEl);
  const bodyEl = h('<div></div>');
  el.appendChild(bodyEl);
  root.appendChild(el);

  // Ensure this account is searchable (default display name from email).
  const profile = await myProfile();
  if (!profile) {
    await upsertProfile((user?.email || 'user').split('@')[0]);
  }

  tabsEl.querySelectorAll('.tab').forEach((btn) => {
    btn.onclick = () => {
      tab = Number(btn.dataset.tab);
      tabsEl.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
      renderTab();
    };
  });

  async function renderTab() {
    bodyEl.innerHTML = '<div class="spinner"></div>';
    if (tab === 0) await renderFriendsList();
    else if (tab === 1) await renderRequests();
    else renderSearch();
  }

  async function renderFriendsList() {
    const rows = (await fetchFriendships()).filter((r) => r.status === 'accepted');
    bodyEl.innerHTML = '';
    if (rows.length === 0) {
      bodyEl.appendChild(h('<div class="empty-state">No friends yet — search for a user and send a request.</div>'));
      return;
    }
    const list = h('<div class="list"></div>');
    rows.forEach((r) => {
      const name = r.other_profile?.display_name ?? 'Unknown';
      list.appendChild(
        h(`
        <div class="card row">
          <div class="avatar">${initial(name)}</div>
          <div style="flex:1;">
            <div style="font-weight:600;">${name}</div>
            <div class="small" style="color:var(--success);">Friend</div>
          </div>
        </div>
      `)
      );
    });
    bodyEl.appendChild(list);
  }

  async function renderRequests() {
    const rows = (await fetchFriendships()).filter((r) => r.status === 'pending' && r.is_incoming);
    bodyEl.innerHTML = '';
    if (rows.length === 0) {
      bodyEl.appendChild(h('<div class="empty-state">No incoming requests.</div>'));
      return;
    }
    const list = h('<div class="list"></div>');
    rows.forEach((r) => {
      const name = r.other_profile?.display_name ?? 'Unknown';
      const card = h(`
        <div class="card row">
          <div class="avatar">${initial(name)}</div>
          <div style="flex:1;font-weight:600;">${name}</div>
          <button class="btn-text" style="color:var(--success);font-size:20px;" data-accept>✓</button>
          <button class="btn-text" style="color:var(--danger);font-size:20px;" data-decline>✕</button>
        </div>
      `);
      card.querySelector('[data-accept]').onclick = async () => {
        await respondFriendRequest(r.id, true);
        renderRequests();
      };
      card.querySelector('[data-decline]').onclick = async () => {
        await respondFriendRequest(r.id, false);
        renderRequests();
      };
      list.appendChild(card);
    });
    bodyEl.appendChild(list);
  }

  function renderSearch() {
    bodyEl.innerHTML = '';
    const wrap = h(`
      <div>
        <input id="search" placeholder="Cari nama atau username" />
        <div id="results" class="list" style="margin-top:14px;"></div>
      </div>
    `);
    bodyEl.appendChild(wrap);
    const resultsEl = wrap.querySelector('#results');
    resultsEl.appendChild(h('<div class="empty-state">Type a name above to find other AI Hub users.</div>'));

    let debounce;
    wrap.querySelector('#search').addEventListener('input', (e) => {
      clearTimeout(debounce);
      const q = e.target.value;
      debounce = setTimeout(async () => {
        if (!q.trim()) {
          resultsEl.innerHTML = '<div class="empty-state">Type a name above to find other AI Hub users.</div>';
          return;
        }
        searchResults = await searchProfiles(q);
        resultsEl.innerHTML = '';
        if (searchResults.length === 0) {
          resultsEl.appendChild(h('<div class="empty-state">No users found.</div>'));
          return;
        }
        searchResults.forEach((p) => {
          const card = h(`
            <div class="card row">
              <div class="avatar">${initial(p.display_name)}</div>
              <div style="flex:1;font-weight:600;">${p.display_name}</div>
              <button class="chip">+ Add</button>
            </div>
          `);
          card.querySelector('.chip').onclick = async () => {
            try {
              await sendFriendRequest(p.id);
              toast(`Request sent to ${p.display_name}.`);
            } catch (_) {
              toast('Could not send request (maybe already sent).');
            }
          };
          resultsEl.appendChild(card);
        });
      }, 300);
    });
  }

  unwatch = watchFriendships(() => renderTab());
  await renderTab();

  return { dispose: () => unwatch && unwatch() };
}
