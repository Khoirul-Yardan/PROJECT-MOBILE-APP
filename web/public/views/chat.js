import { h } from '../ui.js';
import { currentUser, fetchFriendships, fetchMessages, sendMessage, watchMessages, logActivity } from '../db.js';
import { sendChat, hasApiKey, PROVIDERS } from '../ai.js';

export default async function render(root) {
  const user = await currentUser();
  let provider = 'openai';
  let peer = null; // null = AI Assistant
  let aiEnabled = false;
  let sending = false;
  let unwatch = null;

  const aiMessages = [
    { text: 'Hi! Add your API key in Settings, then ask me anything.', fromMe: false },
  ];
  const aiEchoByPeer = new Map();

  const el = h(`
    <div>
      <div class="topbar">
        <h1 id="chat-title">AI Chat</h1>
      </div>
      <div id="picker" class="tabs"></div>
      <div class="row" style="background:var(--field);border-radius:14px;padding:6px 12px;margin-bottom:14px;">
        <select id="provider" style="border:none;background:transparent;flex:1;font-weight:600;font-size:13px;">
          ${Object.entries(PROVIDERS).map(([id, i]) => `<option value="${id}">${i.label}</option>`).join('')}
        </select>
        <label id="ai-toggle-wrap" class="row" style="display:none;gap:6px;">
          <span style="font-size:15px;">✨</span>
          <span class="switch"><input id="ai-toggle" type="checkbox"/><span class="track"></span></span>
        </label>
      </div>
      <div id="messages" class="chat-scroll"></div>
      <div class="chat-input-row">
        <textarea id="input" rows="1" placeholder="Ask anything..."></textarea>
        <button id="send" class="send-btn">➤</button>
      </div>
    </div>
  `);
  root.appendChild(el);

  const titleEl = el.querySelector('#chat-title');
  const pickerEl = el.querySelector('#picker');
  const providerEl = el.querySelector('#provider');
  const toggleWrap = el.querySelector('#ai-toggle-wrap');
  const toggleEl = el.querySelector('#ai-toggle');
  const messagesEl = el.querySelector('#messages');
  const inputEl = el.querySelector('#input');
  const sendEl = el.querySelector('#send');

  providerEl.onchange = () => (provider = providerEl.value);
  toggleEl.onchange = () => (aiEnabled = toggleEl.checked);

  async function loadPicker() {
    const friendships = await fetchFriendships();
    const friends = friendships
      .filter((f) => f.status === 'accepted')
      .map((f) => ({ id: f.other_profile?.id ?? (f.requester_id === user.id ? f.addressee_id : f.requester_id), name: f.other_profile?.display_name ?? 'Friend' }));
    pickerEl.innerHTML = '';
    const aiChip = h(`<button class="chip ${peer === null ? 'active' : ''}">✨ AI Assistant</button>`);
    aiChip.onclick = () => selectPeer(null);
    pickerEl.appendChild(aiChip);
    for (const f of friends) {
      const chip = h(`<button class="chip ${peer?.id === f.id ? 'active' : ''}">👤 ${f.name}</button>`);
      chip.onclick = () => selectPeer(f);
      pickerEl.appendChild(chip);
    }
  }

  function selectPeer(next) {
    peer = next;
    titleEl.textContent = peer ? peer.name : 'AI Chat';
    toggleWrap.style.display = peer ? 'flex' : 'none';
    loadPicker();
    renderMessages();
    watchPeer();
  }

  function bubble(text, fromMe, { isAi = false, isError = false } = {}) {
    const cls = fromMe ? 'me' : isError ? 'them error' : isAi ? 'ai-echo' : 'them';
    return h(`
      <div class="bubble ${cls}">
        ${isAi ? '<span class="tag">AI (only you see this)</span>' : ''}
        <span>${escapeHtml(text)}</span>
      </div>
    `);
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  async function renderMessages() {
    messagesEl.innerHTML = '';
    if (peer === null) {
      aiMessages.forEach((m) => messagesEl.appendChild(bubble(m.text, m.fromMe, m)));
    } else {
      const remote = (await fetchMessages(peer.id)).map((m) => ({
        text: m.body,
        fromMe: m.sender_id === user.id,
        time: m.created_at,
      }));
      const echo = aiEchoByPeer.get(peer.id) || [];
      const all = [...remote, ...echo].sort((a, b) => new Date(a.time) - new Date(b.time));
      if (all.length === 0) {
        messagesEl.appendChild(h(`<div class="empty-state">Say hi to ${peer.name}!</div>`));
      } else {
        all.forEach((m) => messagesEl.appendChild(bubble(m.text, m.fromMe, m)));
      }
    }
    if (sending) messagesEl.appendChild(h('<div class="spinner" style="margin:0;width:18px;height:18px;"></div>'));
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function watchPeer() {
    if (unwatch) unwatch();
    unwatch = peer ? watchMessages(peer.id, () => renderMessages()) : null;
  }

  async function requireKey() {
    const has = await hasApiKey(provider);
    if (!has) {
      aiMessages.push({
        text: `No API key saved for ${PROVIDERS[provider].label} yet. Add one in Settings.`,
        fromMe: false,
        isError: true,
      });
      renderMessages();
    }
    return has;
  }

  async function send() {
    const text = inputEl.value.trim();
    if (!text || sending) return;
    inputEl.value = '';
    if (peer === null) {
      if (!(await requireKey())) return;
      aiMessages.push({ text, fromMe: true });
      sending = true;
      renderMessages();
      logActivity({ category: 'AI', title: `Chat message sent · ${PROVIDERS[provider].label}` });
      try {
        const reply = await sendChat(
          provider,
          aiMessages.filter((m) => !m.isError).map((m) => ({ role: m.fromMe ? 'user' : 'assistant', text: m.text }))
        );
        aiMessages.push({ text: reply, fromMe: false });
      } catch (e) {
        aiMessages.push({ text: e.message, fromMe: false, isError: true });
      } finally {
        sending = false;
        renderMessages();
      }
    } else {
      await sendMessage(peer.id, text);
      renderMessages();
      if (!aiEnabled) return;
      if (!(await requireKey())) return;
      sending = true;
      renderMessages();
      const echo = aiEchoByPeer.get(peer.id) || [];
      aiEchoByPeer.set(peer.id, echo);
      try {
        const reply = await sendChat(provider, [{ role: 'user', text }]);
        echo.push({ text: reply, fromMe: false, isAi: true, time: new Date().toISOString() });
      } catch (e) {
        echo.push({ text: e.message, fromMe: false, isAi: true, isError: true, time: new Date().toISOString() });
      } finally {
        sending = false;
        renderMessages();
      }
    }
  }

  sendEl.onclick = send;
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  await loadPicker();
  await renderMessages();

  return {
    dispose() {
      if (unwatch) unwatch();
    },
  };
}
