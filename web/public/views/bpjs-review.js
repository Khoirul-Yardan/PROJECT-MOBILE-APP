import { h, header, toast, escapeHtml as esc } from '../ui.js';
import { fetchNurseBpjsSessions, fetchBpjsDocument, fetchBpjsTranscript, watchBpjsSessions } from '../db.js';

const statuses = { recording:'Sesi belum selesai', processing:'Memproses dokumentasi', siap_dikirim:'Draf siap diperiksa', terkirim:'Pernah diekspor/disalin' };
const fields = { ringkasan:'Ringkasan', keluhan_utama:'Keluhan utama', durasi_gejala:'Durasi gejala', riwayat_kesehatan:'Riwayat kesehatan', hasil_anamnesis:'Hasil anamnesis' };
export default async function render(root) {
  const el = h('<div class="page bpjs-review-page"></div>');
  const listing = h('<div></div>'); listing.appendChild(header('Riwayat Bot BPJS', { back:true }));
  listing.appendChild(h(`<p class="muted small">Periksa sesi dan salin teks. Ekspor PDF/DOCX tersedia pada akhir sesi perekaman di aplikasi mobile.</p>
  `));
  const filters = h(`<div class="filter-row"><div><label for="search">Cari pasien atau dokter</label><input id="search" type="search"></div><div><label for="status-filter">Status</label><select id="status-filter"><option value="">Semua status</option>${Object.entries(statuses).map(([v,t]) => `<option value="${v}">${t}</option>`).join('')}</select></div></div>`);
  listing.appendChild(filters);
  const list = h('<div class="group-list"></div>'); listing.appendChild(list); el.appendChild(listing); root.appendChild(el);
  let sessions = [], disposed = false, requestId = 0, detailScroll = 0;
  function closeDetail() {
    requestId++; el.replaceChildren(listing); window.scrollTo(0, detailScroll);
  }
  window.addEventListener('popstate', closeDetail);
  function paint() {
    list.replaceChildren();
    const q = filters.querySelector('input').value.toLocaleLowerCase('id');
    const status = filters.querySelector('select').value;
    const filtered = sessions.filter(s => `${s.pasien_nama} ${s.dokter_nama}`.toLocaleLowerCase('id').includes(q) && (!status || s.status === status));
    if (!filtered.length) list.appendChild(h(`<p class="empty-state">${sessions.length ? 'Tidak ada hasil. Ubah pencarian atau pilih Semua status.' : 'Belum ada sesi Bot BPJS.'}</p>`));
    for (const s of filtered) {
      const row = h(`<button class="list-row"><span class="grow"><strong>${esc(s.pasien_nama)}</strong><span class="muted small">${esc(s.dokter_nama)} · ${esc(new Date(s.created_at).toLocaleString('id-ID'))}</span><span class="pill">${esc(statuses[s.status] || s.status)}</span></span><span aria-hidden="true">›</span></button>`);
      row.onclick = () => open(s); list.appendChild(row);
    }
  }
  filters.oninput = paint;
  async function load() {
    list.textContent = 'Memuat sesi…';
    try { sessions = await fetchNurseBpjsSessions(); if (!disposed) paint(); }
    catch { list.replaceChildren(h('<p role="alert">Riwayat gagal dimuat.</p>')); const b = h('<button class="btn-text">Coba lagi</button>'); b.onclick = load; list.appendChild(b); }
  }
  async function open(session, retry = false) {
    const token = ++requestId;
    if (!retry) {
      detailScroll = window.scrollY;
      // Same URL: browser/system back closes detail before leaving this route.
      history.pushState({ bpjsDetail: session.id }, '', location.href);
    }
    const detail = h('<div class="bpjs-detail-page"></div>');
    const bar = header('Detail sesi');
    const back = h('<button class="btn-text" aria-label="Kembali ke riwayat">← Kembali</button>');
    back.onclick = () => history.back();
    bar.prepend(back); detail.appendChild(bar);
    detail.appendChild(h(`<h2>${esc(session.pasien_nama)}</h2><p>Dokter tujuan: ${esc(session.dokter_nama)}${session.dokter_instansi ? ' · ' + esc(session.dokter_instansi) : ''}</p><p class="muted small">${esc(new Date(session.created_at).toLocaleString('id-ID'))}<br>Referensi: ${esc(session.id)}</p>`));
    if (session.status === 'terkirim') detail.appendChild(h('<p class="notice">Status lama; penerimaan oleh dokter tidak tercatat di aplikasi.</p>'));
    if (session.status === 'processing') detail.appendChild(h('<p class="notice">Proses sesi ini belum terkonfirmasi selesai.</p>'));
    const content = h('<div>Memuat dokumentasi…</div>'); detail.appendChild(content); el.replaceChildren(detail); window.scrollTo(0,0);
    try {
      const [doc, transcript] = await Promise.all([fetchBpjsDocument(session.id), fetchBpjsTranscript(session.id)]);
      if (disposed || token !== requestId) return;
      const structured = doc?.dokumentasi_terstruktur || {};
      const raw = !doc?.generated_by_llm_provider || /transkrip mentah|tidak merespons/i.test(structured.catatan || '');
      const label = raw ? 'Transkrip mentah — belum disusun AI' : 'Draf AI — perlu verifikasi dokter';
      content.replaceChildren(h(`<p class="notice">${label}</p>`));
      const grid = h('<div class="document-grid"></div>');
      const draft = h('<section></section>');
      for (const [key,title] of Object.entries(fields)) draft.appendChild(h(`<h2>${title}</h2><div class="document-body">${esc(structured[key] || (key === 'ringkasan' ? doc?.ringkasan : '') || 'Belum disebutkan dalam percakapan')}</div>`));
      if (structured.catatan) draft.appendChild(h(`<p class="notice">${esc(structured.catatan)}</p>`));
      const source = h('<section><h2>Transkrip pendukung</h2><p class="muted small">Pembicara belum diverifikasi.</p></section>');
      for (const t of transcript) source.appendChild(h(`<p class="document-body">${esc(t.text_segment)}</p>`));
      if (!transcript.length) source.appendChild(h('<p>Transkrip belum tersedia.</p>'));
      grid.append(draft, source); content.appendChild(grid);
      if (!raw) content.appendChild(h(`<p class="muted small">Penyusun: ${esc(doc.generated_by_llm_provider)}${doc.created_at ? ' · ' + esc(new Date(doc.created_at).toLocaleString('id-ID')) : ''}</p>`));
      content.appendChild(h('<p class="muted small">Pemeriksaan baca-saja. Koreksi dilakukan pada salinan dokumen. Nama dokter tidak menentukan penerima secara otomatis.</p>'));
      const error = h('<p class="error-text" role="alert"></p>');
      const copy = h('<button class="btn btn-outline">Salin teks</button>');
      copy.onclick = async () => {
        copy.disabled = true;
        try {
          await navigator.clipboard.writeText([label, `Pasien: ${session.pasien_nama}`, `Dokter tujuan: ${session.dokter_nama}`, `Instansi: ${session.dokter_instansi || 'Tidak diisi'}`, `Referensi: ${session.id}`, `Tanggal: ${session.created_at}`, ...Object.entries(fields).map(([k,t]) => `${t}: ${structured[k] || 'Belum disebutkan dalam percakapan'}`), 'Transkrip — pembicara belum diverifikasi', ...transcript.map(t => t.text_segment), 'Perlu verifikasi dokter. Penerimaan dokumen tidak tercatat di aplikasi.'].join('\n\n'));
          toast('Teks disalin');
        } catch { error.textContent = 'Teks belum dapat disalin. Periksa izin clipboard browser, lalu coba lagi.'; }
        finally { copy.disabled = false; }
      };
      content.append(copy,error);
    } catch { content.replaceChildren(h('<p role="alert">Dokumentasi gagal dimuat.</p>')); const retry = h('<button class="btn-text">Coba lagi</button>'); retry.onclick = () => open(session, true); content.appendChild(retry); }
  }
  await load(); const unwatch = watchBpjsSessions(load);
  return { dispose() { disposed = true; unwatch(); window.removeEventListener('popstate', closeDetail); } };
}
