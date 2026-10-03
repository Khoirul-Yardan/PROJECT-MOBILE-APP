import { h, escapeHtml } from '../ui.js';
import { sendChat, listRegisteredProviders } from '../ai.js';
import { logActivity } from '../db.js';
import { navigate } from '../router.js';
import { conversation, selectedConversation, selectConversation, watchChat, notifyChat } from '../chat-state.js';

const commands = [['/system', 'Atur instruksi sistem'], ['/clear', 'Bersihkan percakapan'], ['/help', 'Lihat perintah']];

export default async function render(root) {
  let entry = null;
  let providers = [];
  const el = h(`<div class="page chat-page">
    <div class="topbar"><h1>Chat</h1></div>
    <div class="chat-service"><label for="picker">Layanan</label><select id="picker"><option>Memuat layanan…</option></select><div id="model" class="chat-meta"></div></div>
    <p class="chat-meta">Konteks terpisah per layanan. Percakapan belum tersimpan permanen; muat ulang akan menghapusnya.</p>
    <div id="messages" class="chat-scroll" aria-label="Pesan"></div>
    <button id="new-message" class="btn-text" hidden>Pesan baru ↓</button>
    <div id="waiting" class="chat-meta" role="status"></div>
    <div id="skill-menu" class="skill-menu hidden"></div>
    <div class="chat-input-row"><button id="skill-btn" class="icon-btn" aria-label="Buka perintah" aria-expanded="false">/</button>
      <textarea id="input" aria-label="Pesan" rows="1" placeholder="Tulis pesan…"></textarea>
      <button id="send" class="send-btn" aria-label="Kirim pesan">→</button></div>
  </div>`);
  root.appendChild(el);
  const $ = s => el.querySelector(s);
  const input = $('#input'), picker = $('#picker'), messages = $('#messages');
  const fitViewport = () => {
    if (!el.isConnected) return;
    const viewport = window.visualViewport;
    const top = el.getBoundingClientRect().top;
    const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-space')) || 0;
    el.style.height = `${Math.max(180, (viewport?.height || innerHeight) + (viewport?.offsetTop || 0) - top - nav - 16)}px`;
  };
  window.visualViewport?.addEventListener('resize', fitViewport);
  window.addEventListener('resize', fitViewport);
  requestAnimationFrame(fitViewport);
  function menu(show) {
    $('#skill-menu').classList.toggle('hidden', !show);
    $('#skill-btn').setAttribute('aria-expanded', String(show));
  }
  $('#skill-btn').onclick = () => menu($('#skill-menu').classList.contains('hidden'));
  for (const [cmd, label] of commands) {
    const b = h(`<button class="skill-item"><span class="skill-cmd">${cmd}</span><span>${label}</span></button>`);
    b.onclick = () => {
      if (!entry || conversation(entry.id).sending) return;
      if (cmd === '/system') {
        const value = window.prompt('Instruksi sistem untuk ' + entry.label, conversation(entry.id).system);
        if (value !== null) conversation(entry.id).system = value;
      } else runCommand(cmd);
      menu(false); input.focus();
    };
    $('#skill-menu').appendChild(b);
  }
  function runCommand(text) {
    const state = conversation(entry.id);
    if (text === '/clear') {
      if (state.messages.length && !window.confirm(`Hapus percakapan ${entry.label}? Tindakan ini tidak dapat dibatalkan.`)) return false;
      state.messages.length = 0;
    } else if (text.startsWith('/system ')) state.system = text.slice(8).trim();
    else state.messages.push({ text: '/system <instruksi> — Atur instruksi sistem\n/clear — Bersihkan percakapan\n/help — Lihat perintah', local: true });
    paint(true); return true;
  }
  function paint(force = false) {
    const nearEnd = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
    const oldScroll = messages.scrollTop;
    const state = entry ? conversation(entry.id) : null;
    messages.replaceChildren();
    if (!state?.messages.length) messages.appendChild(h(`<div class="empty-state">${entry ? 'Tulis pesan untuk memulai percakapan.' : 'Tambahkan layanan di Pengaturan untuk mulai chat.'}</div>`));
    for (const m of state?.messages || []) {
      const bubble = h(`<div class="bubble ${m.fromMe ? 'me' : 'them'} ${m.error ? 'error' : ''}"><span class="tag">${escapeHtml(m.fromMe ? 'Anda' : m.local ? 'Info' : entry.label)}</span><span>${escapeHtml(m.text)}</span></div>`);
      if (m.error) {
        bubble.appendChild(h(`<p role="alert">${escapeHtml(m.error)}</p>`));
        const retry = h('<button class="btn-text">Coba lagi</button>');
        retry.disabled = state.sending;
        retry.onclick = () => request(entry, state, m);
        bubble.appendChild(retry);
      }
      messages.appendChild(bubble);
    }
    picker.disabled = !!state?.sending || !entry;
    $('#send').disabled = !entry || !!state?.sending;
    $('#skill-btn').disabled = !entry || !!state?.sending;
    input.disabled = !entry;
    $('#waiting').textContent = state?.sending ? `Menunggu jawaban dari ${entry.label}…` : '';
    if (nearEnd || force) { messages.scrollTop = messages.scrollHeight; $('#new-message').hidden = true; }
    else { messages.scrollTop = oldScroll; $('#new-message').hidden = false; }
  }
  $('#new-message').onclick = () => { messages.scrollTop = messages.scrollHeight; $('#new-message').hidden = true; };
  function select(p) {
    entry = p; selectConversation(p.id); picker.value = p.id;
    $('#model').textContent = `${p.type === 'agent' ? 'Agent' : 'Provider'}${p.model ? ' · Model: ' + p.model : ''}`;
    input.value = conversation(p.id).input; paint(true);
  }
  picker.onchange = () => select(providers.find(p => p.id === picker.value));
  input.oninput = () => { if (entry) conversation(entry.id).input = input.value; };
  input.onkeydown = e => {
    if (e.key === 'Escape') menu(false);
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer:fine)').matches) { e.preventDefault(); send(); }
  };
  async function request(service, state, message) {
    if (state.sending) return;
    state.sending = true; delete message.error; notifyChat();
    try {
      const reply = await sendChat(service, message.history);
      const index = state.messages.indexOf(message);
      state.messages.splice(index + 1, 0, { text: reply });
    } catch (e) { message.error = `Jawaban gagal dimuat: ${e.message}`; }
    finally { state.sending = false; notifyChat(); }
  }
  function send() {
    const text = input.value.trim();
    if (!entry || !text || conversation(entry.id).sending) return;
    const state = conversation(entry.id);
    if (text.startsWith('/')) { if (!runCommand(text)) return; }
    else {
      const message = { text, fromMe: true };
      state.messages.push(message);
      message.history = state.messages.filter(m => !m.local && !m.error).map(m => ({ role: m.fromMe ? 'user' : 'assistant', text: m.text }));
      if (state.system) message.history.unshift({ role: 'system', text: state.system });
      request(entry, state, message);
      logActivity({ category: 'AI', title: `Pesan dikirim · ${entry.label}` });
    }
    input.value = ''; state.input = ''; menu(false); paint(true);
  }
  $('#send').onclick = send;
  async function load() {
    try {
      providers = await listRegisteredProviders(); picker.replaceChildren();
      for (const p of providers) { const option = document.createElement('option'); option.value = p.id; option.textContent = `${p.label} · ${p.type === 'agent' ? 'Agent' : 'Provider'}`; picker.appendChild(option); }
      if (providers.length) select(providers.find(p => p.id === selectedConversation()) || providers[0]);
      else {
        picker.appendChild(h('<option>Belum ada layanan</option>')); paint();
        const add = h('<button class="btn btn-outline">Tambah layanan</button>'); add.onclick = () => navigate('/settings/apikeys'); messages.appendChild(add);
      }
    } catch {
      paint(); messages.replaceChildren(h('<p role="alert">Layanan belum dapat dimuat.</p>'));
      const retry = h('<button class="btn-text">Coba lagi</button>'); retry.onclick = load; messages.appendChild(retry);
    }
  }
  const unwatch = watchChat(() => paint());
  await load();
  requestAnimationFrame(fitViewport);
  return { dispose() { unwatch(); window.visualViewport?.removeEventListener('resize', fitViewport); window.removeEventListener('resize', fitViewport); } };
}
