import { h, header, icon, toast, pageIntro, emptyState, escapeHtml } from '../ui.js';
import { listRegisteredProviders } from '../ai.js';
import { listConversations, clearConversation } from '../chat-history.js';
import { navigate } from '../router.js';

function timeLabel(iso) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default async function render(root) {
  const el = h(`<div class="page history-page"></div>`);
  el.appendChild(header('Riwayat Chat', { back: true }));
  el.appendChild(pageIntro('Obrolan sebelumnya.', 'Satu AI/agent bisa punya beberapa sesi — yang terbaru di atas, ketuk untuk melanjutkan, atau hapus biar tidak menumpuk.', { label: 'RIWAYAT', art: 'chat' }));

  const listEl = h('<div class="list"></div>');
  el.appendChild(listEl);
  root.appendChild(el);

  const providers = await listRegisteredProviders();
  const typeById = new Map(providers.map((p) => [p.id, p.type]));

  async function renderList() {
    const conversations = await listConversations();
    listEl.innerHTML = '';
    if (conversations.length === 0) {
      listEl.appendChild(emptyState('Belum ada riwayat.', 'Obrolanmu dengan AI atau agent akan muncul di sini.'));
      return;
    }
    conversations.forEach((c) => {
      const isAgent = typeById.get(c.id) === 'agent';
      // A <button> can't nest another <button> (invalid HTML), so the card
      // itself is a plain row with two separate clickable children: the
      // content area (open this session) and the delete icon-button.
      const card = h(`
        <div class="card row history-entry">
          <button class="row grow history-open" style="text-align:left;background:none;border:none;padding:0;min-height:0;">
            <span class="feature-icon ${isAgent ? 'tone-blue' : ''}">${icon(isAgent ? 'layers' : 'spark')}</span>
            <div class="grow">
              <div class="item-title">${escapeHtml(c.label)}</div>
              <div class="muted small history-preview">${c.lastFromMe ? 'Kamu: ' : ''}${escapeHtml(c.lastMessage)}</div>
            </div>
            <span class="muted small history-time">${timeLabel(c.lastAt)}</span>
          </button>
          <button class="icon-button" aria-label="Hapus sesi ${escapeHtml(c.label)}" data-delete>${icon('trash')}</button>
        </div>
      `);
      card.querySelector('.history-open').onclick = () =>
        navigate(`/chat?provider=${encodeURIComponent(c.id)}&session=${encodeURIComponent(c.sessionId)}`);
      card.querySelector('[data-delete]').onclick = async () => {
        await clearConversation(c.id, c.sessionId);
        toast('Sesi dihapus.');
        renderList();
      };
      listEl.appendChild(card);
    });
  }

  await renderList();
}
