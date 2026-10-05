// Persists chat messages to Supabase so switching screens (or reopening the
// app) doesn't lose a conversation — chat.js used to keep messages only in
// an in-memory Map that died the moment its view was disposed by the
// router. `provider_label` is copied in at write time rather than joined
// from api_credentials, so a renamed or since-removed provider doesn't
// rewrite or orphan past messages.
import { sb, currentUser } from './db.js';

export async function saveMessage(providerId, providerLabel, role, content, isError = false) {
  const user = await currentUser();
  if (!user) return;
  await sb.from('chat_messages').insert({
    user_id: user.id,
    provider_id: providerId,
    provider_label: providerLabel,
    role,
    content,
    is_error: isError,
  });
}

/** Full message history for one provider, oldest first. */
export async function loadMessages(providerId) {
  const user = await currentUser();
  if (!user) return [];
  const { data } = await sb
    .from('chat_messages')
    .select('role,content,is_error,created_at')
    .eq('user_id', user.id)
    .eq('provider_id', providerId)
    .order('created_at');
  return (data || []).map((r) => ({
    text: r.content,
    fromMe: r.role === 'user',
    isError: r.is_error,
  }));
}

/** One row per provider that has at least one message, newest first —
 * what the History screen lists. */
export async function listConversations() {
  const user = await currentUser();
  if (!user) return [];
  const { data } = await sb
    .from('chat_messages')
    .select('provider_id,provider_label,content,role,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  const seen = new Map();
  for (const r of data || []) {
    if (seen.has(r.provider_id)) continue;
    seen.set(r.provider_id, {
      id: r.provider_id,
      label: r.provider_label,
      lastMessage: r.content,
      lastFromMe: r.role === 'user',
      lastAt: r.created_at,
    });
  }
  return [...seen.values()];
}

export async function clearConversation(providerId) {
  const user = await currentUser();
  if (!user) return;
  await sb.from('chat_messages').delete().eq('user_id', user.id).eq('provider_id', providerId);
}
