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
// Bot BPJS — nurse's own session history + export. Recording/STT/LLM
// happen natively (see bot_bpjs_screen.dart + bpjs_service.dart); this
// just lists what was recorded so the nurse can revisit, copy, or
// re-export a session's documentation. There is no doctor-account review
// step anymore (the Friend System this used to depend on was removed) —
// the finished draft is handed to the named doctor directly by the nurse.
// ---------------------------------------------------------------------

/** All BPJS sessions recorded by the signed-in nurse, newest first —
 * dokter_nama/dokter_instansi are plain typed text (no doctor account). */
export async function fetchNurseBpjsSessions() {
  const user = await currentUser();
  if (!user) return [];
  const { data } = await sb
    .from('bpjs_sessions')
    .select('*')
    .eq('perawat_id', user.id)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function fetchBpjsDocument(sessionId) {
  const { data } = await sb
    .from('bpjs_documents')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function fetchBpjsTranscript(sessionId) {
  const { data } = await sb
    .from('bpjs_transcripts')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp_offset_ms');
  return data ?? [];
}

/** Marks a session as handed off to the doctor (copied/printed/shared) —
 * purely a nurse-side record-keeping flag, not a doctor verdict. */
export async function markBpjsSessionSent(sessionId) {
  const { error } = await sb
    .from('bpjs_sessions')
    .update({ status: 'terkirim', updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

export function watchBpjsSessions(onChange) {
  const channel = sb
    .channel(`bpjs-sessions-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bpjs_sessions' }, onChange)
    .subscribe();
  return () => sb.removeChannel(channel);
}
