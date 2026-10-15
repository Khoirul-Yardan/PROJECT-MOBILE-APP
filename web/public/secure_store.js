// Shared client-side AES-GCM encryption for anything synced through the
// user's Supabase account that shouldn't sit as plaintext at rest (API
// keys — see credentials.js — and the VPN config — see vpn_store.js).
//
// Security note: the key is *derived* from the signed-in user's own uid
// plus a fixed, per-use-case pepper baked into this public JS bundle
// (PBKDF2). Anyone with both (a) this app's source, which is public, and
// (b) a user's uid — already required to query their row, and RLS already
// restricts that query to the same signed-in user — can derive the same
// key. This is defense-in-depth against the value sitting as human-readable
// plaintext at rest (an accidental dashboard screen-share, a CSV export, a
// misconfigured read-only replica), not an independent secret the way a
// real device's Keystore/Keychain is. **Row Level Security remains the
// actual access control** — nobody but the owning, authenticated user can
// read the row at all, encrypted or not.
const SALT = 'ai-hub-static-salt';

async function deriveKey(uid, pepper) {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(uid + pepper),
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

/** pepper domain-separates keys derived for different use cases (API
 * credentials vs. VPN config) so the same uid never produces the same raw
 * AES key for both — not secret, just a fixed per-use-case label. */
export async function encryptForUser(uid, pepper, plaintext) {
  const key = await deriveKey(uid, pepper);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return { encrypted: toBase64(ciphertext), iv: toBase64(iv) };
}

export async function decryptForUser(uid, pepper, encrypted, iv) {
  const key = await deriveKey(uid, pepper);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(encrypted)
  );
  return new TextDecoder().decode(plain);
}
