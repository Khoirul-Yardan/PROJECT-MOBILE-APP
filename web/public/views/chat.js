import { h, icon, emptyState } from '../ui.js';
import { sendChat, listRegisteredProviders } from '../ai.js';
import { saveMessage, loadMessages, clearConversation } from '../chat-history.js';
import { logActivity } from '../db.js';
import { navigate } from '../router.js';
import { openModelPicker, modelLabel } from '../model-picker.js';

// Telegram-style skill commands: type "/" as the first character, or tap
// the skill button next to the input, to get the same picker.
const SKILLS = [
  {
    cmd: '/system',
    label: 'Atur instruksi sistem',
    hint: '/system <instruksi untuk AI>',
    needsArgs: true,
  },
  {
    cmd: '/clear',
    label: 'Bersihkan percakapan ini',
    hint: '/clear',
    needsArgs: false,
  },
  {
    cmd: '/help',
    label: 'Lihat semua perintah',
    hint: '/help',
    needsArgs: false,
  },
];

// One picker, everything equal: every provider (ChatGPT, Gemini, ...) and
// agent (Hermes, OpenClaw, ...) the user has connected sits in the same
// chip row — pick whichever, there's no separate "agent menu" to dig
// through first.
export default async function render(root) {
  let entry = null;
  let sending = false;
  let providers = [];
  let disposed = false;

  const messagesByEntry = new Map();
  const systemPromptByEntry = new Map();

  const el = h(`
    <div class="page chat-page">
      <div class="topbar">
        <h1 id="chat-title">Chat</h1>
        <div class="row" style="gap:8px;flex-shrink:0;">
          <button class="icon-button" id="chat-history" aria-label="Riwayat chat">${icon('clock')}</button>
          <button class="icon-button" id="manage-provider" aria-label="Kelola asisten">${icon('layers')}</button>
        </div>
      </div>
      <div id="picker" class="tabs"></div>
      <button id="chat-model" class="provider-model-control chat-model" hidden><span class="model-caption">Pilih model</span><span class="current-model"></span><span aria-hidden="true">⌄</span></button>
      <p id="model-notice" class="model-notice" role="status" aria-live="polite" hidden></p>
      <div id="messages" class="chat-scroll" role="log" aria-label="Pesan" aria-live="polite"></div>
      <div id="skill-menu" class="skill-menu hidden"></div>
      <div class="chat-input-row">
        <button id="skill-btn" class="icon-btn" aria-label="Skills">/</button>
        <textarea id="input" aria-label="Pesan" rows="1" placeholder="Tulis pesan…" enterkeyhint="enter"></textarea>
        <button id="send" class="send-btn" aria-label="Kirim pesan">&#8594;</button>
      </div>
    </div>
  `);
  root.appendChild(el);
  el.querySelector('#manage-provider').onclick = () => navigate('/settings/apikeys');
  el.querySelector('#chat-history').onclick = () => navigate('/history');

  const titleEl = el.querySelector('#chat-title');
  const pickerEl = el.querySelector('#picker');
  const messagesEl = el.querySelector('#messages');
  const skillMenuEl = el.querySelector('#skill-menu');
  const skillBtnEl = el.querySelector('#skill-btn');
  const inputEl = el.querySelector('#input');
  const sendEl = el.querySelector('#send');
  const modelEl = el.querySelector('#chat-model');
  const noticeEl = el.querySelector('#model-notice');
  modelEl.onclick = async () => {
    if (sending || !entry) return;
    if (await openModelPicker(entry)) {
      noticeEl.hidden = true;
      updateModel();
    }
  };

  function updateModel() {
    modelEl.hidden = !entry || entry.format === 'openclaw';
    if (entry) modelEl.querySelector('.current-model').textContent = modelLabel(entry);
    modelEl.disabled = sending;
    sendEl.disabled = sending || !entry;
    skillBtnEl.disabled = sending || !entry;
    pickerEl.querySelectorAll('button').forEach((b) => { b.disabled = sending; });
  }

  function hideSkillMenu() {
    skillMenuEl.classList.add('hidden');
    skillMenuEl.innerHTML = '';
  }

  function showSkillMenu(filterText) {
    const q = (filterText || '').toLowerCase();
    const matches = SKILLS.filter((s) => s.cmd.startsWith(q || '/'));
    if (matches.length === 0) {
      hideSkillMenu();
      return;
    }
    skillMenuEl.innerHTML = '';
    for (const s of matches) {
      const row = h(`
        <button class="skill-item">
          <span class="skill-cmd">${s.cmd}</span>
          <span class="skill-label">${s.label}</span>
        </button>
      `);
      row.onclick = () => {
        inputEl.value = s.needsArgs ? `${s.cmd} ` : s.cmd;
        inputEl.focus();
        if (!s.needsArgs) {
          hideSkillMenu();
          send();
        } else {
          showSkillMenu(s.cmd);
        }
      };
      skillMenuEl.appendChild(row);
    }
    skillMenuEl.classList.remove('hidden');
  }

  skillBtnEl.onclick = () => {
    if (!skillMenuEl.classList.contains('hidden')) {
      hideSkillMenu();
      return;
    }
    inputEl.value = '/';
    inputEl.focus();
    showSkillMenu('/');
  };

  inputEl.addEventListener('input', () => {
    if (inputEl.value.startsWith('/')) showSkillMenu(inputEl.value.split(' ')[0]);
    else hideSkillMenu();
  });

  async function loadPicker(preferredId) {
    providers = await listRegisteredProviders();
    if (preferredId) entry = providers.find((p) => p.id === preferredId) || null;
    if (!entry && providers.length > 0) entry = providers[0];
    renderPicker();
    if (entry) await hydrateMessages(entry);
  }

  function renderPicker() {
    pickerEl.innerHTML = '';

    if (providers.length === 0) {
      const emptyProvider = h(`
        <button class="chip" style="background:var(--accent-tint);color:var(--accent-ink);">
          + Hubungkan Provider AI
        </button>
      `);
      emptyProvider.onclick = () => navigate('/settings/add-api-key?type=provider');
      const emptyAgent = h(`
        <button class="chip" style="background:var(--ok-tint);color:var(--ok);">
          + Hubungkan Agent
        </button>
      `);
      emptyAgent.onclick = () => navigate('/settings/add-api-key?type=agent');
      pickerEl.appendChild(emptyProvider);
      pickerEl.appendChild(emptyAgent);
      return;
    }

    for (const p of providers) {
      const active = entry?.id === p.id;
      const chip = h(`
        <button class="chip ${active ? 'active' : ''}">
          ${icon(p.type === 'agent' ? 'layers' : 'spark')}<span>${escapeHtml(p.label)}</span>
        </button>
      `);
      chip.onclick = () => selectEntry(p);
      pickerEl.appendChild(chip);
    }

    updateModel();
  }

  async function selectEntry(next) {
    if (sending) return;
    entry = next;
    noticeEl.hidden = true;
    renderPicker();
    await hydrateMessages(next);
    if (disposed || entry !== next) return;
    renderMessages();
  }

  /** Loads this provider's saved history from Supabase the first time it's
   * opened in this page instance (messagesByEntry is otherwise just an
   * in-memory cache so re-selecting an already-open entry doesn't re-fetch). */
  async function hydrateMessages(target) {
    if (messagesByEntry.has(target.id)) return;
    const saved = await loadMessages(target.id);
    if (disposed) return;
    messagesByEntry.set(
      target.id,
      saved.length > 0
        ? saved
        : [{ text: `Hai! Kamu terhubung ke ${target.label}. Tanyakan apa saja.`, fromMe: false, local: true }]
    );
  }

  function bubble(text, fromMe, { isError = false } = {}) {
    const cls = fromMe ? 'me' : isError ? 'them error' : 'them';
    return h(`<div class="bubble ${cls}"><span>${escapeHtml(text)}</span></div>`);
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function renderMessages() {
    messagesEl.innerHTML = '';
    if (!entry) {
      const welcome = emptyState('Ide bagus dimulai dari obrolan.', 'Hubungkan provider atau agent di atas, lalu ceritakan apa yang ingin kamu kerjakan.', 'chat');
      welcome.classList.add('chat-welcome');
      const prompts = h('<div class="prompt-grid"></div>');
      for (const [label, prompt, mark] of [
        ['Cari ide', 'Bantu saya mencari ide untuk ', 'spark'],
        ['Susun rencana', 'Bantu saya menyusun rencana untuk ', 'calendar'],
        ['Rapikan tulisan', 'Bantu saya merapikan tulisan berikut: ', 'edit'],
      ]) {
        const button = h(`<button class="prompt-button">${icon(mark)}<span>${label}</span><span aria-hidden="true">↗</span></button>`);
        button.onclick = () => { inputEl.value = prompt; inputEl.focus(); };
        prompts.appendChild(button);
      }
      welcome.appendChild(prompts);
      messagesEl.appendChild(welcome);
      return;
    }
    const list = messagesByEntry.get(entry.id) || [
      { text: `Hai! Kamu terhubung ke ${entry.label}. Tanyakan apa saja.`, fromMe: false, local: true },
    ];
    messagesByEntry.set(entry.id, list);
    list.forEach((m) => messagesEl.appendChild(bubble(m.text, m.fromMe, m)));
    if (sending) messagesEl.appendChild(h('<div class="spinner" style="margin:0;width:18px;height:18px;"></div>'));
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function runSkill(text) {
    const [cmd, ...rest] = text.split(' ');
    const arg = rest.join(' ').trim();
    const list = messagesByEntry.get(entry.id) || [];
    messagesByEntry.set(entry.id, list);

    switch (cmd) {
      case '/system': {
        if (!arg) {
          list.push({ text: 'Pakai: /system <instruksi untuk AI>', fromMe: false, isError: true });
          break;
        }
        systemPromptByEntry.set(entry.id, arg);
        list.push({ text: `Instruksi sistem diatur: "${arg}"`, fromMe: false, local: true });
        break;
      }
      case '/clear': {
        list.length = 0;
        clearConversation(entry.id);
        break;
      }
      case '/help': {
        const lines = SKILLS.map((s) => `${s.hint} — ${s.label}`).join('\n');
        list.push({ text: `Perintah tersedia:\n${lines}`, fromMe: false, local: true });
        break;
      }
      default:
        list.push({ text: `Perintah tidak dikenal: ${cmd}. Ketik /help untuk daftar perintah.`, fromMe: false, isError: true });
    }
    renderMessages();
  }

  async function send() {
    const text = inputEl.value.trim();
    if (!text || sending || !entry) return;
    inputEl.value = '';
    hideSkillMenu();

    if (text.startsWith('/')) {
      runSkill(text);
      return;
    }

    const list = messagesByEntry.get(entry.id) || [];
    const requestEntry = entry;
    messagesByEntry.set(entry.id, list);
    list.push({ text, fromMe: true });
    sending = true;
    updateModel();
    renderMessages();
    logActivity({ category: 'AI', title: `Pesan dikirim · ${entry.label}` });
    saveMessage(requestEntry.id, requestEntry.label, 'user', text);
    try {
      const systemPrompt = systemPromptByEntry.get(entry.id);
      const history = list.filter((m) => !m.isError && !m.local).map((m) => ({ role: m.fromMe ? 'user' : 'assistant', text: m.text }));
      const reply = await sendChat(
        requestEntry,
        systemPrompt ? [{ role: 'system', text: systemPrompt }, ...history] : history,
        { onModelChange(result) {
          if (disposed) return;
          updateModel();
          if (result.changed) {
            noticeEl.hidden = false;
            noticeEl.textContent = result.previousModel
              ? `Model sebelumnya tidak tersedia. Dialihkan ke ${result.model}.${result.persisted ? '' : ' Pilihan baru belum tersimpan; dipakai untuk sesi ini.'}`
              : `Model otomatis: ${result.model}.`;
          }
        },
        onSlotChange(newSlotLabel) {
          if (disposed) return;
          noticeEl.hidden = false;
          noticeEl.textContent = `Kunci sebelumnya kena limit — otomatis dialihkan ke kunci "${newSlotLabel}".`;
        } }
      );
      list.push({ text: reply, fromMe: false });
      saveMessage(requestEntry.id, requestEntry.label, 'assistant', reply);
    } catch (e) {
      list.push({ text: e.message, fromMe: false, isError: true });
    } finally {
      sending = false;
      if (!disposed) { updateModel(); renderMessages(); }
    }
  }

  sendEl.onclick = send;
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !matchMedia('(pointer: coarse)').matches) {
      e.preventDefault();
      send();
    }
  });

  const params = new URLSearchParams((location.hash.split('?')[1] || ''));
  await loadPicker(params.get('provider'));
  if (disposed) return { dispose() { disposed = true; } };
  titleEl.textContent = 'Chat';
  updateModel();
  renderMessages();
  return { dispose() { disposed = true; } };
}
