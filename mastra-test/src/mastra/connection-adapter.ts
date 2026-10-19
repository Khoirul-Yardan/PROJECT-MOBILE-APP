import { timingSafeEqual } from 'node:crypto';
import { registerApiRoute } from '@mastra/core/server';
import { z } from 'zod';

export const connectionProtocol = 'ai-hub-mastra-agent-v1';
const schema = z.object({ messages: z.array(z.object({
  role: z.enum(['user', 'assistant', 'system']), content: z.string().min(1).max(16000),
}).strict()).min(1).max(100) }).strict().refine(body => body.messages.at(-1)?.role === 'user');
type Messages = z.infer<typeof schema>['messages'];
type Config = {
  id: string; name: string; provider?: string; model?: string;
  token: () => string | undefined;
  skills?: { id: string; name: string; description?: string }[];
  generate: (messages: Messages) => Promise<string>;
};

// The adapter authenticates the agent token. Provider credentials belong to
// the owner's generate callback and are never derived from this token.
export function connectionHandlers(config: Config) {
  if (!/^[\w-]{1,80}$/.test(config.id)) throw new Error('Invalid agent id');
  const json = (body: object, status = 200) => Response.json({ protocol: connectionProtocol, ...body }, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
  function authorized(request: Request) {
    const expected = config.token();
    const supplied = request.headers.get('authorization')?.match(/^Bearer ([\x21-\x7e]{16,4096})$/)?.[1];
    if (!expected || expected.length < 16 || !supplied) return false;
    const a = Buffer.from(expected), b = Buffer.from(supplied);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const denied = () => json({ error: { message: 'Token agent tidak valid atau belum dikonfigurasi.' } }, 401);
  return {
    capabilities: async (request: Request) => authorized(request) ? json({
      agent: { id: config.id, name: config.name, provider: config.provider, model: config.model },
      skills: config.skills || [],
    }) : denied(),
    chat: async (request: Request) => {
      if (!authorized(request)) return denied();
      let messages: Messages;
      try {
        const reader = request.body?.getReader();
        if (!reader) throw new Error();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 256 * 1024) { await reader.cancel(); return json({ error: { message: 'Pesan terlalu besar.' } }, 413); }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
        messages = schema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8'))).messages;
      } catch { return json({ error: { message: 'Format pesan tidak valid.' } }, 400); }
      try {
        const text = await config.generate(messages);
        if (typeof text !== 'string' || !text.trim()) throw new Error();
        return json({ text });
      } catch {
        // Provider errors can contain secrets or conversation text.
        return json({ error: { message: 'Agent gagal merespons. Hubungi pemilik agent.' } }, 502);
      }
    },
  };
}

export function connectionRoutes(config: Config) {
  const handlers = connectionHandlers(config);
  const base = `/ai-hub/agents/${config.id}`;
  return [
    registerApiRoute(`${base}/capabilities`, { method: 'GET', handler: c => handlers.capabilities(c.req.raw) }),
    registerApiRoute(`${base}/chat`, { method: 'POST', handler: c => handlers.chat(c.req.raw) }),
  ];
}
