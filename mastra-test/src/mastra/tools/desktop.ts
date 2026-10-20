import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createHash } from 'node:crypto';

const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('screenshot') }).strict(),
  z.object({ action: z.literal('click'), x: z.number().int().nonnegative(), y: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal('key'), key: z.enum(['TAB', 'ESC', 'UP', 'DOWN', 'LEFT', 'RIGHT']) }).strict(),
]);
type DesktopInput = z.infer<typeof inputSchema>;
export const desktopEnabled = () => Boolean(process.env.AI_HUB_DESKTOP_TOKEN);

export function screenshotMarkdown(image: unknown, sha256: unknown) {
  const parsed = z.object({ mimeType: z.literal('image/png'), data: z.string().max(5592408).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict().parse(image);
  const bytes = Buffer.from(parsed.data, 'base64');
  if (bytes.length > 4 * 1024 * 1024 || bytes.length < 24
    || parsed.data !== bytes.toString('base64')
    || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    || createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('Lampiran screenshot tidak valid.');
  return `![Screenshot layar laptop](data:image/png;base64,${parsed.data})`;
}

export async function runDesktop(input: DesktopInput) {
  inputSchema.parse(input);
  if (!desktopEnabled()) throw new Error('Desktop belum diaktifkan. Jalankan scripts/desktop_bridge.py di laptop.');
  // Fixed destination: caller/model cannot turn this into arbitrary HTTP access.
  const url = process.env.MASTRA_HOST === '0.0.0.0'
    ? 'http://host.docker.internal:4112/action' : 'http://127.0.0.1:4112/action';
  try {
    const response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_HUB_DESKTOP_TOKEN}` },
      body: JSON.stringify(input), signal: AbortSignal.timeout(15000), redirect: 'error',
    });
    if (!response.ok) throw new Error();
    const reader = response.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 6 * 1024 * 1024) { await reader.cancel(); throw new Error(); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { message?: string; image?: unknown; sha256?: string };
    if (typeof result.message !== 'string') throw new Error();
    return { message: result.message + (input.action === 'screenshot' && result.image
      ? `\n\n${screenshotMarkdown(result.image, result.sha256)}` : '') };
  } catch {
    throw new Error('Desktop tidak tersedia atau kontrol belum diizinkan. Periksa bridge di laptop (masa aktif 60 menit).');
  }
}

// Desktop actions are dispatched from the exact latest user command below.
// LLM-generated calls and the public legacy BYOK endpoint cannot authorize them.
export const desktopTool = createTool({
  id: 'computer',
  description: 'Kontrol laptop terbatas. Kirim /computer screenshot untuk gambar di Chat, /computer click X Y, atau /computer key TAB|ESC|UP|DOWN|LEFT|RIGHT. Bridge lokal harus aktif.',
  inputSchema,
  execute: async () => ({ message: 'Gunakan perintah /computer eksplisit di Chat AI Hub; panggilan otomatis model tidak diizinkan.' }),
});

export async function handleDesktopCommand(text: string): Promise<string | null> {
  if (!/^\/computer(?:\s|$)/.test(text)) return null;
  const words = text.trim().split(/\s+/);
  let input: DesktopInput;
  if (words.length === 2 && words[1] === 'screenshot') input = { action: 'screenshot' };
  else if (words.length === 4 && words[1] === 'click' && words.slice(2).every(w => /^\d{1,5}$/.test(w))) {
    input = { action: 'click', x: Number(words[2]), y: Number(words[3]) };
  } else if (words.length === 3 && words[1] === 'key' && /^(TAB|ESC|UP|DOWN|LEFT|RIGHT)$/.test(words[2]!)) {
    input = inputSchema.parse({ action: 'key', key: words[2] });
  } else return 'Format: /computer screenshot | /computer click X Y | /computer key TAB|ESC|UP|DOWN|LEFT|RIGHT. Satu aksi per pesan.';
  try { return (await runDesktop(input)).message; }
  catch (error) { return (error as Error).message; }
}
