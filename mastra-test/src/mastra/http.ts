import { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';
import { agent, models } from './agents/ai-hub.ts';
import { agentTools } from './tools/ai-hub.ts';

export const protocol = 'ai-hub-mastra-v1';
const maxBytes = 256 * 1024;
const inputSchema = z.object({
  model: z.string().default(models[0]!.id).refine((id) => models.some((m) => m.id === id)),
  messages: z.array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string().min(1).max(16000) }).strict()).min(1).max(100),
}).strict().refine((body) => body.messages.at(-1)?.role === 'user');

export function capabilities() {
  return { protocol, models, skills: Object.entries(agentTools).map(([name, tool]) => ({ id: tool.id, name, description: tool.description })) };
}

type Input = z.infer<typeof inputSchema>;
type Generate = (input: Input, apiKey: string) => Promise<string>;
const generate: Generate = async (input, apiKey) => {
  const requestContext = new RequestContext();
  requestContext.set('googleApiKey', apiKey);
  requestContext.set('model', input.model);
  try {
    const messages = input.messages.map((m) => m.role === 'system' ? { role: 'system' as const, content: m.content }
      : m.role === 'assistant' ? { role: 'assistant' as const, content: m.content }
      : { role: 'user' as const, content: m.content });
    const result = await agent.generate(messages, { requestContext, maxSteps: 5, abortSignal: AbortSignal.timeout(90000) });
    return result.text;
  } finally {
    requestContext.delete('googleApiKey');
  }
};

function json(body: object, status = 200) {
  return Response.json({ protocol, ...body }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function readLimited(request: Request) {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new RangeError(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// Exported handler allows HTTP-contract tests without any paid model calls.
export async function handleChat(request: Request, invoke: Generate = generate): Promise<Response> {
  const apiKey = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!apiKey || apiKey.length > 4096) return json({ error: { message: 'Isi API key Gemini pada koneksi Mastra.' } }, 401);
  let input: Input;
  try {
    input = inputSchema.parse(await readLimited(request));
  } catch (error) {
    return json({ error: { message: error instanceof RangeError ? 'Pesan terlalu besar (maksimum 256 KiB).' : 'Format pesan atau model Mastra tidak valid.' } }, error instanceof RangeError ? 413 : 400);
  }
  try {
    const text = await invoke(input, apiKey);
    if (!text?.trim()) return json({ error: { message: 'Gemini tidak mengembalikan jawaban teks.' } }, 502);
    return json({ text });
  } catch (error) {
    // Upstream errors may embed keys, headers and prompts. Return only a
    // classified status; never serialize or log the error itself.
    let status = 502;
    let current: unknown = error;
    for (let depth = 0; current && typeof current === 'object' && depth < 5; depth++) {
      const item = current as { status?: number; statusCode?: number; name?: string; cause?: unknown };
      const code = item.statusCode || item.status;
      if (code === 401 || code === 403) { status = 401; break; }
      if (code === 429) { status = 429; break; }
      if (item.name === 'TimeoutError' || item.name === 'AbortError') { status = 504; break; }
      current = item.cause;
    }
    const message = status === 401 ? 'API key Gemini ditolak. Periksa key dan izin Google.'
      : status === 429 ? 'Kuota atau rate limit Gemini tercapai. Coba lagi nanti atau gunakan slot key lain.'
      : status === 504 ? 'Gemini terlalu lama merespons. Coba lagi.'
      : 'Permintaan Gemini gagal. Periksa key, akses model, dan koneksi server.';
    return json({ error: { message } }, status);
  }
}
