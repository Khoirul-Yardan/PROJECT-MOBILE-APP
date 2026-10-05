import { h, header, icon, pageIntro, emptyState, escapeHtml } from '../ui.js';
import { listRegisteredProviders } from '../ai.js';
import { listConversations } from '../chat-history.js';
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
  el.appendChild(pageIntro('Obrolan sebelumnya.', 'Dikelompokkan per AI atau agent — ketuk untuk melanjutkan.', { label: 'RIWAYAT', art: 'chat' }));

  const listEl = h('<div class="list"></div>');
  el.appendChild(listEl);
  root.appendChild(el);

  const [conversations, providers] = await Promise.all([listConversations(), listRegisteredProviders()]);
  const typeById = new Map(providers.map((p) => [p.id, p.type]));

  if (conversations.length === 0) {
    listEl.appendChild(emptyState('Belum ada riwayat.', 'Obrolanmu dengan AI atau agent akan muncul di sini.'));
    return;
  }

  conversations.forEach((c) => {
    const isAgent = typeById.get(c.id) === 'agent';
    const card = h(`
      <button class="card tappable row history-entry">
        <span class="feature-icon ${isAgent ? 'tone-blue' : ''}">${icon(isAgent ? 'layers' : 'spark')}</span>
        <div class="grow">
          <div class="item-title">${escapeHtml(c.label)}</div>
          <div class="muted small history-preview">${c.lastFromMe ? 'Kamu: ' : ''}${escapeHtml(c.lastMessage)}</div>
        </div>
        <span class="muted small history-time">${timeLabel(c.lastAt)}</span>
      </button>
    `);
    card.onclick = () => navigate(`/chat?provider=${encodeURIComponent(c.id)}`);
    listEl.appendChild(card);
  });
}
