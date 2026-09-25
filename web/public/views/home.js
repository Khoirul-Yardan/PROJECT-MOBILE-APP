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
          <p class="muted small" style="margin:0;">Good to see you,</p>
          <h1 style="margin:2px 0 0;">${name} 👋</h1>
        </div>
      </div>
      <p class="muted small">Your AI workspace is ready.</p>
      <hr class="section-divider" />

      <div class="row-between">
        <span class="section-title" style="margin:0;">Connected Providers</span>
        <span id="provider-count" class="muted small">…</span>
      </div>
      <div id="providers" class="status-grid" style="margin-top:10px;"></div>

      <div class="card system-card">
        <h3 style="font-size:16px;">System Status</h3>
        <div class="status-grid" style="margin-top:14px;">
          <button class="status-tile status-tile--vpn" data-go="/vpn">
            <span>🛡️</span><span class="label">VPN</span><span class="value">Lihat status</span>
          </button>
          <button class="status-tile status-tile--bots" data-go="/bots">
            <span>🤖</span><span class="label">Bots</span><span class="value">Bot BPJS</span>
          </button>
          <button class="status-tile status-tile--friends" data-go="/friends">
            <span>👥</span><span class="label">Friends</span><span class="value">Kelola</span>
          </button>
        </div>
      </div>

      <button type="button" class="card tappable chat-cta" id="chat-cta">
        <div class="row-between">
          <div>
            <h3>Smarter tools.<br/>A brighter you.</h3>
          </div>
          <span aria-hidden="true" style="font-size:28px;">✨</span>
        </div>
        <span class="cta-label">Open AI Chat &rarr;</span>
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
        <div class="provider-icon" aria-hidden="true">${id === 'openai' ? '🌀' : id === 'anthropic' ? '☀️' : 'G'}</div>
        <div class="provider-name">${info.label}</div>
        <div class="small" style="color:${has ? 'var(--success)' : 'var(--text-muted)'};margin-top:3px;">
          ${has ? 'Connected' : 'Not connected'}
        </div>
      </div>
    `);
    providersEl.appendChild(tile);
  }
  countEl.textContent = `${connected}/${entries.length}`;
}
