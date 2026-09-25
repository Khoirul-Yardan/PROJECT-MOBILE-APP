import { h } from '../ui.js';
import { Native } from '../bridge.js';
import { logActivity } from '../db.js';

const ITEMS = [
  { icon: '&#9679;', title: 'Bot BPJS', subtitle: 'Dokumentasi perawat-pasien otomatis, siap format form BPJS', category: 'Bots', isBot: true, available: true },
  { icon: '&#9635;', title: 'Bot FAQ', subtitle: 'Jawab pertanyaan umum seputar aplikasi', category: 'Bots', isBot: true, available: false },
  { icon: '&#9673;', title: 'Bot Penerjemah', subtitle: 'Terjemahkan percakapan lintas bahasa', category: 'Bots', isBot: true, available: false },
  { icon: '&#9670;', title: 'Research Agent', subtitle: 'Cari dan analisis informasi dari berbagai sumber', category: 'Productivity' },
  { icon: '&#9633;', title: 'Code Agent', subtitle: 'Tulis, debug, dan bangun kode lebih cepat', category: 'Dev' },
  { icon: '&#9998;', title: 'Content Agent', subtitle: 'Tulis, sunting, dan optimalkan konten', category: 'Creative' },
  { icon: '&#9707;', title: 'Data Agent', subtitle: 'Analisis data dan hasilkan insight', category: 'Productivity' },
  { icon: '&#9737;', title: 'Planner Agent', subtitle: 'Ubah ide menjadi rencana aksi', category: 'Productivity' },
];

const TABS = ['Semua', 'Bots', 'Productivity', 'Creative', 'Dev'];

export default async function render(root) {
  let tab = 0;
  let query = '';

  const el = h(`
    <div class="page bots-page">
      <div class="topbar"><h1>Bot Hub</h1></div>
      <p class="muted small">Bot siap pakai dan agen AI khusus untuk setiap tugas.</p>
      <input id="search" aria-label="Cari agen" placeholder="Cari agen…" style="margin:12px 0;" />
      <div id="tabs" class="tabs"></div>
      <div id="grid" class="agent-grid"></div>
      <div id="detail"></div>
    </div>
  `);
  root.appendChild(el);

  const tabsEl = el.querySelector('#tabs');
  TABS.forEach((label, i) => {
    const btn = h(`<button class="tab ${i === 0 ? 'active' : ''}">${label}</button>`);
    btn.onclick = () => {
      tab = i;
      tabsEl.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
      renderGrid();
    };
    tabsEl.appendChild(btn);
  });

  el.querySelector('#search').addEventListener('input', (e) => {
    query = e.target.value.toLowerCase();
    renderGrid();
  });

  function renderGrid() {
    const gridEl = el.querySelector('#grid');
    const visible = ITEMS.filter(
      (i) => (tab === 0 || i.category === TABS[tab]) && i.title.toLowerCase().includes(query)
    );
    gridEl.innerHTML = '';
    if (visible.length === 0) {
      gridEl.replaceWith(h('<div id="grid" class="empty-state">Tidak ada agen yang cocok.</div>'));
      return;
    }
    visible.forEach((item) => {
      const card = h(`
        <button type="button" class="card tappable agent-card">
          <div class="agent-heading">
            <span class="agent-icon" aria-hidden="true">${item.icon}</span>
            ${item.isBot ? `<span class="pill ${item.available ? 'pill--ok' : 'pill--warn'}">${item.available ? 'Aktif' : 'Segera'}</span>` : ''}
          </div>
          <h3>${item.title}</h3>
          <p>${item.subtitle}</p>
        </button>
      `);
      card.onclick = () => openItem(item);
      gridEl.appendChild(card);
    });
  }

  async function openItem(item) {
    const detailEl = el.querySelector('#detail');
    if (item.isBot) {
      if (!item.available) {
        detailEl.innerHTML = `<p class="small muted">${item.title} belum tersedia.</p>`;
        return;
      }
      // Bot BPJS needs the microphone + wake-word listener — that stays
      // 100% native for clarity and OS-level permission handling, so the
      // web layer just asks the shell to open its native screen.
      await Native.openBotBpjs();
      return;
    }
    runAgentSimulation(item, detailEl);
  }

  function runAgentSimulation(item, detailEl) {
    const logs =
      item.title === 'Code Agent'
        ? ['Menyiapkan environment...', 'Meng-clone repository...', 'Memasang dependensi...', 'Menjalankan tes...', 'Tes lolos (12/12)', 'Menyusun ringkasan...']
        : ['Menyiapkan workspace...', 'Memuat tools agen...', 'Menganalisis permintaan...', 'Menyusun ringkasan...', 'Tugas selesai'];
    detailEl.innerHTML = '';
    const panel = h(`
      <div class="card" style="margin-top:16px;">
        <h3>${item.title} — Log Eksekusi</h3>
        <div id="log" class="list execution-log" role="log" aria-live="polite"></div>
      </div>
    `);
    detailEl.appendChild(panel);
    const logEl = panel.querySelector('#log');
    logs.forEach((line, i) => {
      setTimeout(() => logEl.appendChild(h(`<div>› ${line}</div>`)), i * 220);
    });
    logActivity({
      category: 'Agents',
      title: `${item.title} task completed`,
      subtitle: 'Prepare and review task results',
      badge: 'Success',
    });
  }

  renderGrid();
}
