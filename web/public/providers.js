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
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    model: 'gemini-1.5-flash',
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
    model: 'Hermes-4-70B',
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
