// Tiny same-origin HTTP relay. Two jobs:
//
// 1. CORS bypass for self-hosted agent gateways (OpenClaw, Hermes Agent's
//    A2A/API Server) — they run on infrastructure the *user* controls
//    (their own laptop/server) and almost none of them send CORS headers,
//    so a browser fetch() straight to them is blocked by the preflight
//    check before the request even leaves the page. The installed Android
//    app sidesteps this by relaying through native HTTP instead (see
//    `http_relay` in web_shell_screen.dart); this does the same job for the
//    plain-browser dev preview, where there's no native bridge to fall
//    back to. Not a general-purpose proxy for the big AI providers: those
//    are still called directly from the page (see ai.js) to keep the "no AI
//    Hub server in the middle" guarantee for the common case. This only
//    exists for self-hosted agent entries the user explicitly configured a
//    URL for — see the generic `/` route below.
//
// 2. Shared AssemblyAI diarization key (the `/assemblyai/*` routes) — Bot
//    BPJS needs real speaker diarization (see assemblyai_service.dart for
//    why on-device STT alone can't tell speakers apart), which used to mean
//    every nurse had to go get her own AssemblyAI account and paste a key
//    in before her first recording. If the deployer sets ASSEMBLYAI_API_KEY
//    here (one key, server-side, never shipped in the app), every device
//    just works out of the box instead — the app only falls back to asking
//    for a personal key if this key is unset (see ASSEMBLYAI-DIARIZATION.md).
const http = require('http');

const PORT = process.env.PORT || 8091;
// Deliberately generous (same reasoning as the native relay's 90s timeout):
// these are AI replies, which can legitimately take a while, especially
// once A2A task polling (ai.js's pollA2ATask) is layered on top.
const UPSTREAM_TIMEOUT_MS = 100000;
const ASSEMBLYAI_BASE = 'https://api.assemblyai.com/v2';
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || '';
// Set on any internet-facing deployment (e.g. Railway). The generic relay
// fetches whatever URL the caller gives it; locally that's the point (LAN
// agents), but on a public host it would let anyone reach the platform's
// private network. With this on, loopback/private/link-local/.internal
// targets are refused.
const BLOCK_PRIVATE_TARGETS = process.env.RELAY_BLOCK_PRIVATE === '1';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

// Buffer, not string: the generic `/` route only ever carries JSON, but
// `/assemblyai/upload` carries raw audio bytes — concatenating those as a
// string (implicit UTF-8 decoding of binary data) would corrupt the file.
// Collecting as a Buffer and only decoding to text where it's actually text
// keeps both paths correct from the same reader.
function readBodyBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function withTimeout(fn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function isBlockedTarget(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;
  if (h === '::1' || h === '::' || /^f[cd]/.test(h) || /^fe80/.test(h) || h.startsWith('::ffff:')) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  // Bare/odd numeric forms (e.g. 2130706433, 0x7f.1) — nothing legitimate.
  return /^[0-9x.]+$/.test(h);
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// True for a hostname that's only meaningful on the LAN this container's
// *host* machine sits on (192.168.x.x, 10.x.x.x, 172.16-31.x.x) — i.e. not
// a public domain, and not already something Docker's own network can
// already resolve. Used by handleGenericRelay's host.docker.internal
// fallback below: deliberately narrow, so it only ever kicks in for the
// exact shape of address that fallback can actually help with.
function isPrivateLanIPv4(hostname) {
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// Generic self-hosted-agent passthrough — unchanged contract: client posts
// {url, method, headers, body}, gets back {status, body} (or {status: 0,
// message} on failure) so ai.js's selfHostedFetch handles this and the
// native relay identically.
async function handleGenericRelay(req, res) {
  let target;
  try {
    const raw = (await readBodyBuffer(req)).toString('utf8');
    const { url, method, headers, body } = JSON.parse(raw || '{}');
    if (!url) throw new Error('Missing url');
    target = new URL(url);
    if (!/^https?:$/.test(target.protocol)) throw new Error('Only http(s) URLs are allowed');
    if (BLOCK_PRIVATE_TARGETS && isBlockedTarget(target.hostname)) throw new Error('Target host not allowed on this deployment');
    const fetchOpts = {
      method: method || 'POST',
      headers: headers || {},
      body: (method || 'POST') === 'GET' ? undefined : body,
      // A redirect could bounce a public URL to a private one after the
      // check above, so don't follow them when blocking is on.
      redirect: BLOCK_PRIVATE_TARGETS ? 'manual' : 'follow',
    };
    let upstream;
    try {
      upstream = await withTimeout((signal) => fetch(target, { ...fetchOpts, signal }));
    } catch (e) {
      // Docker Desktop's container network can't route to the *host*
      // machine's own LAN-facing IP (it's isolated from the host's LAN by
      // design) — but it CAN reach the host itself via the special
      // `host.docker.internal` name. This project's whole point is
      // self-hosted agents, which in practice usually run on the same
      // machine as this container during dev/testing (see
      // docs/HERMES-API-SETUP.md), so a bare LAN-IP connection failure is
      // worth one retry through that name before giving up — transparent
      // to the client either way (same {status, body} shape).
      if (BLOCK_PRIVATE_TARGETS || !isPrivateLanIPv4(target.hostname)) throw e;
      const fallback = new URL(target.toString());
      fallback.hostname = 'host.docker.internal';
      upstream = await withTimeout((signal) => fetch(fallback, { ...fetchOpts, signal }));
    }
    const text = await upstream.text();
    sendJson(res, 200, { status: upstream.status, body: text });
  } catch (e) {
    // 'message', not 'error' — mirrors the native relay's reply shape so
    // ai.js's selfHostedFetch handles both paths identically.
    sendJson(res, 200, { status: 0, body: '', message: String((e && e.message) || e) });
  }
}

// /assemblyai/upload — raw audio bytes in, straight passthrough to
// AssemblyAI's own /v2/upload response shape out (unlike the generic relay
// above, this is NOT JSON-wrapped: the Dart client's AssemblyAiService
// reads it exactly like it reads a direct AssemblyAI response, just with no
// Authorization header to supply itself).
async function handleAssemblyAiUpload(req, res) {
  const bytes = await readBodyBuffer(req);
  const upstream = await withTimeout((signal) =>
    fetch(`${ASSEMBLYAI_BASE}/upload`, {
      method: 'POST',
      headers: { authorization: ASSEMBLYAI_API_KEY },
      body: bytes,
      signal,
    })
  );
  const text = await upstream.text();
  res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
  res.end(text);
}

// /assemblyai/transcript — JSON {audio_url} in, same request AssemblyAI's
// own /v2/transcript expects, with speaker_labels/language_code fixed here
// (same values assemblyai_service.dart sends when calling AssemblyAI
// directly) so a relay-backed call behaves identically to a direct one.
async function handleAssemblyAiTranscriptCreate(req, res) {
  const raw = (await readBodyBuffer(req)).toString('utf8');
  const { audio_url } = JSON.parse(raw || '{}');
  const upstream = await withTimeout((signal) =>
    fetch(`${ASSEMBLYAI_BASE}/transcript`, {
      method: 'POST',
      headers: { authorization: ASSEMBLYAI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ audio_url, speaker_labels: true, speakers_expected: 2, language_code: 'id', punctuate: true, format_text: true }),
      signal,
    })
  );
  const text = await upstream.text();
  res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
  res.end(text);
}

// /assemblyai/transcript/:id — polled repeatedly by the client; passthrough
// of AssemblyAI's own GET /v2/transcript/:id.
async function handleAssemblyAiTranscriptGet(req, res, id) {
  const upstream = await withTimeout((signal) =>
    fetch(`${ASSEMBLYAI_BASE}/transcript/${encodeURIComponent(id)}`, {
      headers: { authorization: ASSEMBLYAI_API_KEY },
      signal,
    })
  );
  const text = await upstream.text();
  res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://internal');
  const path = url.pathname;

  try {
    if (path.startsWith('/assemblyai/')) {
      if (!ASSEMBLYAI_API_KEY) {
        // Distinct status from a normal upstream failure so the Dart
        // client can tell "this deployment hasn't set a shared key" apart
        // from "AssemblyAI itself rejected the request" and fall back to
        // asking the nurse for her own key instead of just erroring out.
        sendJson(res, 503, { error: 'not_configured', message: 'ASSEMBLYAI_API_KEY belum diset di server relay.' });
        return;
      }
      if (path === '/assemblyai/upload' && req.method === 'POST') {
        await handleAssemblyAiUpload(req, res);
        return;
      }
      if (path === '/assemblyai/transcript' && req.method === 'POST') {
        await handleAssemblyAiTranscriptCreate(req, res);
        return;
      }
      const match = path.match(/^\/assemblyai\/transcript\/([^/]+)$/);
      if (match && req.method === 'GET') {
        await handleAssemblyAiTranscriptGet(req, res, match[1]);
        return;
      }
      sendJson(res, 404, { error: 'not_found' });
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { status: 0, body: '', message: 'Method not allowed' });
      return;
    }
    await handleGenericRelay(req, res);
  } catch (e) {
    sendJson(res, 502, { error: 'relay_failed', message: String((e && e.message) || e) });
  }
});

server.listen(PORT, () => {
  console.log(`[relay] listening on :${PORT}${ASSEMBLYAI_API_KEY ? ' (AssemblyAI shared key configured)' : ' (no ASSEMBLYAI_API_KEY — diarization will fall back to per-device keys)'}`);
});
