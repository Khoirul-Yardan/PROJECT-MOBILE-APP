// Catalog of AI providers/agents this app recognizes automatically from the
// *shape* of a pasted API key — the user never has to go find "the Gemini
// menu" first. `detectProvider()` is used by the universal "Add API key"
// flow; anything that doesn't match becomes a manually-tagged custom entry
// (see views/add-api-key.js) with the same shape, so downstream code never
// has to care whether an entry was auto-detected or hand-entered.
//
// `format` picks which request/response shape ai.js uses to call it —
// 'openai' covers the large majority of chat + agent APIs today (OpenAI
// itself, OpenRouter, and most self-hosted/agent gateways mimic it).
// Anthropic and Gemini get their own formats because their wire protocol is
// genuinely different, not just a different URL.

export const KNOWN_PROVIDERS = [
  {
    id: 'openai',
    label: 'ChatGPT',
    vendor: 'OpenAI',
    type: 'chat',
    format: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    // Negative lookahead excludes sk-ant-/sk-or-v1-/sk-nous- (and any
    // future "sk-<vendor>-" prefix) so this catch-all pattern doesn't
    // shadow the more specific entries below it — detectProvider() checks
    // in array order, so a key like "sk-ant-..." must fail this test and
    // fall through to the Anthropic entry, not match here first.
    keyPattern: /^sk-(?!ant-|or-v1-|nous-)(proj-)?[A-Za-z0-9_-]{20,}$/,
    icon: 'spark',
  },
  {
    id: 'anthropic',
    label: 'Claude',
    vendor: 'Anthropic',
    type: 'chat',
    format: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-haiku-20241022',
    keyPattern: /^sk-ant-/,
    icon: 'spark',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    vendor: 'Google',
    type: 'chat',
    format: 'gemini',
    endpoint:
      'https://generativelanguage.googleapis.com/v1beta/models',
    model: 'auto',
    // Google has issued two key shapes from aistudio.google.com/apikey:
    // the classic `AIzaSy...` (still valid for existing keys) and the newer
    // `AQ.Ab8R...`-style key (dot-separated, starts with "AQ.").
    keyPattern: /^(AIza[0-9A-Za-z_-]{35}|AQ\.[A-Za-z0-9_-]{20,})$/,
    icon: 'spark',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    vendor: 'OpenRouter',
    type: 'chat',
    format: 'openai',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'openrouter/auto',
    keyPattern: /^sk-or-v1-/,
    icon: 'layers',
  },
  {
    // Small, fast Llama on Groq's free tier - the lightweight hosted option
    // for the demo (nothing runs on the user's laptop or the Fly machine).
    // Groq has no medical-tuned Llama, so the clinical behaviour comes from
    // MEDICAL_SYSTEM_PROMPT below, applied by chat.js when no /system is set.
    id: 'groq',
    label: 'Llama Medis (Groq)',
    vendor: 'Groq',
    type: 'chat',
    format: 'openai',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.1-8b-instant',
    keyPattern: /^gsk_[A-Za-z0-9]{20,}$/,
    icon: 'spark',
    defaultSystem: 'medical',
  },
  {
    // Hermes is real and reachable by API: Nous Research runs an
    // OpenAI-compatible inference endpoint (Nous Portal) that serves the
    // Hermes model family behind a `sk-nous-...` key from
    // portal.nousresearch.com — same wire shape as OpenAI, so it slots into
    // the existing 'openai' format instead of needing a new one.
    id: 'hermes',
    label: 'Hermes',
    vendor: 'Nous Research',
    type: 'agent',
    format: 'openai',
    endpoint: 'https://inference-api.nousresearch.com/v1/chat/completions',
    // The Portal is an OpenRouter-style aggregator across many vendors'
    // models, not a single dedicated "Hermes" model — there's no model
    // literally named Hermes in its catalog. Default to a known-working
    // free-tier model (confirmed reachable, and it's Hermes Agent's own
    // config.yaml default too) so a first message doesn't 404; the model
    // picker (see model-picker.js) lets the user pick a real one from the
    // live /v1/models list instead of typing an ID blind.
    model: 'stepfun/step-3.7-flash:free',
    keyPattern: /^sk-nous-/,
    icon: 'layers',
  },
];

// Self-hosted gateways: no fixed vendor endpoint to auto-detect a key
// against (each user runs their own instance at their own URL), so these
// need both a URL and a token typed in once instead of a single pasted key.
// OpenClaw normally talks to Telegram/WhatsApp/Slack/etc. as its "channel" —
// but it also ships a Gateway REST API / Custom Webhook plugin that turns
// *any* HTTP client into a channel the same way, so this app can be that
// channel instead of Telegram: same agent, replies land here.
export const SELF_HOSTED_PROVIDERS = [
  {
    id: 'openclaw',
    label: 'OpenClaw',
    vendor: 'Self-hosted (Gateway kamu sendiri)',
    type: 'agent',
    format: 'openclaw',
    icon: 'layers',
    urlPlaceholder: 'https://gateway-openclaw-kamu.example.com',
    urlHelp: 'URL Gateway OpenClaw kamu (Settings → API di instance-mu) — bukan URL Telegram.',
    tokenHelp: 'Bearer token dari OpenClaw (Custom Webhook / Gateway API, config receiveSecret).',
    directSessionLabel: 'Link channel resmi (opsional)',
    directSessionPlaceholder: 'https://t.me/nama_bot_kamu',
    directSessionHelp: 'Link Telegram/WhatsApp/dsb yang sudah terhubung ke OpenClaw-mu — dipakai Chat untuk tombol "buka sesi langsung" saat agent minta persetujuan yang tidak bisa diberikan lewat sini.',
  },
  {
    // Nous Research's "Hermes Agent" (hermes-agent.nousresearch.com) is a
    // self-hosted agent, separate from the hosted Hermes inference API
    // (that one just needs an sk-nous-... key — see KNOWN_PROVIDERS). To
    // reach a self-hosted Hermes Agent instance from here, it exposes the
    // A2A (Agent2Agent) protocol — JSON-RPC over HTTP, not a plain REST
    // webhook — enabled via `hermes gateway setup` → A2A, which prints the
    // base URL (http://host:9900/) and the bearer token you set there.
    id: 'hermes-agent',
    label: 'Hermes Agent (A2A)',
    vendor: 'Self-hosted (Nous Research Hermes Agent)',
    type: 'agent',
    format: 'a2a',
    icon: 'layers',
    urlPlaceholder: 'http://host-laptopmu:9900/',
    urlHelp: 'URL dasar A2A Hermes Agent-mu — didapat dari `hermes gateway setup` → aktifkan A2A.',
    tokenHelp: 'Shared bearer token yang kamu isi saat setup A2A (tersimpan sebagai A2A_BEARER_TOKEN).',
    // A2A is deliberately untrusted by Hermes Agent for anything sensitive
    // (device control, etc.) — it'll refuse and ask for approval "in your
    // direct session" instead. There's no way to grant that consent through
    // A2A itself (any flag we send could be forged by anyone else talking
    // A2A too, which is exactly the hole this refusal exists to close), so
    // the only legitimate fix is a real direct session — Telegram, in most
    // setups. This link lets Chat offer a one-tap way there.
    directSessionLabel: 'Link bot Telegram',
    directSessionPlaceholder: 'https://t.me/nama_bot_kamu',
    directSessionHelp: 'Opsional — dipakai Chat untuk tombol "buka sesi langsung" saat Hermes Agent menolak aksi (mis. computer_use) karena masuk lewat A2A, bukan sesi langsung.',
  },
  {
    // Hermes Agent's OTHER self-hosted surface, genuinely different trust
    // model from A2A above: the API Server is the same integration point
    // apps like Open WebUI/LobeChat use for *full* tool access (terminal,
    // files, computer_use, ...) — it's the trusted direct-session path, not
    // sandboxed the way A2A deliberately is. Same OpenAI chat-completions
    // wire shape as KNOWN_PROVIDERS' 'openai' format (so callOpenAiCompatible
    // just works), but still routed through selfHostedFetch like the other
    // self-hosted entries since it's on the user's own LAN/host and won't
    // have CORS headers unless they set API_SERVER_CORS_ORIGINS themselves —
    // the relay sidesteps needing that.
    id: 'hermes-api-server',
    label: 'Hermes Agent (API Server)',
    vendor: 'Self-hosted (Nous Research Hermes Agent — akses penuh)',
    type: 'agent',
    format: 'hermes-api',
    icon: 'layers',
    urlPlaceholder: 'http://host-laptopmu:8642/v1/chat/completions',
    urlHelp: 'Aktifkan dulu: API_SERVER_ENABLED=true di ~/.hermes/.env (atau folder HERMES_HOME-mu), lalu `hermes gateway restart`. Endpoint defaultnya port 8642.',
    tokenHelp: 'API_SERVER_KEY yang kamu set di .env yang sama.',
  },
];

/** Returns the matching catalog entry for a pasted key, or null if none of
 * the known patterns fit — the caller should fall back to manual tagging. */
export function detectProvider(rawKey) {
  const key = (rawKey || '').trim();
  if (!key) return null;
  return KNOWN_PROVIDERS.find((p) => p.keyPattern.test(key)) ?? null;
}

export function slugify(label) {
  return (
    (label || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `custom-${Date.now()}`
  );
}

/** Default instruction for catalog entries flagged `defaultSystem: 'medical'`.
 * A prompt, not a medical model: it keeps a small general Llama cautious. */
export const MEDICAL_SYSTEM_PROMPT =
  'Kamu asisten informasi kesehatan untuk perawat di Indonesia. Jawab dalam Bahasa Indonesia, '
  + 'ringkas dan terstruktur (poin-poin). Bantu dengan anamnesis, istilah medis, dokumentasi keperawatan, '
  + 'dan edukasi pasien. Jangan menetapkan diagnosis pasti atau dosis obat spesifik; sebut tanda bahaya '
  + '(red flag) yang perlu segera dirujuk ke dokter. Bila tidak yakin, katakan tidak yakin. '
  + 'Ingatkan bahwa jawabanmu bukan pengganti penilaian dokter.';
