import { h } from '../ui.js';
import { currentUser, myProfile } from '../db.js';
import { hasApiKey, PROVIDERS } from '../ai.js';
import { navigate } from '../router.js';

export default async function render(root) {
  const user = await currentUser();
  const profile = await myProfile();
  const name = profile?.display_name || user?.email?.split('@')[0] || 'Explorer';

  const el = h(`
    <div class="page home-page">
      <div class="topbar">
        <div>
          <p class="muted small" style="margin:0;">Selamat datang,</p>
          <h1 style="margin:2px 0 0;">${name}</h1>
        </div>
      </div>
      <hr class="section-divider" />

      <div class="row-between">
        <span class="section-title" style="margin:0;">Penyedia AI Terhubung</span>
        <span id="provider-count" class="muted small" style="font-family:var(--mono);">…</span>
      </div>
      <div id="providers" class="status-grid" style="margin-top:10px;"></div>

      <div class="card system-card">
        <h3 style="font-size:14px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.5px;">Status Sistem</h3>
        <div class="status-grid" style="margin-top:14px;">
          <button class="status-tile status-tile--vpn" data-go="/vpn">
            <span aria-hidden="true">&#9673;</span><span class="label">VPN</span><span class="value">Lihat status</span>
          </button>
          <button class="status-tile status-tile--bots" data-go="/bots">
            <span aria-hidden="true">&#9635;</span><span class="label">Bots</span><span class="value">Bot BPJS</span>
          </button>
          <button class="status-tile status-tile--friends" data-go="/friends">
            <span aria-hidden="true">&#9670;</span><span class="label">Teman</span><span class="value">Kelola</span>
          </button>
        </div>
      </div>

      <button type="button" class="card tappable chat-cta" id="chat-cta">
        <div class="row-between">
          <div>
            <span class="eyebrow" style="color:#cfc9bc;">Percakapan AI</span>
            <h3 style="margin-top:6px;">Mulai obrolan baru</h3>
          </div>
        </div>
        <span class="cta-label">Buka Chat &rarr;</span>
      </button>
    </div>
  `);
  root.appendChild(el);

  el.querySelectorAll('[data-go]').forEach((btn) => {
    btn.onclick = () => navigate(btn.dataset.go);
  });
  el.querySelector('#chat-cta').onclick = () => navigate('/chat');

  const providersEl = el.querySelector('#providers');
  const countEl = el.querySelector('#provider-count');
  const entries = Object.entries(PROVIDERS);
  let connected = 0;
  for (const [id, info] of entries) {
    const has = await hasApiKey(id);
    if (has) connected++;
    const tile = h(`
      <div class="card provider-card">
        <div class="provider-icon" aria-hidden="true" style="font-family:var(--mono);font-weight:700;">${id === 'openai' ? 'O' : id === 'anthropic' ? 'C' : 'G'}</div>
        <div class="provider-name">${info.label}</div>
        <div class="small" style="color:${has ? 'var(--ok)' : 'var(--ink-faint)'};margin-top:3px;">
          ${has ? 'Terhubung' : 'Belum terhubung'}
        </div>
      </div>
    `);
    providersEl.appendChild(tile);
  }
  countEl.textContent = `${connected}/${entries.length}`;
}
