import { h, header, icon, toast } from '../ui.js';
import { listRegisteredProviders, removeProvider } from '../ai.js';
import { logActivity } from '../db.js';
import { navigate } from '../router.js';

export default async function render(root) {
  const el = h(`<div class="page apikeys-page"></div>`);
  el.appendChild(header('API & Agent Terhubung', { back: true }));
  el.appendChild(
    h(`
    <p class="muted small" style="margin-top:-8px;">
      Semua provider AI dan agent yang sudah kamu hubungkan lewat API key.
      Ini juga yang muncul sebagai pilihan lawan bicara di Chat.
    </p>
  `)
  );

  const addRow = h('<div class="row" style="gap:10px;margin:16px 0;"></div>');
  const addProviderBtn = h(`
    <button class="btn btn-primary" style="flex:1;">
      <span aria-hidden="true">+</span> Provider AI
    </button>
  `);
  addProviderBtn.onclick = () => navigate('/settings/add-api-key?type=provider');
  const addAgentBtn = h(`
    <button class="btn btn-outline" style="flex:1;">
      <span aria-hidden="true">+</span> Agent
    </button>
  `);
  addAgentBtn.onclick = () => navigate('/settings/add-api-key?type=agent');
  addRow.appendChild(addProviderBtn);
  addRow.appendChild(addAgentBtn);
  el.appendChild(addRow);

  const listEl = h('<div class="list"></div>');
  el.appendChild(listEl);
  root.appendChild(el);

  async function renderList() {
    const providers = await listRegisteredProviders();
    listEl.innerHTML = '';
    if (providers.length === 0) {
      listEl.appendChild(
        h('<div class="empty-state">Belum ada API atau agent yang terhubung. Pilih "Provider AI" atau "Agent" di atas.</div>')
      );
      return;
    }
    providers.forEach((p) => {
      const card = h(`
        <div class="card row">
          <span class="feature-icon ${p.type === 'agent' ? 'tone-purple' : ''}">${icon('spark')}</span>
          <div class="grow">
            <div class="item-title">${p.label}</div>
            <div class="muted small">${p.type === 'agent' ? 'Agent' : 'Provider chat'}${p.model ? ' · ' + p.model : ''}</div>
          </div>
          <span class="pill pill--ok">Tersambung</span>
          <button class="icon-button" aria-label="Hapus ${p.label}" data-remove>${icon('trash')}</button>
        </div>
      `);
      card.querySelector('[data-remove]').onclick = async () => {
        await removeProvider(p.id);
        await logActivity({ category: 'AI', title: 'API diputus', subtitle: p.label, badge: 'Info' });
        toast(`${p.label} dihapus.`);
        renderList();
      };
      listEl.appendChild(card);
    });
  }

  await renderList();

  el.appendChild(
    h(`
    <p class="muted small" style="margin-top:20px;">
      Kunci API disimpan hanya di perangkat ini (Keystore/Keychain) dan dikirim langsung ke
      provider/agent yang kamu pilih — tidak pernah lewat server AI Hub.
    </p>
  `)
  );
}
