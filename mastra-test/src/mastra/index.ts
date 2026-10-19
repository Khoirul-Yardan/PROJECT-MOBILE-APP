import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { agent } from './agents/ai-hub.ts';
import { agentTools } from './tools/ai-hub.ts';
import { capabilities, handleChat, protocol } from './http.ts';
import { connectionRoutes } from './connection-adapter.ts';

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
      ...connectionRoutes({
        id: 'ai-hub', name: 'Mastra Test', provider: 'Google', model: 'google/gemini-2.5-flash',
        token: () => process.env.AI_HUB_AGENT_TOKEN,
        skills: Object.entries(agentTools).map(([name, tool]) => ({ id: tool.id, name, description: tool.description })),
        generate: async messages => {
          const input = messages.map(m => m.role === 'system' ? { role: 'system' as const, content: m.content }
            : m.role === 'assistant' ? { role: 'assistant' as const, content: m.content }
            : { role: 'user' as const, content: m.content });
          const result = await agent.generate(input, { maxSteps: 5, abortSignal: AbortSignal.timeout(90000) });
          return result.text;
        },
      }),
      registerApiRoute('/ai-hub/health', { method: 'GET', handler: async (c) => c.json({ protocol, ok: true }) }),
      registerApiRoute('/ai-hub/capabilities', { method: 'GET', handler: async (c) => c.json(capabilities()) }),
      registerApiRoute('/ai-hub/chat', { method: 'POST', handler: async (c) => handleChat(c.req.raw) }),
    ],
  },
});
