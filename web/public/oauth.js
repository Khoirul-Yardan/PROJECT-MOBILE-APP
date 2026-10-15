// "Login dengan akun" for providers that officially support OAuth, as the
// alternative to pasting an API key by hand. Only OpenRouter qualifies today
// (PKCE flow that hands back a normal API key) — OpenAI/Anthropic/etc. expose
// API access through keys only, so they stay on the paste-a-key path.
//
// Flow: startOpenRouterLogin() sends the browser to openrouter.ai/auth; the
// user logs in there and OpenRouter redirects back to `<origin>/?code=...`;
// finishOAuthReturn() (called once at boot from app.js) swaps that code for
// an API key and saves it exactly like a pasted key, so nothing downstream
// (Chat picker, key rotation, model discovery) needs to know how it got here.
import { KNOWN_PROVIDERS } from './providers.js';
import { saveProvider } from './ai.js';
import { countCredentialSlots } from './credentials.js';
import { logActivity } from './db.js';

const VERIFIER_KEY = 'aihub.oauth.openrouter.verifier';
const AUTH_URL = 'https://openrouter.ai/auth';
const EXCHANGE_URL = 'https://openrouter.ai/api/v1/auth/keys';

/** Providers that offer "Login dengan akun" in the Add-provider screen. */
export const OAUTH_PROVIDER_IDS = ['openrouter'];

function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function makePkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

/** OpenRouter only accepts an https callback (or http://localhost). */
export function oauthCallbackUrl() {
  return `${location.origin}/`;
}

export function oauthSupported() {
  const { protocol, hostname } = location;
  return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
}

export async function startOpenRouterLogin() {
  if (!oauthSupported()) {
    throw new Error('Login akun OpenRouter butuh alamat https (atau localhost). Pakai API key untuk alamat ini.');
  }
  const { verifier, challenge } = await makePkce();
  localStorage.setItem(VERIFIER_KEY, verifier);
  const url = new URL(AUTH_URL);
  url.searchParams.set('callback_url', oauthCallbackUrl());
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  location.href = url.toString();
}

/** Call once at boot. If the URL carries an OAuth `code` we started, exchange
 * it for a key and save it. Returns {label} on success, {error} on failure,
 * or null when this page load isn't an OAuth return at all. */
export async function finishOAuthReturn() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const verifier = localStorage.getItem(VERIFIER_KEY);
  if (!code || !verifier) return null;

  // Strip ?code=... right away so a reload can't replay a used code.
  history.replaceState(null, '', `${location.pathname}${location.hash}`);
  localStorage.removeItem(VERIFIER_KEY);

  try {
    const resp = await fetch(EXCHANGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok || !body.key) throw new Error(body?.error?.message || body?.error || `OpenRouter menolak (HTTP ${resp.status}).`);

    const base = KNOWN_PROVIDERS.find((p) => p.id === 'openrouter');
    const count = await countCredentialSlots(base.id);
    const entry = count === 0 ? base : { ...base, label: `${base.label} ${count + 1}` };
    await saveProvider(entry, body.key);
    await logActivity({ category: 'AI', title: 'Login akun terhubung', subtitle: entry.label, badge: 'Success' });
    return { label: entry.label };
  } catch (e) {
    return { error: e.message || String(e) };
  }
}
