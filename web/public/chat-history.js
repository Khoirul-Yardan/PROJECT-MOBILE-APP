// Persists chat messages to Supabase so switching screens (or reopening the
// app) doesn't lose a conversation — chat.js used to keep messages only in
// an in-memory Map that died the moment its view was disposed by the
// router. `provider_label` is copied in at write time rather than joined
// from api_credentials, so a renamed or since-removed provider doesn't
// rewrite or orphan past messages.
//
// Messages are grouped into sessions (`session_id`) so a provider/agent can
// have more than one conversation thread — "Sesi Baru" in chat.js starts a
// fresh one without discarding the old thread, which stays reachable from
// the History screen.
import { sb, currentUser } from './db.js';

export async function saveMessage(providerId, providerLabel, sessionId, role, content, isError = false) {
  const user = await currentUser();
  if (!user) return;
  await sb.from('chat_messages').insert({
    user_id: user.id,
    provider_id: providerId,
    provider_label: providerLabel,
    session_id: sessionId,
    role,
    content,
    is_error: isError,
  });
}

/** Full message history for one session, oldest first. */
export async function loadMessages(providerId, sessionId) {
  const user = await currentUser();
  if (!user) return [];
  const { data } = await sb
    .from('chat_messages')
    .select('role,content,is_error,created_at')
    .eq('user_id', user.id)
    .eq('provider_id', providerId)
    .eq('session_id', sessionId)
    .order('created_at');
  return (data || []).map((r) => ({
    text: r.content,
    fromMe: r.role === 'user',
    isError: r.is_error,
  }));
}

/** The most recent session for this provider — what Chat opens into by
 * default when you pick that provider, instead of always starting fresh.
 * Returns null if this provider has no messages yet at all (caller should
 * mint a new session id itself in that case). */
export async function getLatestSessionId(providerId) {
  const user = await currentUser();
  if (!user) return null;
  const { data } = await sb
    .from('chat_messages')
    .select('session_id')
    .eq('user_id', user.id)
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.session_id ?? null;
}

/** One row per session that has at least one message, newest first — what
 * the History screen lists. Several rows can share the same provider_id
 * when that AI/agent has more than one session. */
export async function listConversations() {
  const user = await currentUser();
  if (!user) return [];
  const { data } = await sb
    .from('chat_messages')
    .select('provider_id,provider_label,session_id,content,role,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  const seen = new Map();
  for (const r of data || []) {
    if (seen.has(r.session_id)) continue;
    seen.set(r.session_id, {
      id: r.provider_id,
      sessionId: r.session_id,
      label: r.provider_label,
      lastMessage: r.content,
      lastFromMe: r.role === 'user',
      lastAt: r.created_at,
    });
  }
  return [...seen.values()];
}

/** Deletes just this one session's messages — used by `/clear`, which
 * clears the conversation currently open, not every session this provider
 * has ever had. */
export async function clearConversation(providerId, sessionId) {
  const user = await currentUser();
  if (!user) return;
  await sb
    .from('chat_messages')
    .delete()
    .eq('user_id', user.id)
    .eq('provider_id', providerId)
    .eq('session_id', sessionId);
}
