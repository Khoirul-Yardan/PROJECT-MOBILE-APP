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

function call(type, payload, timeoutMs = CALL_TIMEOUT_MS) {
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
    }, timeoutMs);
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
  // VpnTunnelService's OpenVPN path deliberately polls for up to 25s before
  // giving a definite yes/no (see its own _openvpnConnectTimeout) — the
  // generic 8s CALL_TIMEOUT_MS used to fire first, so the bridge gave up and
  // resolved null well before native's real answer arrived. The UI then had
  // nothing to show (no toast, no error — vpn.js treats a null result as a
  // silent "not connected"), which looked exactly like a dead button even
  // though every tap really was reaching native and starting a connection
  // attempt in the background.
  vpnConnect: () => call('vpn_connect', {}, 60000),
  vpnDisconnect: () => call('vpn_disconnect', {}, 60000),
  vpnState: () => call('vpn_state', {}, 8000),
  openBotBpjs: () => call('open_bot_bpjs'),
  /** Native text-to-speech (WebView speechSynthesis is often silent on Android). */
  speak: (text) => call('speak', { text }, 5000),
  /** Opens the native guided-anamnesis screen (mic + STT + TTS, same reasons as Bot BPJS). */
  openAnamnesisTerpandu: () => call('open_anamnesis_terpandu'),
  /**
   * Opens the native SSH Terminal screen — an interactive shell needs a real
   * TCP socket (dartssh2), which a WebView page can't open itself, so this
   * stays 100% native like Bot BPJS's microphone.
   */
  openTerminal: () => call('open_terminal'),
  /** Pemilih file native (input[type=file] tidak jalan di WebView Android). */
  pickTextFile: () => call('pick_text_file', {}, 120000),
  signOut: () => call('sign_out'),

  /**
   * Relays an HTTP request through native's own network stack instead of
   * this page's fetch() — self-hosted agent gateways (OpenClaw, Hermes
   * Agent's A2A) almost never send CORS headers, so a browser/WebView
   * fetch() to them is blocked outright by the preflight check. Native HTTP
   * isn't subject to CORS at all, so this sidesteps it. Long timeout: these
   * are AI replies, which can legitimately take tens of seconds.
   */
  httpRelay: (url, { method = 'POST', headers = {}, body } = {}) =>
    call('http_relay', { url, method, headers, body }, 90000),

  /**
   * Saves an image (chat lightbox's Download button) via the OS share
   * sheet — a WebView has no built-in "Save As" for a data: URI or a
   * cross-origin image the way a desktop browser does, so this hands the
   * bytes to native instead, same mechanism exportBpjs below already uses.
   * Pass either `dataUrl` (a data:image/... URI) or `url` (an https image
   * link native will fetch itself). Returns null with no native shell —
   * the caller falls back to a plain <a download> in that case.
   */
  saveImage: ({ dataUrl, url, filename }) => call('save_image', { dataUrl, url, filename }, 30000),

  /**
   * Builds a Bot BPJS session as a PDF or DOCX file and opens the native
   * share sheet — reuses the exact same export code the native Bot BPJS
   * screen already uses right after recording (see BpjsExport in
   * bpjs_service.dart), instead of duplicating a second PDF/DOCX generator
   * in JS. Web-only surfaces (the Riwayat history page) don't have a
   * file-generation or OS share story of their own, so this hands the
   * whole job to native. Returns null (same as any other unavailable-bridge
   * call) when there's no native shell — the view falls back to "Salin
   * Teks" / browser print in that case.
   */
  exportBpjs: ({ format, dokterNama, dokterInstansi, pasienNama, createdAt, structured, transcript, comparison }) =>
    call(
      'export_bpjs',
      { format, dokterNama, dokterInstansi, pasienNama, createdAt, structured, transcript, comparison },
      30000
    ),

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
