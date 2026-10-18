// Halaman CRUD generik, digerakkan oleh skema dari server (lib/resources.js):
// daftar + cari + halaman, tambah, ubah, hapus. Tabel mode 'meta' (data
// pasien/rahasia) tampil read-only tanpa kolom isi.
import { api, esc, h, icon, modal, confirmBox, toast, pageHead, fmtDate, debounce, toLocalInput, fromLocalInput } from '../lib.js';

const PAGE_SIZE = 25;

function cell(col, v, schemaCol) {
  if (v === null || v === undefined || v === '') return '<span class="muted">—</span>';
  const type = schemaCol?.type;
  if (typeof v === 'boolean') return `<span class="pill ${v ? 'ok' : ''}">${v ? 'ya' : 'tidak'}</span>`;
  if (/_at$/.test(col)) return esc(fmtDate(v));
  if (typeof v === 'object') return `<span class="mono">${esc(JSON.stringify(v))}</span>`;
  if (col === 'active' || type === 'bool') return `<span class="pill ${v ? 'ok' : ''}">${v ? 'aktif' : 'nonaktif'}</span>`;
  if (/(^|_)id$/.test(col) && String(v).length > 20) return `<span class="mono" title="${esc(v)}">${esc(String(v).slice(0, 8))}…</span>`;
  return esc(v);
}

function fieldHtml(col, value) {
  const id = `f-${col.name}`;
  const hint = col.hint ? `<p class="hint">${esc(col.hint)}</p>` : '';
  const req = col.required ? ' *' : '';
  switch (col.type) {
    case 'bool':
      return `<div class="field inline"><input type="checkbox" id="${id}" ${value ? 'checked' : ''}><label for="${id}">${esc(col.name)}</label>${hint}</div>`;
    case 'select':
      return `<div class="field"><label for="${id}">${esc(col.name)}${req}</label><select id="${id}">${col.options.map((o) => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>${hint}</div>`;
    case 'textarea':
      return `<div class="field" style="grid-column:1/-1"><label for="${id}">${esc(col.name)}${req}</label><textarea id="${id}" ${col.max ? `maxlength="${col.max}"` : ''}>${esc(value ?? '')}</textarea>${hint}</div>`;
    case 'json':
      return `<div class="field" style="grid-column:1/-1"><label for="${id}">${esc(col.name)}${req}</label><textarea class="json" id="${id}" spellcheck="false">${esc(value === undefined ? '{}' : JSON.stringify(value, null, 2))}</textarea>${hint}</div>`;
    case 'datetime':
      return `<div class="field"><label for="${id}">${esc(col.name)}${req}</label><input type="datetime-local" id="${id}" value="${esc(toLocalInput(value))}">${hint}</div>`;
    case 'number':
      return `<div class="field"><label for="${id}">${esc(col.name)}${req}</label><input type="number" id="${id}" value="${esc(value ?? col.default ?? '')}">${hint}</div>`;
    default:
      return `<div class="field"><label for="${id}">${esc(col.name)}${req}</label><input id="${id}" value="${esc(value ?? '')}" ${col.max ? `maxlength="${col.max}"` : ''} ${col.pattern ? `pattern="${esc(col.pattern)}"` : ''} autocomplete="off">${hint}</div>`;
  }
}

function collect(body, columns, editing) {
  const out = {};
  for (const col of columns) {
    if (editing && col.createOnly) continue;
    const el = body.querySelector(`#f-${col.name}`);
    if (!el) continue;
    if (col.type === 'bool') out[col.name] = el.checked;
    else if (col.type === 'datetime') out[col.name] = fromLocalInput(el.value);
    else if (col.type === 'number') out[col.name] = el.value === '' ? null : Number(el.value);
    else out[col.name] = el.value;
  }
  return out;
}

export default async function resourcePage(root, name, schemaMap) {
  const s = schemaMap[name];
  if (!s) { root.append(h('<div class="empty">Tabel tidak dikenal.</div>')); return; }
  const canWrite = s.mode === 'crud';
  const state = { page: 1, search: '' };

  const addBtn = canWrite && !s.noCreate ? `<button class="btn btn-primary" id="add">${icon('plus')} Tambah</button>` : '';
  root.append(pageHead(s.group, s.label, canWrite ? '' : s.note || '', `<button class="btn" id="reload" title="Muat ulang">${icon('refresh')}</button>${addBtn}`));
  if (!canWrite && s.mode === 'meta') {
    root.append(h(`<div class="notice info"><div><b>Hanya metadata, hanya baca.</b><p>${esc(s.note)}</p></div></div>`));
  }
  const bar = h(`<div class="toolbar">${s.search ? '<input class="search" id="q" type="search" placeholder="Cari…" aria-label="Cari">' : ''}<span class="muted small" id="count"></span></div>`);
  const wrap = h('<div class="table-wrap"></div>');
  const pager = h('<div class="pager"></div>');
  root.append(bar, wrap, pager);

  const colDef = Object.fromEntries(s.columns.map((c) => [c.name, c]));

  async function load() {
    wrap.innerHTML = '<div class="empty">Memuat…</div>';
    try {
      const qs = new URLSearchParams({ page: state.page, size: PAGE_SIZE, search: state.search });
      const data = await api(`/r/${name}?${qs}`);
      render(data);
    } catch (e) {
      wrap.innerHTML = `<div class="empty"><b>Gagal memuat.</b><br>${esc(e.message)}${/does not exist|PGRST205|schema cache/i.test(e.message) ? '<br>Tabel belum dibuat — jalankan SQL di <a href="#/system">Status &amp; Setup</a>.' : ''}</div>`;
      pager.innerHTML = '';
    }
  }

  function render({ rows, total }) {
    bar.querySelector('#count').textContent = `${total} data`;
    if (!rows.length) {
      wrap.innerHTML = `<div class="empty">${state.search ? 'Tidak ada hasil.' : 'Belum ada data.'}</div>`;
    } else {
      const head = s.list.map((c) => `<th>${esc(c)}</th>`).join('') + (canWrite ? '<th></th>' : '');
      const body = rows.map((r, i) => `<tr>${s.list.map((c) => `<td class="cell-clip">${cell(c, r[c], colDef[c])}</td>`).join('')}${canWrite ? `<td class="actions-cell">
        <button class="btn btn-sm" data-edit="${i}">${icon('edit')} Ubah</button>
        ${s.noDelete ? '' : `<button class="btn btn-sm btn-danger" data-del="${i}" aria-label="Hapus">${icon('trash')}</button>`}</td>` : ''}</tr>`).join('');
      wrap.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
      wrap.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => openForm(rows[Number(b.dataset.edit)]); });
      wrap.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => del(rows[Number(b.dataset.del)]); });
    }
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    pager.innerHTML = `<span>Halaman ${state.page} / ${pages}</span><span class="actions">
      <button class="btn btn-sm" id="prev" ${state.page <= 1 ? 'disabled' : ''}>‹ Sebelumnya</button>
      <button class="btn btn-sm" id="next" ${state.page >= pages ? 'disabled' : ''}>Berikutnya ›</button></span>`;
    pager.querySelector('#prev').onclick = () => { state.page -= 1; load(); };
    pager.querySelector('#next').onclick = () => { state.page += 1; load(); };
  }

  function openForm(row) {
    const editing = !!row;
    modal(`${editing ? 'Ubah' : 'Tambah'} ${s.label}`, (body, close) => {
      const cols = s.columns.filter((c) => !(editing && c.createOnly));
      body.innerHTML = `<form><div class="form-grid">${cols.map((c) => fieldHtml(c, editing ? row[c.name] : c.default)).join('')}</div>
        <p class="error-text" id="err" hidden></p>
        <div class="modal-actions"><button type="button" class="btn" data-no>Batal</button><button class="btn btn-primary" type="submit">Simpan</button></div></form>`;
      body.querySelector('[data-no]').onclick = close;
      body.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        const err = body.querySelector('#err');
        err.hidden = true;
        const payload = collect(body, s.columns, editing);
        const btn = body.querySelector('[type=submit]');
        btn.disabled = true;
        try {
          await api(editing ? `/r/${name}/${encodeURIComponent(row[s.pk])}` : `/r/${name}`, { method: editing ? 'PATCH' : 'POST', body: payload });
          close();
          toast(editing ? 'Perubahan disimpan' : 'Data ditambahkan');
          load();
        } catch (ex) {
          err.textContent = ex.message; err.hidden = false; btn.disabled = false;
        }
      };
    });
  }

  async function del(row) {
    const label = row.title || row.label || row.display_name || row.key || row[s.pk];
    if (!(await confirmBox('Hapus data?', `"${label}" akan dihapus permanen.`))) return;
    try {
      await api(`/r/${name}/${encodeURIComponent(row[s.pk])}`, { method: 'DELETE' });
      toast('Data dihapus');
      if (state.page > 1 && wrap.querySelectorAll('tbody tr').length === 1) state.page -= 1;
      load();
    } catch (e) { toast(e.message, true); }
  }

  root.querySelector('#reload').onclick = load;
  root.querySelector('#add')?.addEventListener('click', () => openForm(null));
  bar.querySelector('#q')?.addEventListener('input', debounce((e) => { state.search = e.target.value; state.page = 1; load(); }));
  await load();
}
