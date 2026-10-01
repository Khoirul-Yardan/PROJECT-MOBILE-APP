import { h, icon, toast } from '../ui.js';
import {
  fetchFriendships,
  searchProfiles,
  sendFriendRequest,
  respondToFriendRequest,
  watchFriendships,
  logActivity,
} from '../db.js';

// Friends is the gate for Bot BPJS's doctor picker (see schema.sql: a
// bpjs_sessions row can only target a doctor the nurse has an *accepted*
// friendship with) — so this page has to exist and be reachable even
// though Chat no longer routes through it for AI conversations.
const TABS = ['Teman', 'Permintaan Masuk', 'Cari Orang'];

export default async function render(root) {
  let tab = 0;
  let friendships = [];
  let searchResults = [];
  let searching = false;

  const el = h(`
    <div class="page friends-page">
      <div class="topbar"><h1>Teman</h1></div>
      <p class="muted small">
        Perawat dan dokter saling berteman di sini agar dokumentasi Bot BPJS
        bisa dikirim ke dokter yang tepat.
      </p>
      <div id="tabs" class="tabs"></div>
      <div id="content"></div>
    </div>
  `);
  root.appendChild(el);

  const tabsEl = el.querySelector('#tabs');
  TABS.forEach((label, i) => {
    const btn = h(`<button class="tab ${i === 0 ? 'active' : ''}">${label}</button>`);
    btn.onclick = () => {
      tab = i;
      tabsEl.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
      renderContent();
    };
    tabsEl.appendChild(btn);
  });

  async function load() {
    friendships = await fetchFriendships();
  }

  function renderContent() {
    const contentEl = el.querySelector('#content') || el.appendChild(h('<div id="content"></div>'));
    contentEl.innerHTML = '';
    if (tab === 0) renderFriendsList(contentEl);
    else if (tab === 1) renderIncoming(contentEl);
    else renderSearch(contentEl);
  }

  function attachRight(profile, right) {
    const row = h(`
      <div class="card row" style="margin-bottom:10px;">
        <span class="feature-icon">${icon('spark')}</span>
        <div class="grow">
          <div class="item-title">${profile?.display_name ?? 'Pengguna'}</div>
          <div class="muted small">${profile?.role ?? ''}</div>
        </div>
      </div>
    `);
    if (right) row.appendChild(right);
    return row;
  }

  function renderFriendsList(contentEl) {
    const accepted = friendships.filter((f) => f.status === 'accepted');
    if (accepted.length === 0) {
      contentEl.appendChild(h('<div class="empty-state">Belum ada teman. Cari orang di tab "Cari Orang".</div>'));
      return;
    }
    accepted.forEach((f) => contentEl.appendChild(attachRight(f.other_profile, null)));
  }

  function renderIncoming(contentEl) {
    const incoming = friendships.filter((f) => f.status === 'pending' && f.is_incoming);
    if (incoming.length === 0) {
      contentEl.appendChild(h('<div class="empty-state">Tidak ada permintaan masuk.</div>'));
      return;
    }
    incoming.forEach((f) => {
      const actions = h('<div class="row" style="gap:8px;"></div>');
      const acceptBtn = h('<button class="btn btn-primary" style="padding:8px 14px;">Terima</button>');
      const declineBtn = h('<button class="btn btn-outline" style="padding:8px 14px;">Tolak</button>');
      acceptBtn.onclick = async () => {
        await respondToFriendRequest(f.id, true);
        await logActivity({ category: 'Friends', title: `Berteman dengan ${f.other_profile?.display_name ?? 'pengguna'}` });
        toast('Permintaan diterima.');
        await load();
        renderContent();
      };
      declineBtn.onclick = async () => {
        await respondToFriendRequest(f.id, false);
        toast('Permintaan ditolak.');
        await load();
        renderContent();
      };
      actions.appendChild(acceptBtn);
      actions.appendChild(declineBtn);
      contentEl.appendChild(attachRight(f.other_profile, actions));
    });
  }

  function renderSearch(contentEl) {
    const searchBox = h(`
      <input id="search-input" placeholder="Cari nama tampilan…" style="margin-bottom:14px;" />
    `);
    contentEl.appendChild(searchBox);
    const resultsEl = h('<div id="search-results"></div>');
    contentEl.appendChild(resultsEl);

    let debounceTimer;
    searchBox.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = searchBox.value;
      debounceTimer = setTimeout(async () => {
        if (!q.trim()) {
          resultsEl.innerHTML = '';
          return;
        }
        searching = true;
        resultsEl.innerHTML = '<div class="spinner" style="margin:12px auto;"></div>';
        searchResults = await searchProfiles(q);
        searching = false;
        renderSearchResults(resultsEl);
      }, 300);
    });

    function renderSearchResults(target) {
      target.innerHTML = '';
      if (searchResults.length === 0) {
        target.appendChild(h('<div class="empty-state">Tidak ada hasil.</div>'));
        return;
      }
      const existingIds = new Set(friendships.map((f) => f.other_profile?.id).filter(Boolean));
      searchResults.forEach((p) => {
        const already = existingIds.has(p.id);
        const btn = h(`<button class="btn ${already ? 'btn-outline' : 'btn-primary'}" style="padding:8px 14px;" ${already ? 'disabled' : ''}>${already ? 'Terkirim' : 'Tambah'}</button>`);
        if (!already) {
          btn.onclick = async () => {
            try {
              await sendFriendRequest(p.id);
              toast(`Permintaan terkirim ke ${p.display_name}.`);
              btn.disabled = true;
              btn.textContent = 'Terkirim';
              btn.className = 'btn btn-outline';
              await load();
            } catch (e) {
              toast(e.message || 'Gagal mengirim permintaan.');
            }
          };
        }
        target.appendChild(attachRight(p, btn));
      });
    }
  }

  await load();
  renderContent();

  const unwatch = watchFriendships(async () => {
    await load();
    renderContent();
  });

  return {
    dispose: () => unwatch(),
  };
}
