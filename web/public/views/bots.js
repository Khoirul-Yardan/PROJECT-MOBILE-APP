import { h, icon, pageIntro, escapeHtml } from '../ui.js';
import { Native } from '../bridge.js';
import { navigate } from '../router.js';
import { illustration } from '../illustrations.js';
import { getRemoteBots } from '../remote-config.js';

// Bots are deliberately separate from Chat: each one has its own fixed
// flow (Bot BPJS: wake word → record → transcript → send to doctor), not a
// free-form conversation. Providers and agents (ChatGPT, Hermes, etc.) live
// in Chat instead — see views/chat.js and Settings → "API & Agent Terhubung".
// Bot tambahan dari Panel Admin. Teks disisipkan lewat innerHTML di bawah,
// jadi di-escape di sini; target hanya boleh rute internal atau http(s).
function remoteItems() {
  return getRemoteBots().map((b) => {
    const isRoute = b.kind === 'route' && /^\/[a-z0-9\-/]*$/i.test(b.target);
    const isLink = b.kind === 'link' && /^https?:\/\//i.test(b.target);
    if (!isRoute && !isLink) return null;
    return {
      icon: b.icon || 'bot',
      art: 'bot',
      title: escapeHtml(b.title),
      subtitle: escapeHtml(b.subtitle),
      available: true,
      open: () => (isRoute ? navigate(b.target) : window.open(b.target, '_blank', 'noopener')),
    };
  }).filter(Boolean);
}

const ITEMS = [
  {
    icon: 'bot',
    art: 'bot',
    title: 'Bot BPJS',
    subtitle: 'Dokumentasi percakapan untuk form BPJS',
    available: true,
    open: () => Native.openBotBpjs(),
  },
  {
    icon: 'chat',
    art: 'providers',
    title: 'Papan Komunikasi',
    subtitle: 'Pasien memilih ikon keluhan, sistem bersuara dan mencatatnya',
    available: true,
    open: () => navigate('/papan-komunikasi'),
  },
  {
    icon: 'bot',
    art: 'chat',
    title: 'Anamnesis Terpandu',
    subtitle: 'Asisten suara menanyakan anamnesis, jawaban jadi draf form',
    available: true,
    open: () => Native.openAnamnesisTerpandu(),
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
            <div class="item-title">Dokumentasi &amp; Riwayat</div>
            <div class="muted small">Cari dan periksa semua data: Bot BPJS, Anamnesis Terpandu, dan Papan Komunikasi.</div>
          </div>
        </div>
      </button>
    </div>
  `);
  root.appendChild(el);
  el.querySelector('.topbar').after(pageIntro('Bantuan kecil. Dampak besar.', 'Pilih asisten sesuai kondisi pasien: rekam percakapan, papan sentuh, atau anamnesis terpandu.', { art: 'bot', label: 'KOLEKSI BOT', tone: 'intro-mint' }));

  el.querySelector('#bpjs-review-link').onclick = () => navigate('/bpjs');

  const gridEl = el.querySelector('#grid');
  [...ITEMS, ...remoteItems()].forEach((item) => {
    const card = h(`
      <button type="button" class="card tappable agent-card">
        ${illustration(item.art)}
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
  // Bot BPJS and Anamnesis Terpandu need the microphone (+ TTS) — those stay
  // 100% native for OS-level permission handling and reliable audio, so the
  // web layer just asks the shell to open the native screen. Papan Komunikasi
  // is plain web and simply navigates to its own route.
  detailEl.innerHTML = '';
  await item.open();
}
