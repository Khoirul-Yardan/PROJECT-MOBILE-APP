import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { agent } from './agents/ai-hub.ts';
import { agentTools } from './tools/ai-hub.ts';
import { capabilities, handleChat, protocol } from './http.ts';

export const mastra = new Mastra({
  agents: { agent },
  tools: agentTools,
  // Chat history belongs to the signed-in AI Hub account, never a shared
  // Mastra memory or trace store. Even provider errors can contain prompts.
  logger: false,
  server: {
    host: process.env.MASTRA_HOST || '127.0.0.1',
    port: 4111,
    apiRoutes: [
      registerApiRoute('/ai-hub/health', { method: 'GET', handler: async (c) => c.json({ protocol, ok: true }) }),
      registerApiRoute('/ai-hub/capabilities', { method: 'GET', handler: async (c) => c.json(capabilities()) }),
      registerApiRoute('/ai-hub/chat', { method: 'POST', handler: async (c) => handleChat(c.req.raw) }),
    ],
  },
});
