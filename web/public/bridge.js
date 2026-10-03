// AI Hub — Native bridge (Web → Flutter → native OS, and back).
//
// What's left here that genuinely needs OS-level access or must stay off
// the network entirely: the VPN config (still local-only — see its own
// dev-fallback note below) and the actual VPN connection, and the
// microphone/wake-word/TTS for Bot BPJS. AI provider/agent credentials used
// to live here too but now sync through the user's Supabase account instead
// (see credentials.js) — a local-storage-only key was getting lost on every
// reinstall/browser-data-clear, so that's no longer the bridge's job.
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

// Dev-only convenience: when there's no native shell at all (testing in a
// plain desktop browser instead of the app), VPN config falls back to this
// device's localStorage instead of silently no-op'ing — so the VPN screen
// is still usable while iterating without a phone. Not the security model:
// localStorage is plain, readable by any script on the page. The moment a
// real native shell is attached (the actual app, on a real device), this
// path is never used and it goes through Keystore/Keychain exactly as
// documented in vpn_config_service.dart.
const DEV_PREFIX = 'aihub_dev_';

function devFallback(type, payload) {
  try {
    switch (type) {
      case 'get_vpn_config': {
        const raw = localStorage.getItem(DEV_PREFIX + 'vpn_config');
        return raw ? JSON.parse(raw) : null;
      }
      case 'save_vpn_config':
        localStorage.setItem(DEV_PREFIX + 'vpn_config', JSON.stringify(payload));
        return {};
      case 'vpn_connect':
        return { connected: true };
      case 'vpn_disconnect':
        return { connected: false };
      default:
        // sign_out, open_bot_bpjs, session_changed, etc. genuinely need a
        // real native shell (account session, microphone) — nothing to fake.
        return undefined;
    }
  } catch (e) {
    console.warn('[bridge:dev] localStorage fallback failed', type, e);
    return undefined;
  }
}

function call(type, payload) {
  return new Promise((resolve) => {
    if (!hasBridge()) {
      const fallback = devFallback(type, payload || {});
      if (fallback !== undefined) {
        console.info(
          '[bridge:dev] no native shell — using a browser-only localStorage fallback (insecure, dev use only)',
          type
        );
        resolve(fallback);
        return;
      }
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
  getVpnConfig: () => call('get_vpn_config'),
  saveVpnConfig: (config) => call('save_vpn_config', config),

  // --- Native-only actions ----------------------------------------------
  vpnConnect: () => call('vpn_connect'),
  vpnDisconnect: () => call('vpn_disconnect'),
  openBotBpjs: () => call('open_bot_bpjs'),
  signOut: () => call('sign_out'),

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
