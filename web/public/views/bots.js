import { h, icon, pageIntro } from '../ui.js';
import { Native } from '../bridge.js';
import { navigate } from '../router.js';
import { illustration } from '../illustrations.js';

// Bots are deliberately separate from Chat: each one has its own fixed
// flow (Bot BPJS: wake word → record → transcript → send to doctor), not a
// free-form conversation. Providers and agents (ChatGPT, Hermes, etc.) live
// in Chat instead — see views/chat.js and Settings → "API & Agent Terhubung".
const ITEMS = [
  {
    icon: 'bot',
    title: 'Bot BPJS',
    subtitle: 'Dokumentasi percakapan untuk form BPJS',
    available: true,
  },
  {
    icon: 'chat',
    title: 'Bot FAQ',
    subtitle: 'Jawaban untuk pertanyaan seputar aplikasi',
    available: false,
  },
  {
    icon: 'chat',
    title: 'Bot Penerjemah',
    subtitle: 'Terjemahkan percakapan lintas bahasa',
    available: false,
  },
];

export default async function render(root) {
  const el = h(`
    <div class="page bots-page">
      <div class="topbar"><h1>Bot Hub</h1></div>
      <div id="grid" class="agent-grid"></div>
      <button type="button" class="card tappable" id="bpjs-review-link" style="margin-top:14px;text-align:left;">
        <div class="row">
          <span class="feature-icon">${icon('document')}</span>
          <div class="grow">
            <div class="item-title">Dokumentasi BPJS</div>
            <div class="muted small">Lihat sesi yang sudah direkam, salin atau ekspor untuk dikirim ke dokter.</div>
          </div>
        </div>
      </button>
    </div>
  `);
  root.appendChild(el);
  el.querySelector('.topbar').after(pageIntro('Bantuan kecil. Dampak besar.', 'Pilih asisten dengan alur kerja yang sesuai kebutuhanmu.', { art: 'bot', label: 'KOLEKSI BOT', tone: 'intro-mint' }));

  el.querySelector('#bpjs-review-link').onclick = () => navigate('/bpjs');

  const gridEl = el.querySelector('#grid');
  ITEMS.forEach((item) => {
    const card = h(`
      <button type="button" class="card tappable agent-card">
        ${illustration(item.available ? 'bot' : item.title === 'Bot FAQ' ? 'providers' : 'chat')}
        <div class="agent-heading">
          <span class="pill ${item.available ? 'pill--ok' : 'pill--warn'}">${item.available ? 'Aktif' : 'Segera'}</span>
        </div>
        <h3>${item.title}</h3>
        <p>${item.subtitle}</p>
        <span class="card-action">${item.available ? 'Buka bot' : 'Info bot'} <span aria-hidden="true">↗</span></span>
      </button>
    `);
    card.onclick = () => openItem(item, el);
    gridEl.appendChild(card);
  });
}

async function openItem(item, el) {
  const detailEl = el.querySelector('#detail') || el.appendChild(h('<div id="detail"></div>'));
  if (!item.available) {
    detailEl.innerHTML = `<p class="small muted" style="margin-top:14px;">${item.title} belum tersedia.</p>`;
    return;
  }
  // Bot BPJS needs the microphone + wake-word listener — that stays 100%
  // native for clarity and OS-level permission handling, so the web layer
  // just asks the shell to open its native screen.
  detailEl.innerHTML = '';
  await Native.openBotBpjs();
}
