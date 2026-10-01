import { h, icon, escapeHtml, initial } from '../ui.js';
import { currentUser, myProfile, fetchActivity, watchActivity } from '../db.js';
import { listRegisteredProviders } from '../ai.js';
import { navigate } from '../router.js';

export default async function render(root) {
  const [user, profile] = await Promise.all([currentUser(), myProfile()]);
  const name = profile?.display_name || user?.email?.split('@')[0] || 'Explorer';
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  const el = h(`
    <div class="page home-page">
      <div class="topbar">
        <h1>Home Dashboard</h1>
        <div class="row" style="gap:6px;">
          <button class="icon-button" data-go="/settings/activity" aria-label="Lihat aktivitas">${icon('bell')}</button>
          <button class="avatar" data-go="/settings/profile" aria-label="Buka profil">${escapeHtml(initial(name))}</button>
        </div>
      </div>
      <section class="home-greeting">
        <p>${greeting},</p><h2>${escapeHtml(name)}</h2>
        <p class="muted small">Siap membuat hari ini lebih produktif?</p>
      </section>
      <div class="module-grid">
        <button class="card tappable module-card" data-go="/settings/apikeys">
          <span class="feature-icon tone-green">${icon('spark')}</span>
          <h3>Provider &amp; Agent</h3><p id="provider-count">Memuat...</p>
        </button>
        <button class="card tappable module-card" data-go="/chat">
          <span class="feature-icon tone-purple">${icon('chat')}</span>
          <h3>Chat</h3><p>Pakai provider atau agent pilihanmu</p>
        </button>
        <button class="card tappable module-card" data-go="/bots">
          <span class="feature-icon">${icon('bot')}</span>
          <h3>Bots</h3><p>Jarvis &amp; Bot BPJS</p>
        </button>
        <button class="card tappable module-card" data-go="/vpn">
          <span class="feature-icon tone-green">${icon('shield')}</span>
          <h3>VPN</h3><p>Kelola koneksi aman</p>
        </button>
      </div>
      <div class="row-between" style="margin-top:22px;">
        <h2 class="section-title" style="margin:0;">Aktivitas terbaru</h2>
        <button class="btn-text" data-go="/settings/activity">Lihat semua</button>
      </div>
      <div id="recent-activity" aria-live="polite"><p class="muted small">Memuat aktivitas...</p></div>
      <button class="card tappable chat-cta" data-go="/chat">
        <div class="row"><span class="feature-icon tone-purple">${icon('chat')}</span><div><h3>Ada ide hari ini?</h3><p>Mulai percakapan dengan asisten AI pilihanmu.</p></div></div>
        <span class="cta-label">Mulai chat &rarr;</span>
      </button>
    </div>`);
  root.appendChild(el);
  el.querySelectorAll('[data-go]').forEach((button) => {
    button.onclick = () => navigate(button.dataset.go);
  });
  const registered = await listRegisteredProviders();
  el.querySelector('#provider-count').textContent =
    registered.length === 0 ? 'Belum ada — tambah sekarang' : `${registered.length} terhubung`;

  let disposed = false;
  async function refreshActivity() {
    const rows = await fetchActivity();
    if (disposed) return;
    const list = el.querySelector('#recent-activity');
    list.replaceChildren();
    if (!rows.length) {
      list.appendChild(h('<div class="empty-state">Belum ada aktivitas. Mulai chat atau atur provider AI pertamamu.</div>'));
      return;
    }
    for (const row of rows.slice(0, 3)) {
      const mark = row.category === 'VPN' ? 'shield' : row.category === 'AI' ? 'chat' : 'document';
      const tone = row.category === 'VPN' ? 'tone-green' : 'tone-purple';
      list.appendChild(h(`<div class="row activity-row"><span class="feature-icon ${tone}">${icon(mark)}</span><div class="grow"><strong>${escapeHtml(row.title)}</strong><time>${escapeHtml(new Date(row.created_at).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }))}</time></div></div>`));
    }
  }
  await refreshActivity();
  const unwatch = watchActivity(() => refreshActivity());
  return { dispose() { disposed = true; unwatch(); } };
}
