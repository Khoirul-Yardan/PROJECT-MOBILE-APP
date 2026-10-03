// Memory only: retained across routes, cleared on account changes and refresh.
let owner = null;
let conversations = new Map();
const listeners = new Set();
let selected = null;
export const selectedConversation = () => selected;
export const selectConversation = id => { selected = id; };
export const watchChat = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const notifyChat = () => listeners.forEach(fn => fn());
export function setChatOwner(id) {
  if (owner !== id) { conversations = new Map(); owner = id; selected = null; }
}
export function conversation(id) {
  if (!conversations.has(id)) conversations.set(id, { messages: [], input: '', system: '', sending: false });
  return conversations.get(id);
}
export function confirmLeaveChat() {
  return ![...conversations.values()].some(c => c.messages.length || c.input || c.sending) ||
    window.confirm('Keluar akan menghapus percakapan dan pesan yang belum tersimpan permanen. Tetap keluar?');
}

