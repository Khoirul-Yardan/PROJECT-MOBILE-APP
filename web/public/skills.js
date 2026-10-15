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
];

const BY_FORMAT = { gemini: GEMINI_SKILLS };

/** Skills specific to this provider (empty for providers with none). */
export function providerSkills(entry) {
  return entry ? BY_FORMAT[entry.format] || [] : [];
}

/** Common + provider-specific, in menu order. */
export function skillsFor(entry) {
  return [...COMMON_SKILLS, ...providerSkills(entry)];
}
