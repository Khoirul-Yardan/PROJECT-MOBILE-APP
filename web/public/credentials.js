// AI provider/agent credentials, synced through the user's Supabase account
// instead of only living in one device's local storage — a key added on
// one browser/device is still there after a reinstall or on another
// device, which is the whole point (local-only storage was losing keys on
// every reinstall/browser-data-clear, which is what this replaces).
//
// Security note, read before assuming this is bulletproof: see
// secure_store.js's own note — same scheme, same caveats (RLS, not this
// encryption, is the real access control).
import { sb, currentUser } from './db.js';
import { encryptForUser, decryptForUser } from './secure_store.js';

const PEPPER = 'aihub-credentials-v1'; // not secret; just domain-separates the key derivation

async function encryptValue(uid, plaintext) {
  const { encrypted, iv } = await encryptForUser(uid, PEPPER, plaintext);
  return { encrypted_key: encrypted, iv };
}

async function decryptValue(uid, encryptedKey, iv) {
  return decryptForUser(uid, PEPPER, encryptedKey, iv);
}

/** entry: {id,label,type,format,endpoint,model}. One `id` (provider_id) can
 * now hold several rows ("slots") distinguished by `label` — e.g. two
 * Gemini keys saved as "Gemini" and "Gemini 2" — so multiple keys for the
 * same provider can be rotated through instead of the newest silently
 * overwriting the last one. */
export async function saveCredential(entry, apiKey) {
  const user = await currentUser();
  if (!user) throw new Error('Belum masuk akun.');
  const { encrypted_key, iv } = await encryptValue(user.id, apiKey);
  const { error } = await sb.from('api_credentials').upsert(
    {
      user_id: user.id,
      provider_id: entry.id,
      label: entry.label,
      type: entry.type,
      format: entry.format,
      endpoint: entry.endpoint,
      model: entry.model,
      encrypted_key,
      iv,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider_id,label' }
  );
  if (error) throw error;
}

/** Every saved slot, ungrouped — one row per key, even when several share a
 * provider_id. Used by the management screen (so each slot is individually
 * removable) and by the rotation logic in ai.js. */
export async function listCredentialSlots() {
  const user = await currentUser();
  if (!user) return [];
  const { data } = await sb
    .from('api_credentials')
    .select('id,provider_id,label,type,format,endpoint,model')
    .eq('user_id', user.id)
    .order('created_at');
  return (data || []).map((r) => ({
    slotId: r.id,
    id: r.provider_id,
    label: r.label,
    type: r.type,
    format: r.format,
    endpoint: r.endpoint,
    model: r.model,
  }));
}

/** Metadata only, one entry per provider_id — what the Chat picker and the
 * management screen show by default. Several key slots behind the same
 * provider_id collapse into a single entry (`slotCount` says how many),
 * using the first slot's metadata since every slot of the same provider
 * shares endpoint/format/model. */
export async function listCredentials() {
  const slots = await listCredentialSlots();
  const grouped = new Map();
  for (const s of slots) {
    const existing = grouped.get(s.id);
    if (existing) existing.slotCount++;
    else grouped.set(s.id, { id: s.id, label: s.label, type: s.type, format: s.format, endpoint: s.endpoint, model: s.model, slotCount: 1 });
  }
  return [...grouped.values()];
}

export async function hasCredential(providerId) {
  const user = await currentUser();
  if (!user) return false;
  const { data } = await sb
    .from('api_credentials')
    .select('id')
    .eq('user_id', user.id)
    .eq('provider_id', providerId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** How many key slots are already saved for this provider — used by the
 * "Add API key" screen to suggest the next slot name (e.g. "Gemini 2"). */
export async function countCredentialSlots(providerId) {
  const user = await currentUser();
  if (!user) return 0;
  const { count } = await sb
    .from('api_credentials')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('provider_id', providerId);
  return count || 0;
}

/** Decrypts every slot for this provider, oldest first — ai.js tries them
 * in this order and rotates to the next one on a rate-limit/quota error. */
export async function getCredentialKeySlots(providerId) {
  const user = await currentUser();
  if (!user) return [];
  const { data } = await sb
    .from('api_credentials')
    .select('id,label,encrypted_key,iv')
    .eq('user_id', user.id)
    .eq('provider_id', providerId)
    .order('created_at');
  if (!data) return [];
  return Promise.all(
    data.map(async (r) => ({
      slotId: r.id,
      label: r.label,
      apiKey: await decryptValue(user.id, r.encrypted_key, r.iv),
    }))
  );
}

/** Decrypts and returns just the first slot's key — for call sites that
 * only ever need one key (model discovery), not the full rotation list. */
export async function getCredentialKey(providerId) {
  const slots = await getCredentialKeySlots(providerId);
  return slots[0]?.apiKey ?? null;
}

/** Removes every slot for this provider (the whole entry, as shown in the
 * Chat picker). */
export async function removeCredential(providerId) {
  const user = await currentUser();
  if (!user) return;
  await sb.from('api_credentials').delete().eq('user_id', user.id).eq('provider_id', providerId);
}

/** Removes just one key slot by its row id, leaving any other slots for the
 * same provider intact. */
export async function removeCredentialSlot(slotId) {
  const user = await currentUser();
  if (!user) return;
  await sb.from('api_credentials').delete().eq('user_id', user.id).eq('id', slotId);
}

/** Update only model metadata, preserving the encrypted key and provider
 * URL — applies to every slot of this provider (they share one model),
 * which is why this can no longer use `.maybeSingle()` (that throws once a
 * provider has more than one slot to update). */
export async function updateCredentialModel(providerId, model) {
  const user = await currentUser();
  if (!user) throw new Error('Belum masuk akun.');
  const { data, error } = await sb.from('api_credentials')
    .update({ model, updated_at: new Date().toISOString() })
    .eq('user_id', user.id).eq('provider_id', providerId)
    .select('provider_id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Provider tidak ditemukan. Muat ulang daftar asisten.');
}
