import { h, header, icon, toast } from '../ui.js';
import { KNOWN_PROVIDERS, SELF_HOSTED_PROVIDERS, detectProvider, slugify } from '../providers.js';
import { saveProvider } from '../ai.js';
import { logActivity } from '../db.js';

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
  el.appendChild(
    h(`
    <p class="muted small" style="margin-top:-8px;">
      ${
        isAgent
          ? 'Tempel API key agent (Hermes) atau hubungkan gateway self-hosted (OpenClaw) di bawah — agent bisa mengambil aksi, bukan cuma membalas teks.'
          : 'Tempel API key provider AI (ChatGPT, Claude, Gemini, OpenRouter) — sistem mengenali sendiri jenisnya.'
      }
    </p>
  `)
  );

  const pasteCard = h(`
    <div class="card form-panel">
      <div class="field" style="margin-bottom:0;">
        <label for="key-input">Tempel API key</label>
        <textarea id="key-input" rows="2" placeholder="sk-..., sk-ant-..., AIza..., atau key lainnya" autocomplete="off" spellcheck="false"></textarea>
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
      saveBtn.onclick = () => saveDetected(detected, raw, saveBtn);
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
        chip.onclick = () => saveDetected(p, raw, chip);
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
        Bukan API key vendor — kamu jalankan gateway-nya sendiri, jadi isi URL
        dan token dari instance-mu supaya balasan agent masuk ke Chat di sini,
        bukan ke Telegram/WhatsApp.
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
            <label for="${p.id}-token">Bearer token</label>
            <input id="${p.id}-token" type="password" placeholder="token" />
            <div class="muted small">${p.tokenHelp}</div>
          </div>
          <button id="${p.id}-save" class="btn btn-primary">Simpan &amp; Hubungkan</button>
        </div>
      `);
      card.querySelector(`#${p.id}-save`).onclick = async () => {
        const url = card.querySelector(`#${p.id}-url`).value.trim().replace(/\/$/, '');
        const token = card.querySelector(`#${p.id}-token`).value.trim();
        if (!url || !token) {
          toast('Isi URL gateway dan token dulu.');
          return;
        }
        const entry = { id: p.id, label: p.label, type: p.type, format: p.format, endpoint: url };
        await saveDetected(entry, token, card.querySelector(`#${p.id}-save`));
      };
      el.appendChild(card);
    });
  }
}
