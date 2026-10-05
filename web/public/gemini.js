// Gemini model discovery and bounded recovery. No credentials are cached here.
// https://ai.google.dev/api/models
export function normalizeGeminiModel(model) {
  return String(model || '').trim().replace(/^models\//, '');
}

function modelsUrl(endpoint) {
  const url = new URL(endpoint);
  const index = url.pathname.indexOf('/models');
  if (index < 0) throw new Error('Endpoint Gemini harus memuat path /models.');
  url.pathname = url.pathname.slice(0, index) + '/models';
  url.search = '';
  url.hash = '';
  return url;
}

export function geminiEndpoint(endpoint, model) {
  const id = normalizeGeminiModel(model);
  if (!/^[a-zA-Z0-9._-]+$/.test(id) || id === 'auto') throw new Error('ID model Gemini tidak valid.');
  const url = modelsUrl(endpoint);
  url.pathname += `/${id}:generateContent`;
  return url.toString();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// "High demand" 503s from Google are explicitly documented as usually
// transient, so a couple of short retries clear most of them before
// bothering the model-fallback logic at all.
const RETRY_503_DELAYS_MS = [700, 1800];

async function request(url, apiKey, payload) {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(url, {
        method: payload ? 'POST' : 'GET',
        headers: { 'x-goog-api-key': apiKey, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 503 && attempt < RETRY_503_DELAYS_MS.length) {
          await sleep(RETRY_503_DELAYS_MS[attempt]);
          continue;
        }
        // Some provider errors echo their request; never expose a credential.
        const message = String(body.error?.message || response.statusText || 'Permintaan gagal.').split(apiKey).join('[key]');
        const error = new Error(`Gemini: ${message}`);
        error.status = response.status;
        error.modelUnavailable =
          ([400, 404].includes(response.status)
            && /model/i.test(message)
            && /not found|not supported|no longer|not available|does not exist|deprecated/i.test(message))
          // A 429 quoting "limit: 0" for this model means the model itself
          // has no free-tier quota at all (a paid/preview-only model) —
          // permanent for every key on this tier, not a transient rate
          // limit. Switching API keys can't fix it; switching *model* can,
          // so route it through the same model-fallback path instead of
          // key rotation.
          || (response.status === 429 && /limit:\s*0\b/i.test(message))
          // Still 503 after retrying — this model specifically is
          // overloaded right now; let another model take over instead of
          // surfacing "try again later" straight to the user.
          || response.status === 503;
        throw error;
      }
      return body;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Gemini terlalu lama merespons. Silakan coba lagi.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

function textModel(model) {
  return model.supportedGenerationMethods?.includes('generateContent')
    && /^models\/[a-zA-Z0-9._-]+$/.test(model.name || '')
    && !/(embedding|image|tts|audio|live|robotics|aqa)/i.test(model.name);
}

function rank(id) {
  const preview = /preview|experimental|(?:^|-)exp(?:-|$)/i.test(id) ? 20 : 0;
  return preview + (/flash-lite/i.test(id) ? 1 : /flash/i.test(id) ? 0 : /pro/i.test(id) ? 5 : 10);
}

export async function listGeminiModels(entry, apiKey) {
  const models = new Map();
  const seenTokens = new Set();
  let token = '';
  do {
    const url = modelsUrl(entry.endpoint);
    url.searchParams.set('pageSize', '1000');
    if (token) url.searchParams.set('pageToken', token);
    const body = await request(url, apiKey);
    for (const model of body.models || []) {
      if (textModel(model)) {
        const id = normalizeGeminiModel(model.name);
        models.set(id, { id, label: model.displayName || id });
      }
    }
    token = body.nextPageToken || '';
    if (token && (seenTokens.has(token) || seenTokens.size >= 20)) {
      throw new Error('Daftar model Gemini tidak dapat dimuat lengkap. Coba lagi.');
    }
    seenTokens.add(token);
  } while (token);
  return [...models.values()].sort((a, b) => rank(a.id) - rank(b.id) || b.id.localeCompare(a.id, 'en', { numeric: true }));
}

function payloadFor(history) {
  const system = history.filter((m) => m.role === 'system').map((m) => m.text).join('\n\n');
  // Local greetings/command feedback must not become an initial model turn.
  const messages = history.filter((m) => m.role !== 'system');
  while (messages.length && messages[0].role !== 'user') messages.shift();
  const contents = [];
  for (const message of messages) {
    const role = message.role === 'assistant' ? 'model' : 'user';
    const previous = contents.at(-1);
    if (previous?.role === role) previous.parts.push({ text: message.text });
    else contents.push({ role, parts: [{ text: message.text }] });
  }
  return { ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents };
}

export async function generateGemini(entry, apiKey, history) {
  const payload = payloadFor(history);
  const preferred = normalizeGeminiModel(entry.model);
  const first = preferred && preferred !== 'auto' ? preferred : entry._resolvedModel;
  const attempted = new Set();
  let lastError;

  async function attempt(model) {
    attempted.add(model);
    try {
      const body = await request(geminiEndpoint(entry.endpoint, model), apiKey, payload);
      if (body.promptFeedback?.blockReason) throw new Error('Gemini tidak dapat menjawab pesan ini. Coba ubah pertanyaannya.');
      const text = (body.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
      if (!text) throw new Error('Gemini tidak mengembalikan jawaban teks. Coba ubah pesan atau pilih model lain.');
      return { text, model, previousModel: first || null, changed: model !== first };
    } catch (error) {
      if (!error.modelUnavailable) throw error;
      lastError = error;
      return null;
    }
  }

  if (first) {
    const result = await attempt(first);
    if (result) return result;
  }
  // Discover using this provider's existing host/API version, then retry only
  // model-availability errors. Auth, quota, safety and network errors stop here.
  const available = await listGeminiModels(entry, apiKey);
  // 5 instead of 3: a 503 (transient "high demand") now also counts as a
  // model-fallback case, not just missing/zero-quota models, so a couple
  // of extra candidates keep the odds reasonable without retrying forever.
  for (const model of available.filter((m) => !attempted.has(m.id)).slice(0, 5)) {
    const result = await attempt(model.id);
    if (result) return result;
  }
  throw new Error(lastError
    ? 'Model Gemini yang dicoba belum tersedia. Buka Pilih model untuk memilih atau memperbarui daftar model.'
    : 'Tidak ada model chat Gemini yang tersedia untuk koneksi ini. Periksa API key atau pilih model secara manual.');
}
