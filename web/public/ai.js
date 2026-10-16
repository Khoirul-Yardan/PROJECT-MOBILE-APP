// Calls whatever provider/agent the entry describes, directly from the web
// page — never through an AI Hub server. The key itself is decrypted fresh
// from Supabase (see credentials.js) right before each send and never kept
// around in this page longer than that.
import {
  saveCredential,
  listCredentials,
  hasCredential,
  getCredentialKey,
  getCredentialKeySlots,
  removeCredential,
  updateCredentialModel,
} from './credentials.js';
import { generateGemini, listGeminiModels, normalizeGeminiModel } from './gemini.js';
import { Native } from './bridge.js';

export const saveProvider = saveCredential;
export const listRegisteredProviders = listCredentials;
export const hasApiKey = hasCredential;
export const removeProvider = removeCredential;

// Which slot (index into that provider's key list) worked last, kept only
// for this page's lifetime — not persisted, so a reload just starts from
// slot 0 again and re-discovers which ones are still live.
const lastGoodSlot = new Map();

function isQuotaError(err) {
  if (err?.status === 429) return true;
  const msg = String(err?.message || '').toLowerCase();
  return /quota|rate.?limit|too many requests|resource_exhausted|insufficient_quota/.test(msg);
}

/** Runs `callFn(apiKey)` against this provider's saved key slots in order,
 * starting from whichever slot last worked. A quota/rate-limit error moves
 * to the next slot and retries; any other error (bad key, network, safety
 * block) stops immediately instead of burning through every slot for a
 * problem rotating keys can't fix. */
async function callWithRotation(entry, callFn, onSlotChange) {
  const slots = await getCredentialKeySlots(entry.id);
  if (slots.length === 0) {
    throw new Error(`Belum ada kunci API tersimpan untuk ${entry.label}.`);
  }
  const start = lastGoodSlot.get(entry.id) ?? 0;
  let lastError;
  for (let i = 0; i < slots.length; i++) {
    const idx = (start + i) % slots.length;
    try {
      const result = await callFn(slots[idx].apiKey);
      if (i > 0) onSlotChange?.(slots[idx].label);
      lastGoodSlot.set(entry.id, idx);
      return result;
    } catch (err) {
      lastError = err;
      if (!isQuotaError(err) || i === slots.length - 1) throw err;
      // else: this slot is out of quota — try the next one.
    }
  }
  throw lastError;
}

/** history: [{role:'user'|'assistant'|'system', text}], returns the reply text. */
export async function sendChat(entry, history, { onModelChange, onSlotChange, tools = [] } = {}) {
  switch (entry.format) {
    case 'anthropic':
      return callWithRotation(entry, (apiKey) => callAnthropic(entry, apiKey, history), onSlotChange);
    case 'gemini':
      return callWithRotation(entry, async (apiKey) => {
        const result = await generateGemini(entry, apiKey, history, { tools });
        entry._resolvedModel = result.model;
        let persisted = true;
        if (entry.model && entry.model !== 'auto' && entry.model !== result.model) {
          try { await updateCredentialModel(entry.id, result.model); }
          catch { persisted = false; }
          entry.model = result.model;
        }
        onModelChange?.({ ...result, persisted });
        return result.text;
      }, onSlotChange);
    case 'openclaw':
      return callWithRotation(entry, (apiKey) => callOpenClaw(entry, apiKey, history), onSlotChange);
    case 'a2a':
      return callWithRotation(entry, (apiKey) => callA2A(entry, apiKey, history), onSlotChange);
    case 'hermes-api':
      return callWithRotation(entry, (apiKey) => callHermesApiServer(entry, apiKey, history), onSlotChange);
    default:
      return callWithRotation(entry, (apiKey) => callOpenAiCompatible(entry, apiKey, history), onSlotChange);
  }
}

export async function availableModels(entry) {
  if (entry.format !== 'gemini' && entry.format !== 'openai') return [];
  const key = await getCredentialKey(entry.id);
  if (!key) throw new Error('Kunci API belum tersedia. Hubungkan ulang provider ini.');
  if (entry.format === 'gemini') return listGeminiModels(entry, key);
  return listOpenAiModels(entry, key);
}

// GET .../v1/models — supported by OpenAI itself, OpenRouter, and the Nous
// Portal behind Hermes (it's an OpenRouter-style aggregator, see the note
// on the Hermes catalog entry), so this one function covers every provider
// using the 'openai' wire format without per-vendor special-casing.
async function listOpenAiModels(entry, apiKey) {
  const url = entry.endpoint.replace(/\/chat\/completions\/?$/, '/models');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(res.status, `${entry.label} error: ${body.error?.message ?? res.statusText}`);
  return (body.data || [])
    .map((m) => ({ id: m.id, label: m.name || m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// A2A's discovery document (GET /.well-known/agent.json) lists the agent's
// real toolsets (terminal, kanban, browser, spotify, whatever it's actually
// configured with) — chat.js's "/" palette surfaces these so the user knows
// what they can ask for in plain language, since the agent uses its own
// tools autonomously when it decides to (see callA2A's task-polling note);
// there's no per-tool command to run from here. Cached per entry by the
// caller since this doesn't change mid-session.
export async function getAgentSkills(entry) {
  if (entry.format !== 'a2a') return [];
  try {
    const url = new URL('.well-known/agent.json', entry.endpoint).toString();
    const res = await selfHostedFetch(url, { method: 'GET' });
    if (!res.ok) return [];
    const card = await res.json();
    return (card.skills || []).map((s) => ({ id: s.id, name: s.name, description: s.description }));
  } catch {
    return [];
  }
}

export async function setProviderModel(entry, value) {
  const model = entry.format === 'gemini' ? normalizeGeminiModel(value) : String(value || '').trim();
  const valid = entry.format === 'gemini' ? /^[a-zA-Z0-9._-]+$/ : /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/;
  if (!model || model.length > 200 || !valid.test(model)) throw new Error('Masukkan ID model yang valid.');
  await updateCredentialModel(entry.id, model);
  entry.model = model;
  delete entry._resolvedModel;
}

// Carries the HTTP status onto the Error so callWithRotation's
// isQuotaError() can check it reliably instead of guessing from message text.
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Self-hosted agent gateways (OpenClaw, Hermes Agent's A2A) are on the
// user's own infrastructure and almost never send CORS headers — a
// browser/WebView fetch() to them gets blocked by the preflight check
// before the request even leaves the page. Two ways around that, same
// {status, body} reply shape either way:
//  - Native bridge attached (the real app): relay through native HTTP,
//    which isn't subject to CORS at all (see http_relay in
//    web_shell_screen.dart).
//  - No native bridge (plain-browser dev preview): relay through this
//    container's own same-origin /relay/ endpoint (see web/relay/server.js)
//    instead — the browser only ever talks to its own origin, so no
//    cross-origin request is made and no preflight happens; the relay
//    container does the actual outbound call server-side, where CORS
//    doesn't apply.
// "Connection refused" from a phone almost always means it is not on the same
// network as the self-hosted server (Wi-Fi off / mobile data), not a bug.
function unreachableHint(url, message) {
  if (!/refused|unreachable|timed out|timeout|host lookup|no route/i.test(message)) return message;
  let host = url;
  try { host = new URL(url).host; } catch { /* keep raw */ }
  return `Tidak bisa menjangkau ${host} dari HP ini. Pastikan HP terhubung ke Wi-Fi/jaringan yang sama dengan server (atau VPN aktif) dan server sedang menyala.`;
}

async function selfHostedFetch(url, { method = 'POST', headers = {}, body } = {}) {
  if (Native.attached) {
    const result = await Native.httpRelay(url, { method, headers, body });
    if (!result) throw new Error('Gagal menghubungi jembatan native.');
    if (result.message) throw new Error(unreachableHint(url, result.message));
    return wrapRelayResult(result);
  }
  const res = await fetch('/relay/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, method, headers, body }),
  });
  const result = await res.json();
  if (result.message) throw new Error(result.message);
  return wrapRelayResult(result);
}

function wrapRelayResult(result) {
  return {
    ok: result.status >= 200 && result.status < 300,
    status: result.status,
    json: async () => {
      try {
        return JSON.parse(result.body);
      } catch {
        return {};
      }
    },
  };
}

// Covers OpenAI itself, OpenRouter, and most agent/gateway APIs that mimic
// the OpenAI chat-completions shape (the large majority of what's out
// there) — including a plain 'system' role message, same as OpenAI's API.
async function callOpenAiCompatible(entry, apiKey, history) {
  const res = await fetch(entry.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: entry.model,
      messages: history.map((m) => ({ role: m.role, content: m.text })),
    }),
  });
  const body = await res.json();
  if (!res.ok) throw httpError(res.status, `${entry.label} error: ${body.error?.message ?? res.statusText}`);
  return body.choices?.[0]?.message?.content?.trim() ?? '(respons kosong)';
}

// Hermes Agent's API Server — same OpenAI chat-completions wire shape as
// callOpenAiCompatible above, but routed through selfHostedFetch (CORS
// relay/native bridge) since this runs on the user's own LAN/host and
// almost never has CORS headers configured, unlike the big cloud providers
// callOpenAiCompatible targets. This is the *trusted* direct-session-style
// surface (same one apps like Open WebUI use for full tool access,
// including things A2A deliberately refuses) — see the catalog entry's
// note in providers.js for why that distinction matters.
async function callHermesApiServer(entry, apiKey, history) {
  const res = await selfHostedFetch(entry.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'hermes-agent',
      messages: history.map((m) => ({ role: m.role, content: m.text })),
    }),
  });
  const body = await res.json();
  if (!res.ok) throw httpError(res.status, `${entry.label} error: ${body.error?.message ?? res.statusText}`);
  return body.choices?.[0]?.message?.content?.trim() ?? '(respons kosong)';
}

// Anthropic's Messages API takes the system prompt as its own top-level
// `system` field, not a message with role:'system' — pull any out of the
// history and join them, same idea as OpenAI's role but different wire shape.
async function callAnthropic(entry, apiKey, history) {
  const systemText = history
    .filter((m) => m.role === 'system')
    .map((m) => m.text)
    .join('\n\n');
  const messages = history.filter((m) => m.role !== 'system');
  const res = await fetch(entry.endpoint, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: entry.model,
      max_tokens: 1024,
      ...(systemText ? { system: systemText } : {}),
      messages: messages.map((m) => ({ role: m.role, content: m.text })),
    }),
  });
  const body = await res.json();
  if (!res.ok) throw httpError(res.status, `${entry.label} error: ${body.error?.message ?? res.statusText}`);
  return body.content?.[0]?.text?.trim() ?? '(respons kosong)';
}

// OpenClaw self-hosted Gateway: instead of Telegram/WhatsApp being the
// "channel" that talks to the agent, this app's Chat is — same agent
// session, replies land here. Only the newest user message is sent (the
// Gateway keeps conversation state server-side per session, unlike the
// stateless OpenAI/Anthropic/Gemini calls above which resend full history).
async function callOpenClaw(entry, apiKey, history) {
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (!lastUser) return '(tidak ada pesan untuk dikirim)';
  const res = await selfHostedFetch(entry.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session: 'main', message: lastUser.text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(res.status, `${entry.label} error: ${body.error ?? body.message ?? res.statusText}`);
  // Gateway response field naming varies by OpenClaw version/plugin config —
  // check the common shapes rather than assuming one.
  return (
    body.reply ?? body.message ?? body.text ?? body.content ?? JSON.stringify(body) ?? '(respons kosong)'
  );
}

// A2A (Agent2Agent protocol) — what a self-hosted Hermes Agent instance
// speaks (`hermes gateway setup` → A2A), confirmed against a live instance:
// JSON-RPC 2.0 over HTTP POST to the base URL, method 'message/send',
// Authorization: Bearer <shared token>. Genuinely different wire shape from
// OpenClaw's plain REST webhook, so it gets its own call function rather
// than being forced through callOpenClaw. contextId ties replies to the
// same conversation thread server-side — remembered per entry in-memory
// (same pattern as Gemini's entry._resolvedModel) so a reload just starts a
// fresh context instead of carrying a stale one.
async function callA2A(entry, apiKey, history) {
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (!lastUser) return '(tidak ada pesan untuk dikirim)';
  const message = {
    role: 'user',
    parts: [{ type: 'text', text: lastUser.text }],
    messageId: crypto.randomUUID(),
  };
  if (entry._a2aContextId) message.contextId = entry._a2aContextId;
  const res = await selfHostedFetch(entry.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: message.messageId,
      method: 'message/send',
      params: { message },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(res.status, `${entry.label} error: ${body.error?.message ?? res.statusText}`);
  if (body.error) throw httpError(res.status, `${entry.label} error: ${body.error.message ?? JSON.stringify(body.error)}`);
  let result = body.result;
  if (result?.contextId) entry._a2aContextId = result.contextId;

  // The agent can genuinely use its own tools (terminal, kanban, skills,
  // etc. — whatever it's configured with) to act on a natural-language
  // request, not just reply with text. A quick reply comes back COMPLETED
  // immediately, but a real tool run (a shell command, a multi-step skill)
  // can leave the task WORKING — poll tasks/get until it actually finishes
  // instead of returning whatever partial state message/send happened to
  // catch.
  const state = result?.status?.state;
  if (state && state !== 'TASK_STATE_COMPLETED' && state !== 'TASK_STATE_FAILED' && result?.id) {
    result = await pollA2ATask(entry, apiKey, result.id);
  }

  if (result?.status?.state === 'TASK_STATE_FAILED') {
    throw httpError(500, `${entry.label}: tugas gagal — ${result?.status?.message?.parts?.map((p) => p.text).join(' ') || 'tidak ada detail.'}`);
  }
  const parts = result?.status?.message?.parts ?? result?.artifacts?.[0]?.parts ?? [];
  const text = parts.map((p) => p.text).filter(Boolean).join('\n').trim();
  return text || '(respons kosong)';
}

// Polls tasks/get every 1.5s, up to 60s, while the agent is still running a
// tool (TASK_STATE_WORKING/SUBMITTED) — covers things like terminal
// commands or multi-step skills that don't finish inside one request.
async function pollA2ATask(entry, apiKey, taskId) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await selfHostedFetch(entry.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: taskId, method: 'tasks/get', params: { id: taskId } }),
    });
    const body = await res.json().catch(() => ({}));
    const result = body.result;
    const state = result?.status?.state;
    if (!state || state === 'TASK_STATE_COMPLETED' || state === 'TASK_STATE_FAILED') {
      return result;
    }
  }
  throw httpError(504, `${entry.label}: tugas belum selesai dalam 60 detik (mungkin masih berjalan di agent).`);
}
