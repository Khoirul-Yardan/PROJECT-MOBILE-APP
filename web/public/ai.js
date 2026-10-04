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
export async function sendChat(entry, history, { onModelChange, onSlotChange } = {}) {
  switch (entry.format) {
    case 'anthropic':
      return callWithRotation(entry, (apiKey) => callAnthropic(entry, apiKey, history), onSlotChange);
    case 'gemini':
      return callWithRotation(entry, async (apiKey) => {
        const result = await generateGemini(entry, apiKey, history);
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
    default:
      return callWithRotation(entry, (apiKey) => callOpenAiCompatible(entry, apiKey, history), onSlotChange);
  }
}

export async function availableModels(entry) {
  if (entry.format !== 'gemini') return [];
  const key = await getCredentialKey(entry.id);
  if (!key) throw new Error('Kunci API belum tersedia. Hubungkan ulang provider ini.');
  return listGeminiModels(entry, key);
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
  const res = await fetch(entry.endpoint, {
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
