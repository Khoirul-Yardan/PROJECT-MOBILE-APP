// AI provider/agent credentials, synced through the user's Supabase account
// instead of only living in one device's local storage — a key added on
// one browser/device is still there after a reinstall or on another
// device, which is the whole point (local-only storage was losing keys on
// every reinstall/browser-data-clear, which is what this replaces).
//
// Security note, read before assuming this is bulletproof: the AES-GCM key
// below is *derived* from the signed-in user's own UID plus a fixed pepper
// baked into this public JS bundle (PBKDF2). Anyone with both (a) this
// app's source, which is public, and (b) a user's UID — which is already
// required to query their row, and RLS already restricts that query to the
// same signed-in user — can derive the same key. This is defense-in-depth
// against the credential sitting as human-readable plaintext at rest (an
// accidental dashboard screen-share, a CSV export, a misconfigured
// read-only replica), not an independent secret the way a real device's
// Keystore/Keychain is. **Row Level Security remains the actual access
// control** — nobody but the owning, authenticated user can read the row
// at all, encrypted or not.
import { sb, currentUser } from './db.js';

const PEPPER = 'aihub-credentials-v1'; // not secret; just domain-separates the key derivation
const SALT = 'ai-hub-static-salt';

async function deriveKey(uid) {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(uid + PEPPER),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(SALT), iterations: 100000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function toBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromBase64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function encryptValue(uid, plaintext) {
  const key = await deriveKey(uid);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return { encrypted_key: toBase64(ciphertext), iv: toBase64(iv) };
}

async function decryptValue(uid, encryptedKey, iv) {
  const key = await deriveKey(uid);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(encryptedKey)
  );
  return new TextDecoder().decode(plain);
}

/** entry: {id,label,type,format,endpoint,model}. */
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
    { onConflict: 'user_id,provider_id' }
  );
  if (error) throw error;
}

/** Metadata only (label/type/format/endpoint/model) — never the key itself. */
export async function listCredentials() {
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await sb
    .from('api_credentials')
    .select('provider_id,label,type,format,endpoint,model')
    .eq('user_id', user.id)
    .order('created_at');
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.provider_id,
    label: r.label,
    type: r.type,
    format: r.format,
    endpoint: r.endpoint,
    model: r.model,
  }));
}

export async function hasCredential(providerId) {
  const user = await currentUser();
  if (!user) return false;
  const { data } = await sb
    .from('api_credentials')
    .select('id')
    .eq('user_id', user.id)
    .eq('provider_id', providerId)
    .maybeSingle();
  return !!data;
}

/** Decrypts and returns the raw key, fetched fresh each time — never cached
 * in this module longer than the one call site that needs it right now. */
export async function getCredentialKey(providerId) {
  const user = await currentUser();
  if (!user) return null;
  const { data, error } = await sb
    .from('api_credentials')
    .select('encrypted_key,iv')
    .eq('user_id', user.id)
    .eq('provider_id', providerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return decryptValue(user.id, data.encrypted_key, data.iv);
}

export async function removeCredential(providerId) {
  const user = await currentUser();
  if (!user) throw new Error('Sesi berakhir. Masuk kembali sebelum menghapus kredensial.');
  const { error } = await sb.from('api_credentials').delete().eq('user_id', user.id).eq('provider_id', providerId);
  if (error) throw error;
}
