import test from 'node:test';
import assert from 'node:assert/strict';
import { providerSkills } from '../public/skills.js';

test('vendor names do not invent remote desktop, shell or medical tools', () => {
  for (const entry of [
    { id: 'hermes', format: 'openai', endpoint: 'https://inference-api.nousresearch.com/v1/chat/completions' },
    { id: 'hermes-agent', format: 'a2a', endpoint: 'https://agent.example.test' },
    { id: 'hermes-api', format: 'hermes-api', endpoint: 'https://agent.example.test' },
    { id: 'groq', format: 'openai', endpoint: 'https://api.groq.com/openai/v1/chat/completions' },
    { id: 'openclaw', format: 'openclaw', endpoint: 'https://agent.example.test' },
  ]) assert.deepEqual(providerSkills(entry), []);
});
