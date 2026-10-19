import { h, header, icon, toast, pageIntro } from '../ui.js';
import { KNOWN_PROVIDERS, SELF_HOSTED_PROVIDERS, detectProvider, slugify } from '../providers.js';
import { saveProvider, connectMastraAgent } from '../ai.js';
import { CONNECTION_PREFIX, parseMastraConnection } from '../mastra-connection.js';
import { countCredentialSlots } from '../credentials.js';
import { logActivity } from '../db.js';
import { OAUTH_PROVIDER_IDS, oauthSupported, startOpenRouterLogin } from '../oauth.js';

// Two entry points into the same underlying flow: "Hubungkan Provider AI"
// (ChatGPT/Claude/Gemini/OpenRouter — reply comes straight from the model)
// and "Hubungkan Agent" (Hermes, OpenClaw — can take actions, not just
// reply) land here with a different `type` query param so each screen only
// shows what belongs to it. They still end up as the same kind of saved
// entry and both show up side by side in the Chat picker — the split is
// just so setup doesn't blend the two concepts together for the user.
export default async function render(root) {
  const params = new URLSearchParams((location.hash.split('?')[1] || ''));
  const mode = params.get('type') === 'agent' ? 'agent' : 'provider';
  const isAgent = mode === 'agent';

  const providersForMode = KNOWN_PROVIDERS.filter((p) => (isAgent ? p.type === 'agent' : p.type === 'chat'));
  const selfHostedForMode = isAgent ? SELF_HOSTED_PROVIDERS : [];

  let detected = null;
  let manualMode = false;
  let manualType = mode;

  const el = h(`<div class="page add-api-page"></div>`);
  el.appendChild(header(isAgent ? 'Hubungkan Agent' : 'Hubungkan Provider AI', { back: true }));
  el.appendChild(pageIntro(isAgent ? 'Undang asisten barumu.' : 'Bawa AI favoritmu.', isAgent ? 'Hubungkan agent untuk membantu tugas sehari-hari.' : 'Siapkan API key dari provider pilihanmu untuk mulai mengobrol.', { art: isAgent ? 'bot' : 'providers', label: 'KONEKSI BARU', tone: isAgent ? 'intro-mint' : '' }));

  // Option 1 of 2: log in with the provider account instead of pasting a key.
  // Only providers that officially support OAuth appear here (see oauth.js).
  const oauthProviders = providersForMode.filter((p) => OAUTH_PROVIDER_IDS.includes(p.id));
  if (oauthProviders.length > 0) {
    const loginCard = h(`
      <div class="card form-panel" id="oauth-card">
        <div class="item-title" style="margin-bottom:4px;">Login dengan akun</div>
        <p class="muted small" style="margin:0 0 12px;">Tanpa tempel key — masuk ke akun provider, key dibuat otomatis.</p>
      </div>
    `);
    oauthProviders.forEach((p) => {
      const btn = h(`<button class="btn btn-outline" data-oauth="${p.id}" style="margin-bottom:8px;">${icon(p.icon)}<span> Login dengan akun ${p.label}</span></button>`);
      btn.onclick = async () => {
        try {
          await startOpenRouterLogin();
        } catch (e) {
          toast(e.message);
        }
      };
      loginCard.appendChild(btn);
    });
    if (!oauthSupported()) {
      loginCard.appendChild(h('<p class="field-hint" id="oauth-note">Login akun butuh alamat https atau localhost; di alamat ini pakai API key di bawah.</p>'));
    }
    el.appendChild(loginCard);
    el.appendChild(h('<p class="section-title" style="text-align:center;">atau</p>'));
  }

  let mastraInput = null;
  let mastraResult = null;
  if (isAgent) {
    const card = h(`
      <div class="card form-panel" id="mastra-card">
        <div class="row" style="margin-bottom:10px;">
          <span class="feature-icon">${icon('layers')}</span>
          <div class="grow"><div class="item-title">Mastra</div><div class="muted small">Agent milikmu atau pemilik lain ? provider bebas</div></div>
          <span class="pill">Agent</span>
        </div>
        <div class="field">
          <label for="mastra-connection">Kode koneksi Mastra</label>
          <textarea id="mastra-connection" rows="3" placeholder="aihub-mastra-v1.?" autocomplete="off" spellcheck="false"></textarea>
          <p class="field-hint">Tempel satu kode dari pemilik agent. Tidak perlu mengisi URL atau API key provider. Nama agent dan provider akan dibaca dari server saat koneksi diperiksa.</p>
        </div>
        <div id="mastra-result" aria-live="polite"></div>
      </div>
    `);
    mastraInput = card.querySelector('#mastra-connection');
    mastraResult = card.querySelector('#mastra-result');
    mastraInput.addEventListener('input', () => renderMastraConnection(mastraInput, mastraResult));
    el.appendChild(card);
  }

  const pasteCard = h(`
    <div class="card form-panel">
      <div class="field" style="margin-bottom:0;">
        <label for="key-input">${isAgent ? 'API key atau kode koneksi agent' : 'Pakai API key'}</label>
        <textarea id="key-input" rows="2" placeholder="Tempel kunci API di sini" autocomplete="off" spellcheck="false"></textarea>
        <p class="field-hint">${isAgent ? 'Untuk Mastra gunakan kartu di atas. Key agent lain dapat ditempel di sini.' : 'Jenis provider dikenali otomatis dari kunci API.'}</p>
      </div>
      <div id="detect-result" style="margin-top:14px;"></div>
    </div>
  `);
  el.appendChild(pasteCard);

  const manualSection = h('<div id="manual-section"></div>');
  el.appendChild(manualSection);

  root.appendChild(el);

  const keyInput = pasteCard.querySelector('#key-input');
  const detectResult = pasteCard.querySelector('#detect-result');

  function renderMastraConnection(input, result) {
    const raw = input.value.trim();
    result.innerHTML = "";
    if (!raw) return;
      result.innerHTML = '';
      let connection;
      try { connection = parseMastraConnection(raw); }
      catch (error) { result.textContent = error.message; return; }
      const info = h('<p class="muted small"></p>');
      info.textContent = `Koneksi Mastra · ${connection.agentId} · ${new URL(connection.endpoint).host}. Periksa untuk membaca identitas dan provider dari server pemilik agent.`;
      const check = h('<button class="btn btn-primary" id="mastra-check">Periksa koneksi Mastra</button>');
      result.append(info, check);
      check.onclick = async () => {
        check.disabled = true;
        info.textContent = 'Memeriksa agent…';
        try {
          const { entry, metadata } = await connectMastraAgent(connection);
          if (input.value.trim() !== raw || !check.isConnected) return;
          info.textContent = `${entry.label} · Model: ${typeof metadata.agent.model === 'string' ? metadata.agent.model.slice(0, 120) : 'diatur server'} · Informasi dilaporkan oleh server agent.`;
          const save = h('<button class="btn btn-primary" id="mastra-save">Simpan &amp; Hubungkan Agent</button>');
          save.onclick = () => saveDetected(entry, connection.token, save);
          check.replaceWith(save);
        } catch (error) {
          if (check.isConnected) { info.textContent = error.message; check.disabled = false; }
        }
      };
  }

  function renderDetectResult() {
    if (manualMode) {
      detectResult.innerHTML = '';
      return;
    }
    const raw = keyInput.value.trim();
    if (!raw) {
      detectResult.innerHTML = '';
      return;
    }
    if (raw.startsWith(CONNECTION_PREFIX)) {
      if (mastraInput) {
        mastraInput.value = raw;
        keyInput.value = '';
        detectResult.innerHTML = '';
        renderMastraConnection(mastraInput, mastraResult);
        mastraInput.focus();
      } else {
        renderMastraConnection(keyInput, detectResult);
      }
      return;
    }
    detected = detectProvider(raw);
    if (detected) {
      detectResult.innerHTML = '';
      const wrap = h('<div></div>');
      wrap.appendChild(h(`
        <div class="row" style="padding:12px 14px;border-radius:12px;background:var(--ok-tint);">
          <span class="feature-icon tone-green">${icon('spark')}</span>
          <div class="grow">
            <div class="item-title">Terdeteksi: ${detected.label}</div>
            <div class="muted small">${detected.vendor} · ${detected.type === 'agent' ? 'Agent' : 'Provider chat'}</div>
          </div>
        </div>
      `));
      const saveBtn = h('<button class="btn btn-primary" style="margin-top:12px;">Simpan &amp; Hubungkan</button>');
      saveBtn.onclick = () => confirmAndSave(detected, raw, saveBtn);
      wrap.appendChild(saveBtn);
      detectResult.appendChild(wrap);
    } else {
      detectResult.innerHTML = '';
      const wrap = h('<div></div>');
      wrap.appendChild(h(`
        <div class="row" style="padding:12px 14px;border-radius:12px;background:var(--warn-tint);">
          <span class="feature-icon" style="color:var(--warn);background:var(--warn-tint);">${icon('spark')}</span>
          <div class="grow muted small">Polanya belum kami kenali otomatis. Ini key dari yang mana?</div>
        </div>
      `));
      // Quick-pick from the catalog first — tapping one uses its endpoint
      // and model automatically, no typing needed. Manual entry (with a
      // typed endpoint) is only for something genuinely not in the catalog.
      const quickRow = h('<div class="tabs" style="margin-top:12px;"></div>');
      providersForMode.forEach((p) => {
        const chip = h(`<button class="chip">${icon(p.icon)}<span>${p.label}</span></button>`);
        chip.onclick = () => confirmAndSave(p, raw, chip);
        quickRow.appendChild(chip);
      });
      wrap.appendChild(quickRow);
      const manualBtn = h('<button class="btn btn-outline" style="margin-top:6px;">Bukan salah satu ini — API/agent lain</button>');
      manualBtn.onclick = () => {
        manualMode = true;
        renderManualForm(raw);
        renderDetectResult();
      };
      wrap.appendChild(manualBtn);
      detectResult.appendChild(wrap);
    }
  }

  keyInput.addEventListener('input', () => {
    manualMode = false;
    manualSection.innerHTML = '';
    renderDetectResult();
  });

  /** If this provider has no key yet, saves immediately (fast path, same as
   * before). If it's already connected, asks for a slot name first instead
   * of silently overwriting the existing key — e.g. a second Gemini key
   * becomes a "Gemini 2" slot, and Chat still only shows one "Gemini"
   * entry that rotates between slots when one hits a rate limit. */
  async function confirmAndSave(entry, rawKey, triggerEl) {
    const existingCount = await countCredentialSlots(entry.id);
    if (existingCount === 0) {
      return saveDetected(entry, rawKey, triggerEl);
    }
    detectResult.innerHTML = '';
    const suggested = `${entry.label} ${existingCount + 1}`;
    const wrap = h(`
      <div class="card form-panel">
        <p class="muted small" style="margin-top:0;">
          ${entry.label} sudah terhubung (${existingCount} kunci). Simpan kunci ini sebagai
          slot baru — kalau salah satu kena limit, Chat otomatis beralih ke slot lain,
          tetap tampil sebagai satu "${entry.label}".
        </p>
        <div class="field">
          <label for="slot-label">Nama slot</label>
          <input id="slot-label" value="${suggested}" />
        </div>
        <button id="slot-save" class="btn btn-primary">Simpan sebagai slot baru</button>
      </div>
    `);
    const slotSaveBtn = wrap.querySelector('#slot-save');
    slotSaveBtn.onclick = () => {
      const label = wrap.querySelector('#slot-label').value.trim() || suggested;
      saveDetected({ ...entry, label }, rawKey, slotSaveBtn);
    };
    detectResult.appendChild(wrap);
  }

  async function saveDetected(entry, rawKey, triggerEl) {
    if (triggerEl) {
      triggerEl.disabled = true;
      triggerEl.dataset.originalText = triggerEl.textContent;
      triggerEl.textContent = 'Menyimpan…';
    }
    try {
      await saveProvider(entry, rawKey);
      await logActivity({ category: 'AI', title: 'API terhubung', subtitle: entry.label, badge: 'Success' });
      toast(`${entry.label} terhubung.`);
      history.back();
    } catch (e) {
      console.error('Gagal menyimpan kredensial:', e);
      toast(`Gagal menyimpan: ${e.message || 'Periksa koneksi dan coba lagi.'}`);
      if (triggerEl) {
        triggerEl.disabled = false;
        triggerEl.textContent = triggerEl.dataset.originalText;
      }
    }
  }

  function renderManualForm(rawKey) {
    manualSection.innerHTML = '';
    manualSection.appendChild(
      h(`
      <div class="card form-panel" style="margin-top:14px;">
        <div class="field">
          <label for="manual-label">Nama (bebas)</label>
          <input id="manual-label" placeholder="mis. Hermes, OpenClaw, Tim Internal" />
        </div>
        <div class="field">
          <label id="manual-type-label">Jenis</label>
          <div id="manual-type" class="row role-options" role="group" aria-labelledby="manual-type-label">
            <button type="button" class="chip ${!isAgent ? 'active' : ''}" data-type="chat">Provider chat</button>
            <button type="button" class="chip ${isAgent ? 'active' : ''}" data-type="agent">Agent</button>
          </div>
        </div>
        <div class="field">
          <label for="manual-endpoint">Endpoint API (format OpenAI-compatible)</label>
          <input id="manual-endpoint" placeholder="https://.../v1/chat/completions" />
        </div>
        <div class="field">
          <label for="manual-model">Model (opsional)</label>
          <input id="manual-model" placeholder="mis. gpt-4o-mini, hermes-3-70b" />
        </div>
        <button id="manual-save" class="btn btn-primary">Simpan &amp; Hubungkan</button>
      </div>
    `)
    );
    manualSection.querySelectorAll('#manual-type .chip').forEach((chip) => {
      chip.onclick = () => {
        manualType = chip.dataset.type;
        manualSection.querySelectorAll('#manual-type .chip').forEach((c) => c.classList.toggle('active', c === chip));
      };
    });
    manualSection.querySelector('#manual-save').onclick = async () => {
      const label = manualSection.querySelector('#manual-label').value.trim();
      const endpoint = manualSection.querySelector('#manual-endpoint').value.trim();
      const model = manualSection.querySelector('#manual-model').value.trim();
      if (!label || !endpoint) {
        toast('Isi nama dan endpoint dulu.');
        return;
      }
      const entry = {
        id: slugify(label),
        label,
        type: manualType,
        format: 'openai',
        endpoint,
        model: model || undefined,
      };
      await saveDetected(entry, rawKey, manualSection.querySelector('#manual-save'));
    };
  }

  el.appendChild(
    h(`
    <p class="section-title">Dikenal otomatis dari pola key-nya</p>
  `)
  );
  const knownList = h('<div class="list"></div>');
  providersForMode.forEach((p) => {
    knownList.appendChild(
      h(`
      <div class="row" style="padding:10px 2px;">
        <span class="feature-icon">${icon(p.icon)}</span>
        <div class="grow">
          <div class="item-title" style="font-size:13px;">${p.label}</div>
          <div class="muted small">${p.vendor}</div>
        </div>
        <span class="pill">${p.type === 'agent' ? 'Agent' : 'Provider'}</span>
      </div>
    `)
    );
  });
  el.appendChild(knownList);

  if (selfHostedForMode.length > 0) {
    el.appendChild(h(`<p class="section-title">Agent self-hosted (gateway milikmu sendiri)</p>`));
    el.appendChild(
      h(`
      <p class="muted small" style="margin-top:-8px;">
        Untuk Mastra, gunakan kartu Mastra di atas.
        Agent lainnya memakai URL dan token dari gateway milikmu.
      </p>
    `)
    );
    selfHostedForMode.forEach((p) => {
      const card = h(`
        <div class="card form-panel" style="margin-bottom:12px;">
          <div class="row" style="margin-bottom:10px;">
            <span class="feature-icon">${icon(p.icon)}</span>
            <div class="grow">
              <div class="item-title" style="font-size:14px;">${p.label}</div>
              <div class="muted small">${p.vendor}</div>
            </div>
          </div>
          <div class="field">
            <label for="${p.id}-url">URL Gateway</label>
            <input id="${p.id}-url" placeholder="${p.urlPlaceholder}" />
            <div class="muted small">${p.urlHelp}</div>
          </div>
          <div class="field">
            <label for="${p.id}-token">${p.tokenLabel || 'Bearer token'}</label>
            <input id="${p.id}-token" type="password" placeholder="token" />
            <div class="muted small">${p.tokenHelp}</div>
          </div>
          <div class="field">
            <label for="${p.id}-direct">${p.directSessionLabel || 'Link sesi langsung (opsional)'}</label>
            <input id="${p.id}-direct" placeholder="${p.directSessionPlaceholder || ''}" />
            <div class="muted small">${p.directSessionHelp || ''}</div>
          </div>
          <button id="${p.id}-save" class="btn btn-primary">Simpan &amp; Hubungkan</button>
        </div>
      `);
      card.querySelector(`#${p.id}-save`).onclick = async () => {
        const url = card.querySelector(`#${p.id}-url`).value.trim().replace(/\/$/, '');
        const token = card.querySelector(`#${p.id}-token`).value.trim();
        const directSessionUrl = card.querySelector(`#${p.id}-direct`)?.value.trim();
        if (!url || !token) {
          toast('Isi URL gateway dan token dulu.');
          return;
        }
        // The 'model' column is meaningless for self-hosted agent formats
        // (a2a/openclaw have no model-selection concept) — repurposed here
        // to hold the optional direct-session link instead of adding a
        // dedicated column just for this.
        try {
          const parsed = new URL(url);
          if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error();
        } catch {
          toast('Gunakan URL http/https tanpa password, query, atau fragmen.');
          return;
        }
        const entry = { id: p.id, label: p.label, type: p.type, format: p.format, endpoint: url, model: p.model || directSessionUrl || undefined };
        await saveDetected(entry, token, card.querySelector(`#${p.id}-save`));
      };
      el.appendChild(card);
    });
  }
}
