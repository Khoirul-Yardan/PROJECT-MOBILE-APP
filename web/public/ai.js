// Calls the AI provider's own API directly from the web page — never
// through an AI Hub server. The key itself is fetched fresh from native
// secure storage (via the bridge) right before each send and never kept
// around in this page longer than that.
import { Native } from './bridge.js';

export const PROVIDERS = {
  openai: { label: 'OpenAI' },
  anthropic: { label: 'Claude' },
  gemini: { label: 'Gemini' },
};

export async function hasApiKey(provider) {
  const result = await Native.hasApiKey(provider);
  return !!(result && result.has);
}

/** history: [{role:'user'|'assistant', text}], returns the reply text. */
export async function sendChat(provider, history) {
  const keyResult = await Native.getApiKey(provider);
  const apiKey = keyResult && keyResult.key;
  if (!apiKey) {
    throw new Error(`No API key saved for ${PROVIDERS[provider].label} yet.`);
  }
  switch (provider) {
    case 'openai':
      return callOpenAi(apiKey, history);
    case 'anthropic':
      return callAnthropic(apiKey, history);
    case 'gemini':
      return callGemini(apiKey, history);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function callOpenAi(apiKey, history) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: history.map((m) => ({ role: m.role, content: m.text })),
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`OpenAI error: ${body.error?.message ?? res.statusText}`);
  return body.choices?.[0]?.message?.content?.trim() ?? '(empty response)';
}

async function callAnthropic(apiKey, history) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: history.map((m) => ({ role: m.role, content: m.text })),
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Claude error: ${body.error?.message ?? res.statusText}`);
  return body.content?.[0]?.text?.trim() ?? '(empty response)';
}

async function callGemini(apiKey, history) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: history.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.text }],
        })),
      }),
    }
  );
  const body = await res.json();
  if (!res.ok) throw new Error(`Gemini error: ${body.error?.message ?? res.statusText}`);
  return body.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '(empty response)';
}
