import { h, icon, escapeHtml, initial } from '../ui.js';
import { currentUser, myProfile, fetchActivity, watchActivity } from '../db.js';
import { listRegisteredProviders } from '../ai.js';
import { navigate } from '../router.js';
import { illustration } from '../illustrations.js';

export default async function render(root) {
  const [user, profile] = await Promise.all([currentUser(), myProfile()]);
  const name = profile?.display_name || user?.email?.split('@')[0] || 'Explorer';
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  const el = h(`
    <div class="page home-page">
      <div class="topbar">
        <h1>Beranda</h1>
        <div class="row" style="gap:6px;">
          <button class="icon-button" data-go="/settings/activity" aria-label="Lihat aktivitas">${icon('bell')}</button>
          <button class="avatar" data-go="/settings/profile" aria-label="Buka profil">${escapeHtml(initial(name))}</button>
        </div>
      </div>
      <section class="home-greeting">
        <div><p class="greeting-line">${greeting},</p><h2>${escapeHtml(name)}</h2>
        <p class="muted small">Ruang untuk ide dan pekerjaanmu.</p></div>
        <span class="greeting-stamp" aria-hidden="true">${icon('spark')}</span>
      </section>
      <div class="collection-heading"><h2>Ruang kerjamu</h2><span class="collection-note">Pilih, buka, mulai.</span></div>
      <div class="module-grid">
        <button class="card tappable module-card" data-go="/settings/apikeys">
          ${illustration('providers')}
          <div class="card-copy"><h3>Asisten AI</h3><p id="provider-count">Memuat...</p></div>
          <span class="card-action">Kelola provider <span aria-hidden="true">↗</span></span>
        </button>
        <button class="card tappable module-card" data-go="/chat">
          ${illustration('chat')}
          <div class="card-copy"><h3>Chat AI</h3><p>Diskusi dan kembangkan ide</p></div>
          <span class="card-action">Mulai chat <span aria-hidden="true">↗</span></span>
        </button>
        <button class="card tappable module-card" data-go="/bots">
          ${illustration('bot')}
          <div class="card-copy"><h3>Bot Hub</h3><p>Bantuan untuk tugas harian</p></div>
          <span class="card-action">Jelajahi bot <span aria-hidden="true">↗</span></span>
        </button>
        <button class="card tappable module-card" data-go="/vpn">
          ${illustration('vpn')}
          <div class="card-copy"><h3>Koneksi VPN</h3><p>Atur server dan koneksimu</p></div>
          <span class="card-action">Kelola koneksi <span aria-hidden="true">↗</span></span>
        </button>
      </div>
      <div class="row-between" style="margin-top:22px;">
        <h2 class="section-title" style="margin:0;">Aktivitas terbaru</h2>
        <button class="btn-text" data-go="/settings/activity">Lihat semua</button>
      </div>
      <div id="recent-activity" aria-live="polite"><p class="muted small">Memuat aktivitas...</p></div>
      <button class="card tappable chat-cta" data-go="/chat">
        <div class="row"><span class="feature-icon tone-blue">${icon('chat')}</span><div><h3>Ada ide hari ini?</h3><p>Mulai percakapan dengan asisten AI pilihanmu.</p></div></div>
        <span class="cta-label">Mulai chat &rarr;</span>
      </button>
    </div>`);
  root.appendChild(el);
  el.querySelectorAll('[data-go]').forEach((button) => {
    button.onclick = () => navigate(button.dataset.go);
  });
  const registered = await listRegisteredProviders();
  el.querySelector('#provider-count').textContent =
    registered.length === 0 ? 'Hubungkan provider & agent' : `${registered.length} asisten terhubung`;

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
      const tone = row.category === 'VPN' ? 'tone-green' : 'tone-blue';
      list.appendChild(h(`<div class="row activity-row"><span class="feature-icon ${tone}">${icon(mark)}</span><div class="grow"><strong>${escapeHtml(row.title)}</strong><time>${escapeHtml(new Date(row.created_at).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }))}</time></div></div>`));
    }
  }
  await refreshActivity();
  const unwatch = watchActivity(() => refreshActivity());
  return { dispose() { disposed = true; unwatch(); } };
}
