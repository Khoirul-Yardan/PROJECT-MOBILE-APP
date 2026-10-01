// Calls whatever provider/agent the entry describes, directly from the web
// page — never through an AI Hub server. The key itself is decrypted fresh
// from Supabase (see credentials.js) right before each send and never kept
// around in this page longer than that.
import {
  saveCredential,
  listCredentials,
  hasCredential,
  getCredentialKey,
  removeCredential,
} from './credentials.js';

export const saveProvider = saveCredential;
export const listRegisteredProviders = listCredentials;
export const hasApiKey = hasCredential;
export const removeProvider = removeCredential;

/** history: [{role:'user'|'assistant'|'system', text}], returns the reply text. */
export async function sendChat(entry, history) {
  const apiKey = await getCredentialKey(entry.id);
  if (!apiKey) {
    throw new Error(`Belum ada kunci API tersimpan untuk ${entry.label}.`);
  }
  switch (entry.format) {
    case 'anthropic':
      return callAnthropic(entry, apiKey, history);
    case 'gemini':
      return callGemini(entry, apiKey, history);
    case 'openclaw':
      return callOpenClaw(entry, apiKey, history);
    default:
      return callOpenAiCompatible(entry, apiKey, history);
  }
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
  if (!res.ok) throw new Error(`${entry.label} error: ${body.error?.message ?? res.statusText}`);
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
  if (!res.ok) throw new Error(`${entry.label} error: ${body.error?.message ?? res.statusText}`);
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
  if (!res.ok) throw new Error(`${entry.label} error: ${body.error ?? body.message ?? res.statusText}`);
  // Gateway response field naming varies by OpenClaw version/plugin config —
  // check the common shapes rather than assuming one.
  return (
    body.reply ?? body.message ?? body.text ?? body.content ?? JSON.stringify(body) ?? '(respons kosong)'
  );
}

// Gemini takes the system prompt as a separate `systemInstruction` field.
async function callGemini(entry, apiKey, history) {
  const systemText = history
    .filter((m) => m.role === 'system')
    .map((m) => m.text)
    .join('\n\n');
  const contents = history
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));
  const res = await fetch(`${entry.endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      contents,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${entry.label} error: ${body.error?.message ?? res.statusText}`);
  return body.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '(respons kosong)';
}
