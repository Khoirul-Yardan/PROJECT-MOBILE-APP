import { h, header, icon, toast, escapeHtml } from '../ui.js';
import { listRegisteredProviders, removeProvider } from '../ai.js';
import { logActivity } from '../db.js';
import { navigate } from '../router.js';

export default async function render(root) {
  const el = h(`<div class="page apikeys-page"></div>`);
  el.appendChild(header('Provider & Agent', { back: true }));
  el.appendChild(
    h(`
    <p class="muted small" style="margin-top:-8px;">
      Semua provider AI dan agent yang tersimpan pada akun Anda.
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
    listEl.textContent = 'Memuat layanan…';
    let providers;
    try { providers = await listRegisteredProviders(); }
    catch { listEl.replaceChildren(h('<p role="alert">Layanan gagal dimuat.</p>')); const retry = h('<button class="btn-text">Coba lagi</button>'); retry.onclick = renderList; listEl.appendChild(retry); return; }
    listEl.innerHTML = '';
    if (providers.length === 0) {
      listEl.appendChild(
        h('<div class="empty-state">Belum ada layanan tersimpan. Pilih "Provider AI" atau "Agent" di atas.</div>')
      );
      return;
    }
    providers.forEach((p) => {
      const card = h(`
        <div class="row service-row">
          <span class="feature-icon ${p.type === 'agent' ? 'tone-purple' : ''}">${icon('spark')}</span>
          <div class="grow">
            <div class="item-title">${escapeHtml(p.label)}</div>
            <div class="muted small">${p.type === 'agent' ? 'Agent' : 'Provider chat'}${p.model ? ' · ' + escapeHtml(p.model) : ''}</div>
          </div>
          <span class="pill">Tersimpan</span>
          <button class="icon-button" aria-label="Hapus ${escapeHtml(p.label)}" data-remove>${icon('trash')}</button>
        </div>
      `);
      card.querySelector('[data-remove]').onclick = async (event) => {
        if (!window.confirm(`Hapus kredensial ${p.label}? Chat berikutnya memerlukan konfigurasi ulang.`)) return;
        event.currentTarget.disabled = true;
        try { await removeProvider(p.id); toast('Kredensial dihapus'); await renderList(); }
        catch { card.appendChild(h('<p role="alert" class="error-text">Kredensial belum dapat dihapus. Coba lagi.</p>')); card.querySelector('button').disabled = false; }
      };
      listEl.appendChild(card);
    });
  }

  await renderList();

  el.appendChild(
    h(`
    <p class="muted small" style="margin-top:20px;">
      Konfigurasi layanan tersimpan pada akun Anda. Penyimpanan belum membuktikan koneksi berhasil.
    </p>
  `)
  );
}
