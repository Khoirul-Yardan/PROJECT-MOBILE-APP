import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CONNECTION_PREFIX, parseMastraConnection } from '../../web/public/mastra-connection.js';

// Only non-secret arguments go on the command line. The token comes from
// environment/.env; the generated credential is written to a local file.
const [endpoint, agentId, output] = process.argv.slice(2);
try {
  if (!output || !output.endsWith('.connection.txt')) throw new Error();
  const code = CONNECTION_PREFIX + Buffer.from(JSON.stringify({ endpoint, agentId, token: process.env.AI_HUB_AGENT_TOKEN })).toString('base64url');
  parseMastraConnection(code);
  await writeFile(output, code, { flag: 'wx', mode: 0o600 });
  console.log(`Kode koneksi disimpan: ${resolve(output)}`);
} catch {
  console.error('Gagal membuat kode. Isi AI_HUB_AGENT_TOKEN; gunakan endpoint https (http hanya localhost), agentId, dan file baru berakhiran .connection.txt.');
  process.exitCode = 1;
}
