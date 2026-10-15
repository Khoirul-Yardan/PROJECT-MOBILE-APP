import { h, header, icon, toast, pageIntro, emptyState, escapeHtml } from '../ui.js';
import {
  fetchNurseBpjsSessions,
  fetchAllBpjsDocuments,
  fetchAllBpjsTranscripts,
  markBpjsSessionSent,
  deleteBpjsSession,
  watchBpjsSessions,
  fetchKomunikasiEvents,
  deleteKomunikasiEvents,
  watchKomunikasi,
} from '../db.js';
import { Native } from '../bridge.js';

const STATUS_LABEL = {
  recording: 'Merekam',
  processing: 'Diproses',
  siap_dikirim: 'Siap Dikirim',
  terkirim: 'Sudah Dikirim',
};

const STATUS_TONE = {
  recording: 'warn',
  processing: 'warn',
  siap_dikirim: 'warn',
  terkirim: 'ok',
};

const KIND = {
  bpjs: { label: 'Bot BPJS', art: 'bot' },
  anamnesis: { label: 'Anamnesis Terpandu', art: 'chat' },
  papan: { label: 'Papan Komunikasi', art: 'providers' },
};

const FILTERS = [
  ['semua', 'Semua'],
  ['bpjs', 'Bot BPJS'],
  ['anamnesis', 'Anamnesis'],
  ['papan', 'Papan'],
];

const fmt = (iso) => new Date(iso).toLocaleString('id-ID');
const fmtDay = (iso) => new Date(iso).toLocaleDateString('id-ID');
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

function describeEvent(ev) {
  const d = ev.detail || {};
  const parts = [d.label || ev.jenis];
  if (d.lokasi) parts.push(`lokasi ${String(d.lokasi).toLowerCase()}`);
  if (d.skala !== undefined && d.skala !== null) parts.push(`skala ${d.skala}/10`);
  return parts.join(', ');
}

// Dokumentasi — satu riwayat yang bisa dicari untuk semua data yang
// disimpan sistem: Bot BPJS, Anamnesis Terpandu, dan Papan Komunikasi.
// Setiap entri menampilkan asal datanya (siapa/apa yang membuatnya: ucapan
// pasien, hasil STT mentah, ringkasan AI, atau pilihan sentuhan) supaya
// perawat bisa memeriksa dari mana tiap isi berasal. Tidak ada review dokter
// di sini: draf diteruskan perawat langsung lewat salin-teks, PDF, atau DOCX.
export default async function render(root) {
  const el = h(`<div class="page bpjs-review-page"></div>`);
  const listPage = h('<div></div>');
  listPage.appendChild(header('Dokumentasi', { back: true }));
  listPage.appendChild(pageIntro('Catatan yang tertata.', 'Cari dan periksa kembali semua data: rekaman BPJS, anamnesis terpandu, dan papan komunikasi.', { art: 'bot', label: 'RIWAYAT & PENCARIAN', tone: 'intro-mint' }));

  const search = h(`<label class="pk-ref" style="margin-bottom:10px;">
    <span class="small muted">Cari (nama/kode pasien, keluhan, isi percakapan, tanggal)</span>
    <input id="doc-search" type="search" placeholder="mis. nyeri perut, TES-01, 15/10" autocomplete="off"/></label>`);
  const filterBar = h('<div class="doc-filters" role="tablist"></div>');
  const summaryEl = h('<p class="muted small" style="margin:6px 0 12px;"></p>');
  const listEl = h('<div class="list"></div>');
  [search, filterBar, summaryEl, listEl].forEach((n) => listPage.appendChild(n));
  el.appendChild(listPage);
  root.appendChild(el);

  let sessions = [];
  let docs = new Map();
  let transcripts = new Map();
  let events = [];
  let entries = [];
  let filter = 'semua';
  let query = '';

  async function load() {
    const [s, d, t, ev] = await Promise.all([
      fetchNurseBpjsSessions(),
      fetchAllBpjsDocuments(),
      fetchAllBpjsTranscripts(),
      fetchKomunikasiEvents(),
    ]);
    sessions = s;
    docs = new Map();
    d.forEach((x) => { if (!docs.has(x.session_id)) docs.set(x.session_id, x); });
    transcripts = new Map();
    t.forEach((x) => {
      if (!transcripts.has(x.session_id)) transcripts.set(x.session_id, []);
      transcripts.get(x.session_id).push(x);
    });
    events = ev;
    buildEntries();
  }

  function buildEntries() {
    const out = [];
    sessions.forEach((s) => {
      const doc = docs.get(s.id);
      const tr = transcripts.get(s.id) ?? [];
      const kind = doc?.perbandingan?.sumber === 'anamnesis_terpandu' ? 'anamnesis' : 'bpjs';
      const structured = doc?.dokumentasi_terstruktur ?? {};
      const searchText = [
        KIND[kind].label, s.pasien_nama, s.dokter_nama, s.dokter_instansi, STATUS_LABEL[s.status], fmt(s.created_at), fmtDay(s.created_at),
        doc?.ringkasan, ...Object.values(structured).map(String), ...tr.map((x) => x.text_segment),
      ].filter(Boolean).join(' ').toLowerCase();
      out.push({ kind, id: s.id, created: s.created_at, title: s.pasien_nama, session: s, searchText });
    });
    // Papan Komunikasi: one entry per patient code per day.
    const groups = new Map();
    events.forEach((ev) => {
      const key = `${ev.pasien_ref || ''}|${fmtDay(ev.created_at)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ev);
    });
    groups.forEach((evs, key) => {
      const ref = evs[0].pasien_ref || '';
      const searchText = [
        KIND.papan.label, ref || 'tanpa kode', fmtDay(evs[0].created_at), ...evs.map((e) => describeEvent(e) + (e.mendesak ? ' mendesak' : '')),
      ].join(' ').toLowerCase();
      out.push({ kind: 'papan', id: key, created: evs[0].created_at, title: ref || 'Tanpa kode pasien', events: evs, searchText });
    });
    out.sort((a, b) => new Date(b.created) - new Date(a.created));
    entries = out;
  }

  function visible() {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter((e) => (filter === 'semua' || e.kind === filter) && tokens.every((t) => e.searchText.includes(t)));
  }

  function drawFilters() {
    filterBar.replaceChildren();
    FILTERS.forEach(([key, label]) => {
      const n = key === 'semua' ? entries.length : entries.filter((e) => e.kind === key).length;
      const b = h(`<button type="button" role="tab" class="pk-tab ${filter === key ? 'on' : ''}">${label} <span class="doc-count">${n}</span></button>`);
      b.onclick = () => { filter = key; renderList(); };
      filterBar.appendChild(b);
    });
  }

  function renderList() {
    drawFilters();
    listEl.replaceChildren();
    const shown = visible();
    summaryEl.textContent = query || filter !== 'semua'
      ? `${shown.length} dari ${entries.length} entri cocok`
      : `${entries.length} entri tersimpan`;
    if (entries.length === 0) {
      listEl.appendChild(emptyState('Belum ada data.', 'Buka Bot Hub: rekam Bot BPJS, jalankan Anamnesis Terpandu, atau gunakan Papan Komunikasi.', 'bot'));
      return;
    }
    if (shown.length === 0) {
      listEl.appendChild(h('<div class="empty-state">Tidak ada entri yang cocok dengan pencarian.</div>'));
      return;
    }
    shown.forEach((e) => {
      let sub;
      let pill;
      if (e.kind === 'papan') {
        const urgent = e.events.filter((x) => x.mendesak).length;
        sub = `${e.events.length} pesan pasien${urgent ? ` · ${urgent} mendesak` : ''} · ${fmtDay(e.created)}`;
        pill = urgent ? '<span class="pill pill--bad">mendesak</span>' : '<span class="pill pill--ok">tercatat</span>';
      } else {
        const s = e.session;
        sub = `Untuk: ${escapeHtml(s.dokter_nama)}${s.dokter_instansi ? ' · ' + escapeHtml(s.dokter_instansi) : ''} · ${fmt(s.created_at)}`;
        pill = `<span class="pill pill--${STATUS_TONE[s.status] ?? 'warn'}">${STATUS_LABEL[s.status] ?? escapeHtml(s.status)}</span>`;
      }
      const card = h(`
        <div class="card row" style="margin-bottom:10px;">
          <button type="button" class="row grow bpjs-open" style="text-align:left;background:none;border:none;padding:0;min-height:0;display:block;">
            <div class="row-between">
              <h3 style="margin:0;">${escapeHtml(e.title)}</h3>
              ${pill}
            </div>
            <p class="muted small" style="margin-top:4px;"><span class="doc-kind doc-kind--${e.kind}">${KIND[e.kind].label}</span> ${sub}</p>
          </button>
          <button class="icon-button" aria-label="Hapus ${escapeHtml(e.title)}" data-delete>${icon('trash')}</button>
        </div>
      `);
      card.querySelector('.bpjs-open').onclick = () => openEntry(e);
      card.querySelector('[data-delete]').onclick = () => confirmDelete(e);
      listEl.appendChild(card);
    });
  }

  search.querySelector('input').oninput = (ev) => { query = ev.target.value; renderList(); };

  /** Confirms before deleting — a stray tap shouldn't be enough to lose a
   * documented entry. For sessions the transcript and AI draft go with it
   * (cascade, see db.js); for Papan Komunikasi it removes that day's
   * messages for the patient code. */
  function confirmDelete(entry, afterDelete) {
    const what = entry.kind === 'papan'
      ? `${entry.events.length} pesan Papan Komunikasi untuk <strong>${escapeHtml(entry.title)}</strong> pada ${fmtDay(entry.created)}`
      : `Dokumentasi untuk <strong>${escapeHtml(entry.title)}</strong> (${escapeHtml(entry.session.dokter_nama)}), termasuk transkrip dan draf yang sudah dibuat`;
    const dialog = h(`
      <dialog class="model-sheet">
        <form method="dialog" style="padding:4px;">
          <h3 style="margin-top:0;">Hapus entri ini?</h3>
          <p class="muted small">${what} akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.</p>
          <div class="row" style="gap:10px;justify-content:flex-end;margin-top:14px;">
            <button type="button" class="btn btn-outline" data-cancel>Batal</button>
            <button type="button" class="btn" style="background:var(--bad);color:#fff;" data-confirm>Hapus</button>
          </div>
        </form>
      </dialog>
    `);
    document.body.appendChild(dialog);
    dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
    dialog.querySelector('[data-confirm]').onclick = async () => {
      try {
        if (entry.kind === 'papan') await deleteKomunikasiEvents(entry.events.map((x) => x.id));
        else await deleteBpjsSession(entry.id);
        toast('Entri dihapus.');
        await load();
        if (afterDelete) afterDelete();
        else renderList();
      } catch (e) {
        toast('Gagal menghapus: ' + e.message);
      } finally {
        dialog.close();
      }
    };
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
  }

  // Same wording as BpjsExport.comparisonLines in bpjs_service.dart, so the
  // history copy/paste text matches what the app exports.
  function comparisonLines(c) {
    if (!c || Object.keys(c).length === 0) return [];
    const sec = (ms) => (ms == null ? '-' : (ms / 1000).toFixed(1) + ' dtk');
    if (c.sumber === 'anamnesis_terpandu') {
      return [
        `Pertanyaan dijawab: ${c.pertanyaan_dijawab} dari ${c.pertanyaan_total}`,
        `Jawaban lewat suara: ${c.jawaban_suara}; diketik: ${c.jawaban_diketik}; dikoreksi perawat: ${c.jawaban_dikoreksi}`,
        `Ringkasan AI${c.llm_provider ? ' (' + c.llm_provider + ')' : ''}: ${c.llm_berhasil ? 'berhasil' : 'tidak berhasil, memakai jawaban mentah'}`,
      ];
    }
    return [
      `Durasi audio: ${sec(c.durasi_audio_ms)}`,
      `STT: ${c.stt_kata} kata, ${c.stt_segmen} segmen, diproses ${sec(c.stt_waktu_ms)}`,
      `Ringkasan AI${c.llm_provider ? ' (' + c.llm_provider + ')' : ''}: ${c.llm_kata} kata, diproses ${sec(c.llm_waktu_ms)}`,
      `Rasio ringkasan/STT: ${c.rasio_ringkas}`,
      `Pembicara terdeteksi AssemblyAI: ${c.pembicara_terdeteksi}${c.relabel_llm ? ' (dikoreksi LLM)' : ''}`,
    ];
  }

  function buildPlainText(session, doc, transcript, kind) {
    const structured = doc?.dokumentasi_terstruktur ?? {};
    const lines = [
      kind === 'anamnesis' ? 'ANAMNESIS TERPANDU (DRAF)' : 'DOKUMENTASI PERCAKAPAN PERAWAT-PASIEN',
      `Untuk: ${session.dokter_nama}${session.dokter_instansi ? ' (' + session.dokter_instansi + ')' : ''}`,
      `Pasien: ${session.pasien_nama}`,
      `Tanggal: ${fmt(session.created_at)}`,
      '',
      ...Object.entries(structured).map(([key, value]) => `${key.replace(/_/g, ' ').toUpperCase()}:\n${value}`),
    ];
    if (transcript.length > 0) {
      lines.push('', kind === 'anamnesis' ? 'TANYA-JAWAB:' : 'HASIL STT (TRANSKRIP PER PEMBICARA):');
      transcript.forEach((t) => lines.push(`${t.speaker}: ${t.text_segment}`));
    }
    const cmp = comparisonLines(doc?.perbandingan);
    if (cmp.length > 0) lines.push('', 'ASAL DATA & PERBANDINGAN:', ...cmp);
    lines.push('', 'Catatan: draf ini dibuat otomatis dan perlu diverifikasi oleh tenaga kesehatan sebelum digunakan sebagai dasar tindakan medis.');
    return lines.join('\n');
  }

  function showList() {
    el.replaceChildren(listPage);
    renderList();
  }

  function detailShell(title, onDelete) {
    const detailEl = h(`<div class="page bpjs-detail-page"></div>`);
    const backBar = h(`
      <div class="topbar no-print">
        <button class="btn-text" aria-label="Kembali" style="font-size:20px;padding:0 8px 0 0;">&larr;</button>
        <h1 style="flex:1">${escapeHtml(title)}</h1>
        <button class="icon-button" aria-label="Hapus entri" data-delete-detail>${icon('trash')}</button>
      </div>
    `);
    backBar.querySelector('button').onclick = showList;
    backBar.querySelector('[data-delete-detail]').onclick = onDelete;
    detailEl.appendChild(backBar);
    return detailEl;
  }

  async function copyAction(text, afterCopy) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Teks disalin.');
      if (afterCopy) await afterCopy();
    } catch (e) {
      toast('Gagal menyalin: ' + e.message);
    }
  }

  function openEntry(entry) {
    if (entry.kind === 'papan') openPapan(entry);
    else openSession(entry);
  }

  function openPapan(entry) {
    const detailEl = detailShell(entry.title, () => confirmDelete(entry, () => { renderList(); showList(); }));
    const evs = [...entry.events].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    detailEl.appendChild(h(`
      <div class="card" style="margin-bottom:14px;">
        <h3 style="margin-top:0;">Asal data</h3>
        <p class="small" style="margin:4px 0;"><strong>Sumber:</strong> Papan Komunikasi — pilihan sentuhan pasien (bukan hasil AI atau STT).</p>
        <p class="small" style="margin:4px 0;"><strong>Kode pasien:</strong> ${escapeHtml(entry.title)} · <strong>Tanggal:</strong> ${fmtDay(entry.created)}</p>
        <p class="small muted" style="margin:4px 0;">Isi dicatat apa adanya saat pasien menekan tombol. Perlu diverifikasi perawat.</p>
      </div>`));
    detailEl.appendChild(h(`
      <div class="card" style="margin-bottom:14px;">
        <h3 style="margin-top:0;">Pesan pasien (urut waktu)</h3>
        <div class="pk-log">${evs.map((e) => `
          <div class="pk-log-row ${e.mendesak ? 'urgent' : ''}">
            <span class="pk-time">${fmtTime(e.created_at)}</span>
            <span>${escapeHtml(describeEvent(e))}</span>
            ${e.mendesak ? '<span class="pill pill--bad">mendesak</span>' : ''}
          </div>`).join('')}</div>
      </div>`));
    const text = [
      'CATATAN KOMUNIKASI PASIEN (Papan Komunikasi)',
      `Kode pasien: ${entry.title}`,
      `Tanggal: ${fmtDay(entry.created)}`,
      '',
      ...evs.map((e) => `${fmtTime(e.created_at)} – ${describeEvent(e)}${e.mendesak ? ' (mendesak)' : ''}`),
      '',
      'Catatan: dicatat otomatis dari pilihan pasien; perlu diverifikasi perawat.',
    ].join('\n');
    const actionsEl = h('<div class="row no-print" style="gap:10px;flex-wrap:wrap;"></div>');
    const copyBtn = h('<button class="btn btn-primary" style="flex:1;min-width:140px;">Salin Teks</button>');
    copyBtn.onclick = () => copyAction(text);
    const printBtn = h('<button class="btn btn-outline" style="flex:1;min-width:140px;">Cetak / Simpan PDF</button>');
    printBtn.onclick = () => window.print();
    actionsEl.append(copyBtn, printBtn);
    detailEl.appendChild(actionsEl);
    el.replaceChildren(detailEl);
    window.scrollTo(0, 0);
  }

  function openSession(entry) {
    const session = entry.session;
    const kind = entry.kind;
    const doc = docs.get(session.id) ?? null;
    const transcript = transcripts.get(session.id) ?? [];
    const plainText = buildPlainText(session, doc, transcript, kind);
    const structured = doc?.dokumentasi_terstruktur ?? {};

    const detailEl = detailShell(session.pasien_nama, () => confirmDelete(entry, () => { renderList(); showList(); }));

    const fieldsHtml = Object.entries(structured)
      .map(([key, value]) => `
        <div style="margin-bottom:10px;">
          <div class="muted small" style="text-transform:capitalize;">${escapeHtml(key.replace(/_/g, ' '))}</div>
          <div style="font-size:14px;">${escapeHtml(value)}</div>
        </div>`)
      .join('');

    const provider = doc?.perbandingan?.llm_provider || doc?.generated_by_llm_provider;
    detailEl.appendChild(h(`
      <div class="card" style="margin-bottom:14px;">
        <h3 style="margin-top:0;">Asal data</h3>
        <p class="small" style="margin:4px 0;"><strong>Sumber:</strong> ${KIND[kind].label} — ${kind === 'anamnesis' ? 'jawaban pasien (suara atau ketikan) atas pertanyaan standar' : 'rekaman percakapan perawat–pasien'}.</p>
        <p class="small" style="margin:4px 0;"><strong>Dibuat:</strong> ${fmt(session.created_at)} · <strong>Status:</strong> ${STATUS_LABEL[session.status] ?? escapeHtml(session.status)}</p>
        <p class="small" style="margin:4px 0;"><strong>Ringkasan oleh:</strong> ${provider ? 'AI (' + escapeHtml(provider) + ')' : 'tanpa AI (isi mentah)'}</p>
        <p class="small muted" style="margin:4px 0;">Draf otomatis — perlu diverifikasi sebelum dipakai.</p>
      </div>`));

    detailEl.appendChild(h(`
      <div class="card" style="margin-bottom:14px;">
        <p class="muted small" style="margin:0 0 8px;">Untuk: <strong>${escapeHtml(session.dokter_nama)}</strong>${session.dokter_instansi ? ' · ' + escapeHtml(session.dokter_instansi) : ''}</p>
        <h3 style="margin-top:0;">${kind === 'anamnesis' ? 'Draf anamnesis' : 'Hasil 2 — Ringkasan AI'}</h3>
        ${fieldsHtml || '<p class="muted small">Belum ada draf dokumentasi.</p>'}
      </div>`));

    const audit = doc?.perbandingan?.audit_jawaban;
    if (kind === 'anamnesis' && Array.isArray(audit) && audit.length > 0) {
      detailEl.appendChild(h(`
        <div class="card" style="margin-bottom:14px;">
          <h3 style="margin-top:0;">Jejak jawaban (transparansi)</h3>
          <p class="muted small" style="margin:0 0 8px;">Perbandingan hasil pengenalan suara mentah dengan jawaban akhir setelah diperiksa perawat.</p>
          ${audit.map((a, i) => `
            <div class="doc-audit">
              <div class="small"><strong>${i + 1}. ${escapeHtml(a.pertanyaan)}</strong></div>
              <div class="small"><span class="muted">Cara:</span> ${a.via === 'suara' ? 'suara (STT)' : a.via === 'dilewati' ? 'dilewati' : 'diketik'}${a.dikoreksi ? ' · <strong>dikoreksi perawat</strong>' : ''}</div>
              ${a.via === 'suara' ? `<div class="small"><span class="muted">STT mentah:</span> ${escapeHtml(a.stt_mentah || '(kosong)')}</div>` : ''}
              <div class="small"><span class="muted">Jawaban akhir:</span> ${escapeHtml(a.final || '(dilewati)')}</div>
            </div>`).join('')}
        </div>`));
    }

    if (transcript.length > 0) {
      detailEl.appendChild(h(`
        <div class="card" style="margin-bottom:14px;">
          <h3 style="margin-top:0;">${kind === 'anamnesis' ? 'Tanya-jawab' : 'Hasil 1 — STT (per pembicara)'}</h3>
          ${transcript.map((t) => `<p style="font-size:13px;margin:4px 0;"><strong>${escapeHtml(t.speaker)}:</strong> ${escapeHtml(t.text_segment)}</p>`).join('')}
        </div>`));
    }

    const cmpLines = comparisonLines(doc?.perbandingan);
    if (cmpLines.length > 0) {
      detailEl.appendChild(h(`
        <div class="card" style="margin-bottom:14px;">
          <h3 style="margin-top:0;">${kind === 'anamnesis' ? 'Ringkasan proses' : 'Perbandingan STT vs Ringkasan AI'}</h3>
          ${cmpLines.map((l) => `<p style="font-size:13px;margin:4px 0;">${escapeHtml(l)}</p>`).join('')}
        </div>`));
    }

    async function markSentOnce() {
      if (session.status !== 'terkirim') {
        await markBpjsSessionSent(session.id);
        session.status = 'terkirim';
        await load();
      }
    }

    const actionsEl = h('<div class="row no-print" style="gap:10px;flex-wrap:wrap;"></div>');
    const copyBtn = h('<button class="btn btn-primary" style="flex:1;min-width:140px;">Salin Teks</button>');
    copyBtn.onclick = () => copyAction(plainText, markSentOnce);
    actionsEl.appendChild(copyBtn);

    // "Cetak" needs no native bridge or extra library: every browser's own
    // print dialog can print to a real printer OR save as PDF — see the
    // @media print rule in style.css.
    const printBtn = h('<button class="btn btn-outline" style="flex:1;min-width:140px;">Cetak / Simpan PDF</button>');
    printBtn.onclick = async () => { await markSentOnce(); window.print(); };
    actionsEl.appendChild(printBtn);

    // PDF/DOCX as an actual file reuses the native export code through the
    // bridge — only available inside the installed app.
    for (const format of ['pdf', 'docx']) {
      const exportBtn = h(`<button class="btn btn-outline" style="flex:1;min-width:140px;">Ekspor ${format.toUpperCase()}</button>`);
      exportBtn.onclick = async () => {
        if (!Native.attached) {
          toast('Ekspor file hanya tersedia di aplikasi terpasang — gunakan "Cetak / Simpan PDF" di browser.');
          return;
        }
        exportBtn.disabled = true;
        const original = exportBtn.textContent;
        exportBtn.textContent = 'Membuat file...';
        try {
          const result = await Native.exportBpjs({
            format,
            dokterNama: session.dokter_nama,
            dokterInstansi: session.dokter_instansi,
            pasienNama: session.pasien_nama,
            createdAt: session.created_at,
            structured,
            transcript: transcript.map((t) => ({ speaker: t.speaker, text: t.text_segment })),
            comparison: doc?.perbandingan ?? null,
          });
          if (!result || !result.ok) throw new Error(result?.message || 'Jembatan native tidak merespons.');
          toast(`File ${format.toUpperCase()} siap dibagikan.`);
          await markSentOnce();
        } catch (e) {
          toast('Gagal membuat file: ' + e.message);
        } finally {
          exportBtn.disabled = false;
          exportBtn.textContent = original;
        }
      };
      actionsEl.appendChild(exportBtn);
    }
    detailEl.appendChild(actionsEl);

    el.replaceChildren(detailEl);
    window.scrollTo(0, 0);
  }

  await load();
  renderList();

  const refresh = async () => {
    await load();
    // Don't yank the user out of an open detail view; only redraw the list.
    if (el.firstChild === listPage) renderList();
  };
  const unwatchA = watchBpjsSessions(refresh);
  const unwatchB = watchKomunikasi(refresh);
  return { dispose: () => { unwatchA(); unwatchB(); } };
}
