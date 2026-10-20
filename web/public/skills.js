// "/" palette in Chat, split by who it belongs to:
//   - COMMON_SKILLS: local meta-commands that work with any provider.
//   - providerSkills(entry): commands only the selected provider can honour —
//     picking Gemini shows Gemini's, picking another provider hides them. A2A
//     agents (Hermes Agent) are the exception: their list isn't hardcoded here,
//     chat.js fetches it live from the agent's own discovery card (see
//     ai.js getAgentSkills), so it always matches what that instance really has.
//
// A "toggle" skill flips a per-conversation tool on/off (e.g. Gemini's Google
// Search grounding); the chat sends the enabled set along with each message
// and ai.js maps it onto that provider's real request shape. Nothing here is
// simulated: a toggle only exists if the provider's API genuinely supports it.

export const COMMON_SKILLS = [
  { cmd: '/system', label: 'Atur instruksi sistem', hint: '/system <instruksi untuk AI>', needsArgs: true },
  { cmd: '/clear', label: 'Bersihkan percakapan ini', hint: '/clear', needsArgs: false },
  { cmd: '/help', label: 'Lihat semua perintah', hint: '/help', needsArgs: false },
  { cmd: '/skills', label: 'Muat ulang kemampuan provider/agent', hint: '/skills', needsArgs: false },
];

const GEMINI_SKILLS = [
  {
    cmd: '/search',
    label: 'Cari di Google (jawaban berbasis web)',
    hint: '/search — aktif/nonaktifkan Google Search',
    needsArgs: false,
    toggle: 'search',
  },
  {
    cmd: '/code',
    label: 'Jalankan kode Python untuk menghitung',
    hint: '/code — aktif/nonaktifkan eksekusi kode',
    needsArgs: false,
    toggle: 'code',
  },
  { cmd: '/url', label: 'Baca halaman dari URL publik', hint: '/url — aktif/nonaktifkan URL context', needsArgs: false, toggle: 'url' },
];

const search = { cmd: '/search', label: 'Cari informasi di web', hint: '/search — aktif/nonaktifkan pencarian web', needsArgs: false, toggle: 'search' };
const code = { cmd: '/code', label: 'Jalankan Python (Code Interpreter)', hint: '/code — aktif/nonaktifkan Code Interpreter', needsArgs: false, toggle: 'code' };

/** Skills specific to this provider (empty for providers with none). */
export function providerSkills(entry) {
  if (!entry) return [];
  if (entry.format === 'gemini') return GEMINI_SKILLS;
  // Agent abilities come from discovery, not the vendor name. A model API
  // (including Nous/Groq) does not provide a terminal or clinical workflow.

  let host;
  try { host = new URL(entry.endpoint).hostname; } catch { return []; }
  if (entry.format === 'openai' && host === 'api.openai.com') {
    // Conservative model allowlist; an OpenAI-compatible URL alone does not
    // imply that hosted Responses tools are available there.
    const model = entry.model || '';
    if (/^gpt-4o(?:-mini)?(?:-\d{4}-\d{2}-\d{2})?$/.test(model)) return [search];
    if (/^(?:gpt-4\.1(?:-mini)?|gpt-5(?:\.\d+)?(?:-mini)?)(?:-\d{4}-\d{2}-\d{2})?$/.test(model)) return [search, code];
  }
  if (entry.format === 'openai' && host === 'openrouter.ai') return [search];
  if (entry.format === 'anthropic' && host === 'api.anthropic.com'
    && /^claude-(?:(?:sonnet|opus|haiku)-4|3-7-sonnet|3-5-sonnet)/.test(entry.model || '')) return [search];
  return [];
}

/** Common + provider-specific, in menu order. */
export function skillsFor(entry) {
  return [...COMMON_SKILLS, ...providerSkills(entry)];
}
