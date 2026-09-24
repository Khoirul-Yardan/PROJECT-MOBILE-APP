// Thin wrapper around the Supabase JS SDK (loaded via CDN in index.html as
// the `supabase` global) — mirrors what `SupabaseService` used to do in
// Dart, now running directly in the web page since auth/data no longer
// round-trip through the native shell.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function currentUser() {
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

export function onAuthChange(handler) {
  const { data } = sb.auth.onAuthStateChange((_event, session) => handler(session));
  return () => data.subscription.unsubscribe();
}

export const signUpWithEmail = (email, password) => sb.auth.signUp({ email, password });
export const signInWithEmail = (email, password) =>
  sb.auth.signInWithPassword({ email, password });
export const signOut = () => sb.auth.signOut();

export async function myProfile() {
  const user = await currentUser();
  if (!user) return null;
  const { data } = await sb.from('profiles').select().eq('id', user.id).maybeSingle();
  return data;
}

export async function upsertProfile(displayName, { role, bio } = {}) {
  const user = await currentUser();
  if (!user) return;
  const row = { id: user.id, display_name: displayName };
  if (role !== undefined) row.role = role;
  if (bio !== undefined) row.bio = bio;
  await sb.from('profiles').upsert(row);
}

export async function searchProfiles(query) {
  const user = await currentUser();
  if (!user || !query.trim()) return [];
  const { data } = await sb
    .from('profiles')
    .select()
    .ilike('display_name', `%${query.trim()}%`)
    .neq('id', user.id)
    .limit(20);
  return data ?? [];
}

export async function sendFriendRequest(addresseeId) {
  const user = await currentUser();
  if (!user) return;
  await sb.from('friendships').insert({ requester_id: user.id, addressee_id: addresseeId });
}

export async function respondFriendRequest(friendshipId, accept) {
  await sb
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'blocked', updated_at: new Date().toISOString() })
    .eq('id', friendshipId);
}

/** One-shot fetch of friendships + the other party's profile, newest first. */
export async function fetchFriendships() {
  const user = await currentUser();
  if (!user) return [];
  const { data: rows } = await sb
    .from('friendships')
    .select()
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .order('created_at', { ascending: false });
  if (!rows || rows.length === 0) return [];
  const otherIds = [
    ...new Set(rows.map((r) => (r.requester_id === user.id ? r.addressee_id : r.requester_id))),
  ];
  const { data: profiles } = await sb.from('profiles').select().in('id', otherIds);
  const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    is_incoming: r.addressee_id === user.id,
    other_profile: byId[r.requester_id === user.id ? r.addressee_id : r.requester_id],
  }));
}

/** Subscribes to realtime changes on `friendships`; returns an unsubscribe fn. */
export function watchFriendships(onChange) {
  const channel = sb
    .channel('friendships-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, onChange)
    .subscribe();
  return () => sb.removeChannel(channel);
}

export async function sendMessage(receiverId, body) {
  const user = await currentUser();
  if (!user) return;
  await sb.from('messages').insert({ sender_id: user.id, receiver_id: receiverId, body });
}

export async function fetchMessages(peerId) {
  const user = await currentUser();
  if (!user) return [];
  const { data } = await sb
    .from('messages')
    .select()
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${user.id})`
    )
    .order('created_at');
  return data ?? [];
}

export function watchMessages(peerId, onInsert) {
  const channel = sb
    .channel(`messages-${peerId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        const row = payload.new;
        onInsert(row);
      }
    )
    .subscribe();
  return () => sb.removeChannel(channel);
}

export async function logActivity({ category, title, subtitle, badge = 'Info' }) {
  const user = await currentUser();
  if (!user) return;
  try {
    await sb.from('activity_log').insert({
      user_id: user.id,
      category,
      title,
      subtitle,
      badge,
    });
  } catch (_) {
    // Best-effort, same as the native client.
  }
}

export function watchActivity(onChange) {
  const channel = sb
    .channel('activity-log-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, onChange)
    .subscribe();
  return () => sb.removeChannel(channel);
}

export async function fetchActivity() {
  const user = await currentUser();
  if (!user) return [];
  const { data } = await sb
    .from('activity_log')
    .select()
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  return data ?? [];
}
