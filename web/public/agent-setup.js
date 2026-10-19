import { h } from './ui.js';
import { detectProvider, SELF_HOSTED_PROVIDERS, KNOWN_PROVIDERS } from './providers.js';
import { connectMastraAgent } from './ai.js';
import { CONNECTION_PREFIX, parseMastraConnection } from './mastra-connection.js';
import { countCredentialSlots } from './credentials.js';

// A token has no reliable server identity. Only key patterns and explicit
// protocol URLs are recognized locally; arbitrary tokens require a choice.
export function renderAgentSetup(root, save) {
  const panel = h(`<div class="card form-panel" id="agent-setup">
    <div class="field">
      <label for="key-input">API key, token, atau URL agent</label>
      <textarea id="key-input" rows="3" placeholder="Tempel API key, token, URL, atau kode koneksi" autocomplete="off" spellcheck="false"></textarea>
      <p class="field-hint">Mendukung Mastra, Hermes, OpenClaw, dan API lainnya. Data tambahan muncul sesuai kebutuhan.</p>
    </div>
    <div id="detect-result" aria-live="polite"></div>
  </div>`);
  root.appendChild(panel);
  const guide = h(`<section id="agent-recognition" aria-label="Pengenalan koneksi">
    <p class="section-title">Dikenal otomatis dari pola key-nya</p>
    <p class="field-hint">Pola membantu mengenali layanan; key belum tentu aktif. Key provider tidak otomatis menunjukkan agent yang memakainya.</p>
    <div class="list" id="recognized-keys"></div>
    <details style="margin-top:12px;"><summary>Mastra, Hermes Agent, OpenClaw, dan harness lain</summary>
      <p class="field-hint">Mastra: kode aihub-mastra-v1.… atau URL /ai-hub/agents/ID dikenali sebagai format koneksi AI Hub.</p>
      <p class="field-hint">Hermes Agent dan OpenClaw: token ditentukan pemilik server. Pilih jenisnya dan lengkapi URL; token saja tidak bisa dikenali otomatis.</p>
      <p class="field-hint">DeepSeek memakai awalan sk- yang juga dipakai layanan lain. Harness lain memerlukan API yang kompatibel; nama produk saja belum cukup. Pilih API lain jika server mendukung OpenAI-compatible.</p>
    </details>
  </section>`);
  for (const provider of KNOWN_PROVIDERS) {
    const row = h('<div class="row" style="padding:8px 0;"><div class="grow"><div class="item-title"></div><div class="muted small"></div></div></div>');
    row.querySelector('.item-title').textContent = provider.id === 'hermes' ? 'Nous Portal / Hermes (API model)' : provider.label;
    row.querySelector('.muted').textContent = provider.keyHint;
    guide.querySelector('#recognized-keys').appendChild(row);
  }
  root.appendChild(guide);
  const input = panel.querySelector('#key-input');
  const result = panel.querySelector('#detect-result');
  let revision = 0;

  function status(parent, text) {
    const node = h('<p class="field-hint" role="status"></p>');
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function field(parent, id, label, value = '', type = 'text') {
    const wrap = h(`<div class="field"><label for="${id}"></label><input id="${id}" type="${type}" autocomplete="off" spellcheck="false" /></div>`);
    wrap.querySelector('label').textContent = label;
    const control = wrap.querySelector('input');
    control.value = value;
    parent.appendChild(wrap);
    return control;
  }

  function validUrl(value) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('Gunakan URL http/https tanpa password, query, atau fragmen.');
    }
    return url.href.replace(/\/+$/, '');
  }

  function mastraAction(parent, getConnection) {
    const info = status(parent, 'Periksa koneksi untuk membaca identitas agent dan provider dari server.');
    const actions = h('<div></div>');
    const check = h('<button class="btn btn-primary" id="mastra-check">Periksa koneksi Mastra</button>');
    actions.appendChild(check);
    parent.appendChild(actions);
    // Editing any field invalidates the checked credential and its Save action.
    parent.oninput = () => {
      revision++;
      check.disabled = false;
      actions.replaceChildren(check);
      info.textContent = 'Data berubah. Periksa koneksi kembali.';
    };
    check.onclick = async () => {
      const checkedRevision = revision;
      check.disabled = true;
      info.textContent = 'Memeriksa agent...';
      try {
        const connection = getConnection();
        const { entry, metadata } = await connectMastraAgent(connection);
        if (revision !== checkedRevision || !check.isConnected) return;
        info.textContent = `Terhubung: ${entry.label}. Model: ${typeof metadata.agent.model === 'string' ? metadata.agent.model.slice(0, 120) : 'diatur server'}. Informasi dilaporkan server.`;
        const button = h('<button class="btn btn-primary" id="mastra-save">Simpan &amp; Hubungkan</button>');
        button.onclick = () => save(entry, connection.token, button);
        actions.replaceChildren(button);
      } catch (error) {
        if (revision === checkedRevision && check.isConnected) {
          info.textContent = error.message;
          check.disabled = false;
        }
      }
    };
  }

  input.addEventListener('input', () => {
    revision++;
    result.oninput = null;
    result.replaceChildren();
    const raw = input.value.trim();
    if (!raw) return;
    if (raw.startsWith(CONNECTION_PREFIX)) {
      try {
        const connection = parseMastraConnection(raw);
        status(result, `Terbaca: Mastra (kode koneksi). Tujuan: ${new URL(connection.endpoint).host} / ${connection.agentId}.`);
        mastraAction(result, () => connection);
      } catch (error) { status(result, error.message); }
      return;
    }
    const known = detectProvider(raw);
    if (known) {
      status(result, `Terbaca: ${known.label}${known.id === 'hermes' ? ' / Nous Portal (API model, bukan token Hermes Agent)' : ` (${known.type === 'agent' ? 'Agent' : 'Provider AI'})`} dari pola key. Validitas key diperiksa saat digunakan.`);
      const button = h('<button class="btn btn-primary" id="agent-save">Simpan &amp; Hubungkan</button>');
      button.onclick = async () => {
        const checkedRevision = revision;
        button.disabled = true;
        try {
          const count = await countCredentialSlots(known.id);
          if (revision !== checkedRevision || !button.isConnected) return;
          if (!count) { await save(known, raw, button); return; }
          // Preserve the existing extra-key flow instead of replacing a key.
          const label = field(result, 'slot-label', 'Nama slot tambahan', `${known.label} ${count + 1}`);
          button.textContent = 'Simpan sebagai slot baru';
          button.onclick = () => save({ ...known, label: label.value.trim() || `${known.label} ${count + 1}` }, raw, button);
          result.appendChild(button);
          button.disabled = false;
        } catch {
          if (button.isConnected) { status(result, 'Tidak dapat membaca slot key. Coba lagi.'); button.disabled = false; }
        }
      };
      result.appendChild(button);
      return;
    }
    let url = '';
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(raw)) {
      try { url = validUrl(raw); }
      catch { status(result, 'URL tidak valid. Gunakan http/https tanpa password, query, atau fragmen.'); return; }
    }
    const mastraPath = url && new URL(url).pathname.match(/\/ai-hub\/agents\/([\w-]{1,80})(?:\/(?:capabilities|chat))?$/);
    status(result, mastraPath ? 'Terbaca: format URL Mastra. Lengkapi token untuk memeriksa server.'
      : url ? 'URL terbaca. Pilih jenis agent untuk melengkapi koneksi.'
        : 'Token terbaca. Jenis agent belum dapat dikenali dari token ini; pilih di bawah.');
    const choice = h(`<div class="field"><label for="agent-kind">Jenis agent</label><select id="agent-kind">
      <option value="">Pilih jenis agent</option><option value="mastra">Mastra</option>
      <option value="hermes-agent">Hermes Agent (A2A)</option><option value="hermes-api-server">Hermes Agent (API Server)</option>
      <option value="openclaw-http">OpenClaw Gateway (HTTP resmi)</option><option value="openclaw">OpenClaw webhook lama (khusus)</option><option value="custom">API lain / harness (OpenAI-compatible)</option>
    </select></div>`);
    result.appendChild(choice);
    const extra = h('<div id="agent-extra"></div>');
    result.appendChild(extra);
    const select = choice.querySelector('select');
    select.onchange = () => {
      revision++;
      extra.oninput = null;
      extra.replaceChildren();
      const kind = select.value;
      if (!kind) return;
      const catalog = SELF_HOSTED_PROVIDERS.find(p => p.id === kind);
      status(extra, `Jenis dipilih: ${catalog?.label || (kind === 'mastra' ? 'Mastra' : 'API lain')}.`);
      const endpoint = url ? null : field(extra, 'agent-url', 'URL server agent');
      const token = url ? field(extra, 'agent-token', 'Token akses agent', '', 'password') : null;
      if (catalog?.urlHelp && endpoint) status(extra, catalog.urlHelp);
      if (kind === 'mastra') {
        const agentId = mastraPath ? null : field(extra, 'agent-id', 'ID agent dari pemilik server');
        status(extra, 'Token akses agent berbeda dari key Gemini/OpenAI. Jika tersedia, tempel kode koneksi Mastra di kolom utama agar semua data terisi otomatis.');
        mastraAction(extra, () => {
          const target = validUrl(url || endpoint.value.trim());
          const match = new URL(target).pathname.match(/\/ai-hub\/agents\/([\w-]{1,80})(?:\/(?:capabilities|chat))?$/);
          const connection = { endpoint: match ? target.slice(0, target.indexOf('/ai-hub/agents/')) : target,
            agentId: match?.[1] || agentId?.value.trim(), token: token ? token.value.trim() : raw };
          // Apply the same transport/token validation as a pasted envelope.
          const bytes = new TextEncoder().encode(JSON.stringify(connection));
          const encoded = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          return parseMastraConnection(CONNECTION_PREFIX + encoded);
        });
        return;
      }
      const name = kind === 'custom' ? field(extra, 'agent-name', 'Nama koneksi') : null;
      const model = kind === 'custom' ? field(extra, 'agent-model', 'ID model (opsional)') : null;
      let direct = null;
      if (catalog?.directSessionLabel) {
        const details = h('<details><summary>Pengaturan tambahan (opsional)</summary></details>');
        extra.appendChild(details);
        direct = field(details, 'agent-direct', catalog.directSessionLabel);
      }
      status(extra, 'Konfigurasi siap disimpan setelah dilengkapi. Koneksi dan token akan digunakan saat Chat dibuka.');
      const button = h('<button class="btn btn-primary" id="agent-save">Simpan &amp; Hubungkan</button>');
      const error = status(extra, '');
      extra.appendChild(button);
      button.onclick = async () => {
        try {
          let target = validUrl(url || endpoint.value.trim());
          if (kind === 'openclaw-http' || kind === 'hermes-api-server') {
            if (target.endsWith('/v1')) target += '/chat/completions';
            else if (!target.endsWith('/v1/chat/completions')) target += '/v1/chat/completions';
          }
          const secret = token ? token.value.trim() : raw;
          if (!secret || (name && !name.value.trim())) throw new Error('Lengkapi token dan nama koneksi.');
          const directUrl = direct?.value.trim() ? validUrl(direct.value.trim()) : '';
          const entry = { id: catalog?.id || `custom-${crypto.randomUUID()}`, label: catalog?.label || name.value.trim(),
            type: 'agent', format: catalog?.format || 'openai', endpoint: target, model: catalog?.model || model?.value.trim() || directUrl || '' };
          await save(entry, secret, button);
        } catch (e) { error.textContent = e.message || 'Periksa data koneksi.'; }
      };
    };
    if (mastraPath) { select.value = 'mastra'; select.onchange(); }
  });
}
