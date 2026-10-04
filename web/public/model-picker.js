import { h, icon } from './ui.js';
import { availableModels, setProviderModel } from './ai.js';

export function modelLabel(entry) {
  if (!entry.model || entry.model === 'auto') return entry._resolvedModel ? `Otomatis · ${entry._resolvedModel}` : 'Otomatis';
  return entry.model;
}

/** A native dialog becomes a bottom sheet on phones, with focus/escape support. */
export function openModelPicker(entry) {
  return new Promise((resolve) => {
    const gemini = entry.format === 'gemini';
    const dialog = h(`<dialog class="model-sheet" aria-labelledby="model-title">
      <form class="model-form">
        <div class="sheet-heading"><div><span class="eyebrow">ASISTEN AI</span><h2 id="model-title">Pilih model</h2></div>
          <button type="button" class="icon-button" data-close aria-label="Tutup pilihan model">${icon('close')}</button></div>
        <p class="model-provider muted small"></p>
        <div class="field" ${gemini ? '' : 'hidden'}><label for="model-select">Model Gemini</label><select id="model-select"></select></div>
        <div class="field" id="custom-model-field"><label for="model-id">ID model</label><input id="model-id" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Masukkan ID model dari provider" /></div>
        <p class="field-hint">${gemini ? 'Model pilihanmu dipakai lebih dulu. Jika sudah tidak tersedia, sistem mencoba model chat lain dari daftar Gemini.' : 'Gunakan ID model yang tersedia pada provider ini. Pilihan disimpan untuk percakapan berikutnya.'}</p>
        <p class="model-load-status muted small" role="status" aria-live="polite"></p>
        <button type="button" class="btn btn-outline" id="refresh-models" ${gemini ? '' : 'hidden'}>Perbarui daftar model</button>
        <p class="error-text" role="alert" id="model-error" hidden></p>
        <button class="btn btn-primary" id="save-model" type="submit">Simpan model</button>
      </form>
    </dialog>`);
    const select = dialog.querySelector('#model-select');
    const input = dialog.querySelector('#model-id');
    const customField = dialog.querySelector('#custom-model-field');
    const refresh = dialog.querySelector('#refresh-models');
    const status = dialog.querySelector('.model-load-status');
    const errorEl = dialog.querySelector('#model-error');
    const save = dialog.querySelector('#save-model');
    const close = dialog.querySelector('[data-close]');
    dialog.querySelector('.model-provider').textContent = entry.label;
    input.value = entry.model === 'auto' ? '' : entry.model || '';
    let closed = false;
    let saved = false;
    let saving = false;
    let requestId = 0;
    let models = [];

    function renderOptions(value = entry.model || 'auto') {
      select.replaceChildren(new Option('Otomatis (disarankan)', 'auto'));
      for (const model of models) select.add(new Option(model.label === model.id ? model.id : `${model.label} · ${model.id}`, model.id));
      if (value && value !== 'auto' && value !== '__custom' && !models.some((m) => m.id === value)) {
        select.add(new Option(`${value} (tersimpan)`, value));
      }
      select.add(new Option('Ketik ID model sendiri…', '__custom'));
      select.value = value;
      customField.hidden = gemini && select.value !== '__custom';
    }
    async function refreshModels() {
      const id = ++requestId;
      refresh.disabled = true;
      status.textContent = 'Memuat model dari Gemini…';
      try {
        const found = await availableModels(entry);
        if (closed || id !== requestId) return;
        models = found;
        renderOptions(select.value);
        status.textContent = found.length ? `${found.length} model chat ditemukan. Ketersediaan dikonfirmasi saat pesan dikirim.` : 'Belum ada model chat terdaftar. Kamu tetap bisa memasukkan ID model.';
      } catch (error) {
        if (!closed && id === requestId) status.textContent = `Daftar belum bisa dimuat. ${error.message}`;
      } finally {
        if (!closed && id === requestId) refresh.disabled = saving;
      }
    }
    select.onchange = () => { customField.hidden = select.value !== '__custom'; if (!customField.hidden) input.focus(); };
    refresh.onclick = refreshModels;
    close.onclick = () => dialog.close();
    dialog.addEventListener('cancel', (event) => { if (saving) event.preventDefault(); });
    const onRoute = () => dialog.close();
    window.addEventListener('hashchange', onRoute);
    dialog.addEventListener('close', () => {
      closed = true;
      window.removeEventListener('hashchange', onRoute);
      dialog.remove();
      resolve(saved);
    }, { once: true });
    dialog.querySelector('form').onsubmit = async (event) => {
      event.preventDefault();
      if (saving) return;
      const model = gemini && select.value !== '__custom' ? select.value : input.value;
      saving = true;
      ++requestId; // Ignore any model-list request completing during save.
      save.disabled = close.disabled = select.disabled = input.disabled = refresh.disabled = true;
      save.textContent = 'Menyimpan…';
      errorEl.hidden = true;
      try {
        await setProviderModel(entry, model);
        saved = true;
        dialog.close();
      } catch (error) {
        errorEl.textContent = error.message || 'Model belum tersimpan. Coba lagi.';
        errorEl.hidden = false;
      } finally {
        saving = false;
        save.disabled = close.disabled = select.disabled = input.disabled = refresh.disabled = false;
        save.textContent = 'Simpan model';
      }
    };
    if (gemini) renderOptions();
    document.body.appendChild(dialog);
    dialog.showModal();
    if (gemini) refreshModels();
  });
}
