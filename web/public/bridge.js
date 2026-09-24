// AI Hub — Native bridge (Web → Flutter → native OS, and back).
//
// Everything that needs OS-level access or must never leave secure storage
// stays native: API keys, VPN credentials, the actual VPN connection, the
// microphone/wake-word/TTS for Bot BPJS. This page only ever *asks* the
// native shell to do those things and gets a result back — it never holds
// a raw secret longer than one request/response round trip, and it never
// touches the microphone itself.
//
// Transport: `NativeBridge.postMessage(json)` (Web → Native, registered by
// Flutter's WebViewController). Native replies by calling
// `window.__nativeReply(id, json)` for request/response calls, or
// `window.__nativeEvent(type, json)` for events pushed from native without
// being asked (e.g. VPN status changing, Bot BPJS finishing a session).

const pending = new Map();
let seq = 0;

// If native never replies (crashed handler, dropped message, stale shell
// version that doesn't recognize a newer call type), the caller must not
// hang forever — resolve the same way as "no native shell attached" so
// every call site's existing null-check handles it without extra code.
const CALL_TIMEOUT_MS = 8000;

function hasBridge() {
  return typeof NativeBridge !== 'undefined' && !!NativeBridge.postMessage;
}

function call(type, payload) {
  return new Promise((resolve) => {
    if (!hasBridge()) {
      console.warn('[bridge] no native shell attached — call ignored', type, payload);
      resolve(null);
      return;
    }
    const id = `req_${++seq}`;
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      console.warn('[bridge] native shell did not reply in time — treating as unavailable', type, payload);
      resolve(null);
    }, CALL_TIMEOUT_MS);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (err) => {
        clearTimeout(timer);
        console.warn('[bridge] native call failed', type, err);
        resolve(null);
      },
    });
    try {
      NativeBridge.postMessage(JSON.stringify({ id, type, payload: payload || {} }));
    } catch (e) {
      clearTimeout(timer);
      pending.delete(id);
      console.warn('[bridge] failed to post message to native shell', type, e);
      resolve(null);
    }
  });
}

// Called by Flutter via runJavaScript once a request finishes.
window.__nativeReply = (id, resultJson) => {
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  try {
    const result = resultJson ? JSON.parse(resultJson) : null;
    if (result && result.error) entry.reject(new Error(result.error));
    else entry.resolve(result);
  } catch (e) {
    entry.reject(e);
  }
};

const listeners = new Map();

// Called by Flutter via runJavaScript to push an unsolicited event.
window.__nativeEvent = (type, payloadJson) => {
  const handlers = listeners.get(type);
  if (!handlers) return;
  const payload = payloadJson ? JSON.parse(payloadJson) : null;
  handlers.forEach((fn) => fn(payload));
};

export const Native = {
  // --- Credentials (Keystore/Keychain) ---------------------------------
  getApiKey: (provider) => call('get_api_key', { provider }),
  saveApiKey: (provider, key) => call('save_api_key', { provider, key }),
  hasApiKey: (provider) => call('has_api_key', { provider }),

  getVpnConfig: () => call('get_vpn_config'),
  saveVpnConfig: (config) => call('save_vpn_config', config),

  // --- Native-only actions ----------------------------------------------
  vpnConnect: () => call('vpn_connect'),
  vpnDisconnect: () => call('vpn_disconnect'),
  openBotBpjs: () => call('open_bot_bpjs'),
  signOut: () => call('sign_out'),

  /** Fire-and-forget: lets native highlight the matching bottom-nav tab. */
  notifyRoute(path) {
    if (!hasBridge()) return;
    NativeBridge.postMessage(JSON.stringify({ type: 'route_changed', payload: { path } }));
  },

  /**
   * Mirrors the web session's refresh token into native's own Supabase
   * client, purely so the fully-native Bot BPJS screen can attribute its
   * `activity_log` writes to the signed-in user without a second login UI.
   */
  notifySession(refreshToken) {
    if (!hasBridge()) return;
    NativeBridge.postMessage(
      JSON.stringify({ type: 'session_changed', payload: { refresh_token: refreshToken } })
    );
  },

  // --- Events pushed from native -----------------------------------------
  on(type, handler) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(handler);
    return () => listeners.get(type).delete(handler);
  },

  get attached() {
    return hasBridge();
  },
};
