// This is an AI Hub connection envelope, not a universal Mastra API key.
export const CONNECTION_PREFIX = 'aihub-mastra-v1.';

export function parseMastraConnection(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 16000 || !raw.startsWith(CONNECTION_PREFIX)) throw new Error();
    const encoded = raw.slice(CONNECTION_PREFIX.length);
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error();
    const bytes = Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const url = new URL(data.endpoint);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error();
    if (url.username || url.password || url.search || url.hash) throw new Error();
    if (typeof data.agentId !== 'string' || !/^[\w-]{1,80}$/.test(data.agentId)) throw new Error();
    if (typeof data.token !== 'string' || !/^[\x21-\x7e]{16,4096}$/.test(data.token)) throw new Error();
    return { endpoint: url.href.replace(/\/+$/, ''), agentId: data.agentId, token: data.token };
  } catch {
    throw new Error('Kode koneksi Mastra tidak valid. Minta kode AI Hub dari pemilik agent, bukan API key provider.');
  }
}

export async function mastraConnectionEntry(connection, metadata) {
  if (metadata?.protocol !== 'ai-hub-mastra-agent-v1' || metadata.agent?.id !== connection.agentId
      || typeof metadata.agent.name !== 'string' || !metadata.agent.name.trim()) {
    throw new Error('Identitas agent tidak cocok atau server belum mendukung koneksi Mastra AI Hub.');
  }
  // Keep different servers/agents separate so token rotation cannot cross tenants.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(connection.endpoint + '\n' + connection.agentId));
  const id = 'mastra-' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const provider = typeof metadata.agent.provider === 'string' ? metadata.agent.provider.slice(0, 80) : '';
  return { id, label: `Mastra · ${metadata.agent.name.slice(0, 100)}${provider ? ` (${provider})` : ''}`,
    type: 'agent', format: 'mastra-agent', endpoint: `${connection.endpoint}/ai-hub/agents/${connection.agentId}`, model: '' };
}
