import { h } from '../ui.js';
import { Native } from '../bridge.js';
import { logActivity } from '../db.js';

const ITEMS = [
  { icon: '🎙️', title: 'Bot BPJS', subtitle: 'Dokumentasi perawat-pasien otomatis, siap format form BPJS', category: 'Bots', isBot: true, available: true, color: '#7954ff' },
  { icon: '❓', title: 'Bot FAQ', subtitle: 'Jawab pertanyaan umum seputar aplikasi', category: 'Bots', isBot: true, available: false, color: '#087cff' },
  { icon: '🌐', title: 'Bot Penerjemah', subtitle: 'Terjemahkan percakapan lintas bahasa', category: 'Bots', isBot: true, available: false, color: '#20d7e5' },
  { icon: '🔎', title: 'Research Agent', subtitle: 'Find and analyze information', category: 'Productivity', color: '#20d7e5' },
  { icon: '💻', title: 'Code Agent', subtitle: 'Write, debug and build faster', category: 'Dev', color: '#087cff' },
  { icon: '✏️', title: 'Content Agent', subtitle: 'Write, edit and optimize content', category: 'Creative', color: '#087cff' },
  { icon: '📊', title: 'Data Agent', subtitle: 'Analyze data and create insights', category: 'Productivity', color: '#09ad59' },
  { icon: '📅', title: 'Planner Agent', subtitle: 'Turn ideas into action plans', category: 'Productivity', color: '#c44eff' },
];

const TABS = ['All', 'Bots', 'Productivity', 'Creative', 'Dev'];

export default async function render(root) {
  let tab = 0;
  let query = '';

  const el = h(`
    <div class="page bots-page">
      <div class="topbar"><h1>Bot Hub</h1></div>
      <p class="muted small">Packaged bots and specialized AI agents for every task.</p>
      <input id="search" aria-label="Search agents" placeholder="Search agents…" style="margin:12px 0;" />
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
      gridEl.replaceWith(h('<div id="grid" class="empty-state">No agents found.</div>'));
      return;
    }
    visible.forEach((item) => {
      const card = h(`
        <button type="button" class="card tappable agent-card">
          <div class="agent-heading">
            <span class="agent-icon" aria-hidden="true">${item.icon}</span>
            ${item.isBot ? `<span class="pill ${item.available ? 'pill--ok' : 'pill--warn'}">${item.available ? 'Bot' : 'Segera'}</span>` : ''}
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
        ? ['Initializing environment...', 'Cloning repository...', 'Installing dependencies...', 'Running tests...', 'Tests passed (12/12)', 'Generating summary...']
        : ['Initializing workspace...', 'Loading agent tools...', 'Analyzing the request...', 'Generating summary...', 'Task completed'];
    detailEl.innerHTML = '';
    const panel = h(`
      <div class="card" style="margin-top:16px;">
        <h3>${item.title} — Execution</h3>
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
