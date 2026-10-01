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
  // A fixed channel name broke when two views subscribed in close
  // succession (e.g. Supabase's own auth-refresh on tab-visibility-change
  // re-rendering Home while a previous subscribe hadn't been torn down
  // yet) — the realtime client rejects a second `.on()` on a topic that's
  // already subscribed. A unique name per call sidesteps that entirely;
  // the channel is still cleaned up via the returned unsubscribe function.
  const channel = sb
    .channel(`activity-log-changes-${Math.random().toString(36).slice(2)}`)
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

// ---------------------------------------------------------------------
// Friendships — the gate for Bot BPJS's "send to doctor" step (a nurse can
// only pick a doctor they're already connected with; see schema.sql's
// bpjs_sessions RLS, which checks accepted friendship before allowing a
// session row for that target doctor). Not folded into Chat: Chat picks a
// provider/agent to talk to, this picks a *person* you're accountable to.
// ---------------------------------------------------------------------

/** Search profiles by display name, excluding yourself and existing
 * relationships (so results are genuinely "people you could add"). */
export async function searchProfiles(query) {
  const user = await currentUser();
  if (!user || !query?.trim()) return [];
  const { data } = await sb
    .from('profiles')
    .select('id,display_name,role')
    .ilike('display_name', `%${query.trim()}%`)
    .neq('id', user.id)
    .limit(20);
  return data ?? [];
}

export async function sendFriendRequest(addresseeId) {
  const user = await currentUser();
  if (!user) throw new Error('Belum masuk akun.');
  const { error } = await sb.from('friendships').insert({
    requester_id: user.id,
    addressee_id: addresseeId,
    status: 'pending',
  });
  if (error) throw error;
}

export async function respondToFriendRequest(friendshipId, accept) {
  const { error } = await sb
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'blocked', updated_at: new Date().toISOString() })
    .eq('id', friendshipId);
  if (error) throw error;
}

/** All relationships involving the signed-in user, each annotated with
 * `other_profile` (the other party) and `is_incoming` (true if the
 * signed-in user is the addressee — used to separate "requests to me"
 * from "people I've already connected with" in the UI). */
export async function fetchFriendships() {
  const user = await currentUser();
  if (!user) return [];
  const { data } = await sb
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .order('updated_at', { ascending: false });
  const rows = data ?? [];
  const otherIds = [...new Set(rows.map((r) => (r.requester_id === user.id ? r.addressee_id : r.requester_id)))];
  let profilesById = {};
  if (otherIds.length > 0) {
    const { data: profiles } = await sb.from('profiles').select('id,display_name,role').in('id', otherIds);
    profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  }
  return rows.map((r) => ({
    ...r,
    is_incoming: r.addressee_id === user.id,
    other_profile: profilesById[r.requester_id === user.id ? r.addressee_id : r.requester_id] ?? null,
  }));
}

/** Accepted friends only, filtered to a role (e.g. 'dokter') when given —
 * this is what Bot BPJS's doctor picker calls instead of a hardcoded list. */
export async function fetchAcceptedFriends(role) {
  const all = await fetchFriendships();
  return all.filter((f) => f.status === 'accepted' && f.other_profile && (!role || f.other_profile.role === role));
}

export function watchFriendships(onChange) {
  const channel = sb
    .channel(`friendships-changes-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, onChange)
    .subscribe();
  return () => sb.removeChannel(channel);
}
