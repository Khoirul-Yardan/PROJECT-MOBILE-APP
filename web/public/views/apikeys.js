import { h, header, icon, toast, pageIntro, emptyState, escapeHtml } from '../ui.js';
import { listRegisteredProviders, removeProvider } from '../ai.js';
import { listCredentialSlots, removeCredentialSlot } from '../credentials.js';
import { logActivity } from '../db.js';
import { navigate } from '../router.js';
import { openModelPicker, modelLabel } from '../model-picker.js';

export default async function render(root) {
  const el = h(`<div class="page apikeys-page"></div>`);
  el.appendChild(header('Provider & Agent', { back: true }));
  el.appendChild(pageIntro('Tim AI pilihanmu.', 'Hubungkan provider dan agent, lalu gunakan langsung di Chat.', { label: 'KONEKSI AI' }));

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
    const [providers, slots] = await Promise.all([listRegisteredProviders(), listCredentialSlots()]);
    listEl.innerHTML = '';
    if (providers.length === 0) {
      listEl.appendChild(
        emptyState('Mulai dengan satu asisten.', 'Pilih Provider AI atau Agent di atas untuk menghubungkan asisten pertamamu.')
      );
      return;
    }
    providers.forEach((p) => {
      const card = h(`
        <div class="card row provider-entry">
          <span class="feature-icon ${p.type === 'agent' ? 'tone-blue' : ''}">${icon('spark')}</span>
          <div class="grow">
            <div class="item-title">${escapeHtml(p.label)}</div>
            <div class="muted small">${p.type === 'agent' ? 'Agent' : 'Provider chat'}${p.slotCount > 1 ? ` · ${p.slotCount} kunci` : ''}</div>
          </div>
          <span class="pill pill--ok">Tersambung</span>
          <button class="icon-button" aria-label="Hapus semua kunci ${escapeHtml(p.label)}" data-remove>${icon('trash')}</button>
          ${p.format !== 'openclaw' ? '<button class="provider-model-control" data-model><span class="model-caption">Pilih model</span><span class="current-model"></span><span aria-hidden="true">⌄</span></button>' : ''}
        </div>
      `);
      const modelButton = card.querySelector('[data-model]');
      if (modelButton) {
        card.querySelector('.current-model').textContent = modelLabel(p);
        modelButton.onclick = async () => {
          if (await openModelPicker(p)) card.querySelector('.current-model').textContent = modelLabel(p);
        };
      }
      card.querySelector('[data-remove]').onclick = async () => {
        await removeProvider(p.id);
        await logActivity({ category: 'AI', title: 'API diputus', subtitle: p.label, badge: 'Info' });
        toast(`${p.label} dihapus.`);
        renderList();
      };
      listEl.appendChild(card);

      // Multiple key slots behind this one provider — list each so a single
      // slot (e.g. a dead key) can be removed without disconnecting the rest.
      const providerSlots = slots.filter((s) => s.id === p.id);
      if (providerSlots.length > 1) {
        const slotList = h('<div class="list slot-list" style="margin:0 0 4px 44px;"></div>');
        providerSlots.forEach((slot) => {
          const slotRow = h(`
            <div class="row" style="padding:6px 2px;">
              <span class="muted small grow">${escapeHtml(slot.label)}</span>
              <button class="icon-button" aria-label="Hapus kunci ${escapeHtml(slot.label)}" data-remove-slot>${icon('trash')}</button>
            </div>
          `);
          slotRow.querySelector('[data-remove-slot]').onclick = async () => {
            await removeCredentialSlot(slot.slotId);
            await logActivity({ category: 'AI', title: 'Slot kunci dihapus', subtitle: slot.label, badge: 'Info' });
            toast(`Kunci "${slot.label}" dihapus.`);
            renderList();
          };
          slotList.appendChild(slotRow);
        });
        listEl.appendChild(slotList);
      }
    });
  }

  await renderList();

  el.appendChild(
    h(`
    <p class="helper-note">
      Provider dan agent yang terhubung akan tersedia di pilihan asisten pada halaman Chat.
    </p>
  `)
  );
}
