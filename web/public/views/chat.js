import { h, icon, emptyState, toast } from '../ui.js';
import { sendChat, listRegisteredProviders, getAgentSkills } from '../ai.js';
import { saveMessage, loadMessages, getLatestSessionId, clearConversation } from '../chat-history.js';
import { logActivity } from '../db.js';
import { navigate } from '../router.js';
import { openModelPicker, modelLabel } from '../model-picker.js';
import { Native } from '../bridge.js';
import { skillsFor, providerSkills } from '../skills.js';

// Telegram-style skill commands: type "/" as the first character, or tap
// the skill button next to the input, to get the same picker. What it lists
// follows the selected provider (see skills.js).

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
  // Which session (conversation thread) is currently open per provider —
  // "Sesi Baru" swaps this to a fresh id without touching the old thread,
  // which stays reachable from the History screen.
  const sessionIdByEntry = new Map();
  // Agent-reported toolsets from the A2A discovery card (GET
  // .well-known/agent.json) — shown in the "/" palette so the user knows
  // what the agent can actually do, since it uses these tools on its own
  // when it decides to, not via a local command (see getAgentSkills's note).
  const agentSkillsByEntry = new Map();
  let skillMenuQuery = null;
  // Per-provider set of enabled toggle skills (e.g. 'search' for Gemini).
  const toolsByEntry = new Map();
  const activeTools = (e) => [...(toolsByEntry.get(e.id) || [])];

  const el = h(`
    <div class="page chat-page">
      <div class="topbar">
        <h1 id="chat-title">Chat</h1>
        <div class="row" style="gap:8px;flex-shrink:0;">
          <button class="icon-button" id="new-session" aria-label="Sesi baru">${icon('edit')}</button>
          <button class="icon-button" id="chat-history" aria-label="Riwayat chat">${icon('clock')}</button>
          <button class="icon-button" id="manage-provider" aria-label="Kelola asisten">${icon('layers')}</button>
        </div>
      </div>
      <div id="picker" class="tabs"></div>
      <button id="chat-model" class="provider-model-control chat-model" hidden><span class="model-caption">Pilih model</span><span class="current-model"></span><span aria-hidden="true">⌄</span></button>
      <a id="direct-session-link" class="direct-session-link" hidden target="_blank" rel="noopener">Agent minta persetujuan langsung? Buka sesi Telegram ↗</a>
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
  el.querySelector('#new-session').onclick = () => startNewSession();

  const titleEl = el.querySelector('#chat-title');
  const pickerEl = el.querySelector('#picker');
  const messagesEl = el.querySelector('#messages');
  // Delegated, not per-image: renderMessages() rebuilds messagesEl's whole
  // innerHTML on every send/receive, which would detach a per-image
  // listener immediately — the parent container survives those rebuilds.
  messagesEl.addEventListener('click', (e) => {
    const img = e.target.closest('.chat-image');
    if (img) openImageLightbox(img.src, img.alt);
  });
  const skillMenuEl = el.querySelector('#skill-menu');
  const skillBtnEl = el.querySelector('#skill-btn');
  const newSessionEl = el.querySelector('#new-session');
  const inputEl = el.querySelector('#input');
  const sendEl = el.querySelector('#send');
  const modelEl = el.querySelector('#chat-model');
  const noticeEl = el.querySelector('#model-notice');
  const directSessionEl = el.querySelector('#direct-session-link');
  modelEl.onclick = async () => {
    if (sending || !entry) return;
    if (await openModelPicker(entry)) {
      noticeEl.hidden = true;
      updateModel();
    }
  };

  // No model-selection concept for self-hosted agent formats (a2a/openclaw)
  // — they don't expose a model list the way a provider API does.
  const NO_MODEL_FORMATS = new Set(['openclaw', 'a2a', 'hermes-api']);

  function updateModel() {
    modelEl.hidden = !entry || NO_MODEL_FORMATS.has(entry.format);
    if (entry) modelEl.querySelector('.current-model').textContent = modelLabel(entry);
    modelEl.disabled = sending;
    sendEl.disabled = sending || !entry;
    skillBtnEl.disabled = sending || !entry;
    newSessionEl.disabled = sending || !entry;
    pickerEl.querySelectorAll('button').forEach((b) => { b.disabled = sending; });
    // 'model' is repurposed to hold this optional link for self-hosted
    // agents (see add-api-key.js) — shown so the user has a one-tap way to
    // the real direct session an agent might ask for (e.g. Hermes Agent
    // refusing a sensitive action requested over A2A, which it deliberately
    // never trusts, and asking for approval "in your direct session"
    // instead — there's no way to grant that through A2A itself).
    directSessionEl.hidden = !entry || !NO_MODEL_FORMATS.has(entry.format) || !entry.model;
    if (entry?.model) directSessionEl.href = entry.model;
  }

  function hideSkillMenu() {
    skillMenuQuery = null;
    skillMenuEl.classList.add('hidden');
    skillMenuEl.innerHTML = '';
  }

  function showSkillMenu(filterText) {
    skillMenuQuery = filterText || '/';
    const q = (skillMenuQuery || '/').toLowerCase();
    const common = skillsFor(null).filter((s) => s.cmd.startsWith(q));
    const own = providerSkills(entry).filter((s) => s.cmd.startsWith(q));
    const agentSkills = (entry ? agentSkillsByEntry.get(entry.id) || [] : [])
      .filter((s) => `/${s.name}`.toLowerCase().startsWith(q));
    if (common.length === 0 && own.length === 0 && agentSkills.length === 0) {
      hideSkillMenu();
      return;
    }
    skillMenuEl.innerHTML = '';
    const heading = (text) => skillMenuEl.appendChild(h(`<div class="skill-menu-heading">${escapeHtml(text)}</div>`));

    // Provider-specific first: it's the part that differs per provider, and
    // the menu scrolls, so it must not sit below the shared commands.
    if (own.length > 0) heading(`Khusus ${entry.label}`);
    for (const s of own) skillMenuEl.appendChild(localSkillRow(s));

    if (agentSkills.length > 0) {
      heading(`Kemampuan ${entry.label}`);
      for (const s of agentSkills) {
        const row = h(`
          <button class="skill-item">
            <span class="skill-cmd">/${escapeHtml(s.name)}</span>
            <span class="skill-label">${escapeHtml(s.description || '')}</span>
          </button>
        `);
        // A real command, not a draft sentence: inserts "/web " and the
        // user just types their request after it, same as /system — the
        // whole thing (slash included) is sent straight to the agent as
        // the message, which already understands it in plain language
        // (see send()'s localCmd check: anything not matching a local
        // command just passes through as-is).
        row.onclick = () => {
          inputEl.value = `/${s.name} `;
          hideSkillMenu();
          inputEl.focus();
        };
        skillMenuEl.appendChild(row);
      }
    }

    if (common.length > 0) {
      if (own.length > 0 || agentSkills.length > 0) heading('Umum');
      for (const s of common) skillMenuEl.appendChild(localSkillRow(s));
    }
    skillMenuEl.classList.remove('hidden');
  }

  function localSkillRow(s) {
    const on = s.toggle && (toolsByEntry.get(entry.id) || new Set()).has(s.toggle);
    const row = h(`
      <button class="skill-item" ${s.toggle ? `data-toggle="${s.toggle}" aria-pressed="${on ? 'true' : 'false'}"` : ''}>
        <span class="skill-cmd">${s.cmd}</span>
        <span class="skill-label">${s.label}${s.toggle ? (on ? ' — AKTIF' : ' — mati') : ''}</span>
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
    return row;
  }

  /** Fetches and caches this provider's A2A toolset list (if it has one)
   * the first time it's opened — a no-op for non-A2A entries. Re-renders an
   * open skill menu once it resolves, since the first open right after
   * connecting won't have it cached yet. */
  async function prefetchAgentSkills(target) {
    if (target.format !== 'a2a' || agentSkillsByEntry.has(target.id)) return;
    const skills = await getAgentSkills(target);
    if (disposed) return;
    agentSkillsByEntry.set(target.id, skills);
    if (skillMenuQuery !== null && entry?.id === target.id) showSkillMenu(skillMenuQuery);
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

  async function loadPicker(preferredId, preferredSessionId) {
    providers = await listRegisteredProviders();
    if (preferredId) entry = providers.find((p) => p.id === preferredId) || null;
    if (!entry && providers.length > 0) entry = providers[0];
    renderPicker();
    if (entry) {
      if (preferredSessionId && entry.id === preferredId) sessionIdByEntry.set(entry.id, preferredSessionId);
      await hydrateMessages(entry);
    }
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

  /** Loads this provider's current session from Supabase the first time
   * it's opened in this page instance (messagesByEntry is otherwise just
   * an in-memory cache so re-selecting an already-open entry doesn't
   * re-fetch). Picks up the most recent session if one exists, or mints a
   * fresh session id for a provider that's never been chatted with yet. */
  async function hydrateMessages(target) {
    prefetchAgentSkills(target);
    if (messagesByEntry.has(target.id)) return;
    let sessionId = sessionIdByEntry.get(target.id);
    if (!sessionId) {
      sessionId = (await getLatestSessionId(target.id)) || crypto.randomUUID();
      if (disposed) return;
      sessionIdByEntry.set(target.id, sessionId);
    }
    const saved = await loadMessages(target.id, sessionId);
    if (disposed) return;
    messagesByEntry.set(
      target.id,
      saved.length > 0
        ? saved
        : [{ text: `Hai! Kamu terhubung ke ${target.label}. Tanyakan apa saja.`, fromMe: false, local: true }]
    );
  }

  /** Starts a fresh conversation thread for the active provider — the old
   * thread isn't deleted, just no longer the one shown here; it stays
   * reachable from the History screen. */
  function startNewSession() {
    if (sending || !entry) return;
    sessionIdByEntry.set(entry.id, crypto.randomUUID());
    messagesByEntry.set(entry.id, [
      { text: `Sesi baru dengan ${entry.label} dimulai.`, fromMe: false, local: true },
    ]);
    noticeEl.hidden = true;
    renderMessages();
  }

  function guessImageFilename(src) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dataMatch = src.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/);
    if (dataMatch) {
      const ext = dataMatch[1] === 'jpeg' ? 'jpg' : dataMatch[1].replace(/[^a-z0-9]/gi, '');
      return `ai-hub-image-${stamp}.${ext || 'png'}`;
    }
    try {
      const pathExt = new URL(src).pathname.match(/\.([a-zA-Z0-9]+)$/)?.[1];
      if (pathExt && /^(png|jpe?g|gif|webp|bmp)$/i.test(pathExt)) return `ai-hub-image-${stamp}.${pathExt}`;
    } catch {
      /* not a parseable absolute URL — fall through to the default */
    }
    return `ai-hub-image-${stamp}.png`;
  }

  async function downloadImage(src) {
    const filename = guessImageFilename(src);
    if (Native.attached) {
      const payload = src.startsWith('data:') ? { dataUrl: src, filename } : { url: src, filename };
      const result = await Native.saveImage(payload);
      if (result?.ok) toast('Gambar disimpan — pilih tujuan di menu share.');
      else toast(result?.message || 'Gagal menyimpan gambar.');
      return;
    }
    // Plain-browser dev preview: a real <a download> works directly for
    // data: URIs; for a cross-origin https image it may just open a new
    // tab instead (no native share sheet to fall back to here), same class
    // of browser-only limitation as other web-only fallbacks in this app.
    const a = document.createElement('a');
    a.href = src;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function openImageLightbox(src, alt) {
    const overlay = h(`
      <div class="image-lightbox" role="dialog" aria-modal="true">
        <button type="button" class="image-lightbox-close" aria-label="Tutup">${icon('close')}</button>
        <img src="${src}" alt="${escapeAttr(alt || '')}" />
        <button type="button" class="image-lightbox-download">${icon('download')}<span>Unduh</span></button>
      </div>
    `);
    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('.image-lightbox-close').onclick = close;
    overlay.querySelector('.image-lightbox-download').onclick = () => downloadImage(src);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  }

  function bubble(text, fromMe, { isError = false } = {}) {
    const cls = fromMe ? 'me' : isError ? 'them error' : 'them';
    // Agent/AI replies often come back as literal Markdown (**bold**, "- "
    // bullets) — an LLM writing for a chat UI, not knowing this one didn't
    // render it, so it shows as raw asterisks. User's own messages don't
    // need this (they rarely type Markdown on purpose), kept as plain
    // escaped text.
    const content = fromMe ? escapeHtml(text) : formatMarkdownLite(text);
    return h(`<div class="bubble ${cls}"><span>${content}</span></div>`);
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // escapeHtml's textContent/innerHTML round-trip only escapes &, <, > —
  // correct for text *content*, but " stays literal, which is exactly the
  // character that breaks out of a quoted HTML attribute. Needed wherever a
  // value lands inside src="..."/alt="..." rather than between tags.
  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // For text that already went through escapeHtml (so &/</> are already
  // entities) and now additionally needs to land inside an attribute —
  // escapeAttr here would double-escape the &; this only adds the one
  // thing escapeHtml's text-content escaping doesn't cover.
  function escapeQuotesOnly(s) {
    return String(s).replace(/"/g, '&quot;');
  }

  /** Just enough Markdown to stop raw '**'/'- '/'![]()' showing up literally
   * in a chat bubble — not a full renderer. Escapes first, then only turns
   * already-escaped text into **bold**, "- "/"* " bullets into "• ", and
   * ![alt](url) into a real <img>, so there's no way for the source text to
   * inject real HTML — the image URL itself is re-validated against a
   * strict allowlist (see IMAGE_URL_RE) rather than trusted just because it
   * survived escapeHtml, since it's about to land inside an attribute
   * rather than text content. Agents (e.g. Hermes computer_use screenshots)
   * send images this way — same Markdown shape as normal LLM replies,
   * just with a data: URI instead of a link. */
  const IMAGE_URL_RE = /^(?:data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+|https:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+)$/;

  function formatMarkdownLite(text) {
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|\n)[-*]\s+/g, '$1• ');
    html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt, url) => {
      if (!IMAGE_URL_RE.test(url)) return match;
      return `<img src="${url}" alt="${escapeQuotesOnly(alt)}" class="chat-image" loading="lazy" />`;
    });
    return html;
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
        clearConversation(entry.id, sessionIdByEntry.get(entry.id));
        break;
      }
      case '/help': {
        const lines = skillsFor(entry).map((s) => `${s.hint} — ${s.label}`).join('\n');
        list.push({ text: `Perintah tersedia:\n${lines}`, fromMe: false, local: true });
        break;
      }
      default: {
        const toggleSkill = providerSkills(entry).find((s) => s.cmd === cmd && s.toggle);
        if (toggleSkill) {
          const set = toolsByEntry.get(entry.id) || new Set();
          toolsByEntry.set(entry.id, set);
          const nowOn = !set.has(toggleSkill.toggle);
          if (nowOn) set.add(toggleSkill.toggle); else set.delete(toggleSkill.toggle);
          list.push({ text: `${toggleSkill.label}: ${nowOn ? 'AKTIF' : 'dimatikan'} untuk ${entry.label}.`, fromMe: false, local: true });
          break;
        }
        list.push({ text: `Perintah tidak dikenal: ${cmd}. Ketik /help untuk daftar perintah.`, fromMe: false, isError: true });
      }
    }
    renderMessages();
  }

  async function send() {
    const text = inputEl.value.trim();
    if (!text || sending || !entry) return;
    inputEl.value = '';
    hideSkillMenu();

    // Only our own 3 meta-commands get intercepted locally — anything else
    // starting with "/" (including an agent-skill command like "/web ..."
    // inserted from the palette above) is just sent through as the message
    // text as-is. The agent reads it in plain language and decides on its
    // own whether/how to use a tool; there's no local "run this skill" step.
    const localCmd = skillsFor(entry).find((s) => text === s.cmd || text.startsWith(`${s.cmd} `));
    if (localCmd) {
      runSkill(text);
      return;
    }

    const list = messagesByEntry.get(entry.id) || [];
    const requestEntry = entry;
    const sessionId = sessionIdByEntry.get(requestEntry.id);
    messagesByEntry.set(entry.id, list);
    list.push({ text, fromMe: true });
    sending = true;
    updateModel();
    renderMessages();
    logActivity({ category: 'AI', title: `Pesan dikirim · ${entry.label}` });
    saveMessage(requestEntry.id, requestEntry.label, sessionId, 'user', text);
    try {
      const systemPrompt = systemPromptByEntry.get(entry.id);
      const history = list.filter((m) => !m.isError && !m.local).map((m) => ({ role: m.fromMe ? 'user' : 'assistant', text: m.text }));
      const reply = await sendChat(
        requestEntry,
        systemPrompt ? [{ role: 'system', text: systemPrompt }, ...history] : history,
        { tools: activeTools(requestEntry), onModelChange(result) {
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
      saveMessage(requestEntry.id, requestEntry.label, sessionId, 'assistant', reply);
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
  await loadPicker(params.get('provider'), params.get('session'));
  if (disposed) return { dispose() { disposed = true; } };
  titleEl.textContent = 'Chat';
  updateModel();
  renderMessages();
  return { dispose() { disposed = true; } };
}
