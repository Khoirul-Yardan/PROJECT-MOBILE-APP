import { Agent } from '@mastra/core/agent';
import { agentTools } from '../tools/ai-hub.ts';

export const models = [
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'google/gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
] as const;

export const agent = new Agent({
  id: 'ai-hub',
  name: 'Mastra Test (Gemini)',
  instructions: 'Kamu asisten chat umum berbahasa Indonesia. Jawab jelas dan ringkas. '
    + 'Gunakan calculate untuk perhitungan dan current_time untuk waktu sekarang. '
    + 'Awalan /calculate dan /current_time adalah permintaan pengguna untuk tools tersebut. '
    + 'Jangan mengaku menjalankan tool jika tidak dijalankan. Jangan menetapkan diagnosis atau saran obat. '
    + 'Kamu tidak memiliki akses data pasien, filesystem, shell, atau akun dokter.',
  model: ({ requestContext }) => ({
    id: models.find((m) => m.id === requestContext.get('model'))?.id || models[0].id,
    // Studio and the authenticated connection adapter use the owner's key.
    // The legacy BYOK route sets its own non-empty per-request key.
    apiKey: String(requestContext.get('googleApiKey') || process.env.GOOGLE_API_KEY || ''),
  }),
  tools: agentTools,
  maxRetries: 0,
  defaultOptions: { maxSteps: 5 },
});
