import { h, header, toast, pageIntro, emptyState } from '../ui.js';
import { fetchNurseBpjsSessions, fetchBpjsDocument, fetchBpjsTranscript, markBpjsSessionSent, watchBpjsSessions } from '../db.js';

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

// Riwayat Bot BPJS — daftar sesi yang pernah direkam perawat sendiri.
// Tidak ada review dokter di sini (Friend System yang jadi dasarnya sudah
// dihapus): draf dokumentasi diteruskan perawat langsung ke dokter lewat
// salin-teks, PDF, atau DOCX — lihat juga export langsung di layar Bot BPJS
// (app/lib/screens/bot_bpjs_screen.dart) tepat setelah sesi selesai direkam.
export default async function render(root) {
  const el = h(`<div class="page bpjs-review-page"></div>`);
  el.appendChild(header('Riwayat Bot BPJS', { back: true }));
  el.appendChild(pageIntro('Catatan yang tertata.', 'Temukan kembali sesi dan dokumentasi untuk diteruskan ke dokter.', { art: 'bot', label: 'DOKUMENTASI BPJS', tone: 'intro-mint' }));
  el.appendChild(
    h(`
    <p class="muted small" style="margin-top:-8px;">
      Sesi yang sudah Anda rekam. Salin teks atau buka kembali di aplikasi untuk ekspor PDF/DOCX.
    </p>
  `)
  );
  const listEl = h('<div class="list"></div>');
  el.appendChild(listEl);
  root.appendChild(el);

  let sessions = [];

  async function load() {
    sessions = await fetchNurseBpjsSessions();
  }

  function renderList() {
    listEl.innerHTML = '';
    if (sessions.length === 0) {
      listEl.appendChild(
        emptyState('Sesi pertamamu menunggu.', 'Buka Bot Hub → Bot BPJS di aplikasi untuk mulai merekam.', 'bot')
      );
      return;
    }
    sessions.forEach((s) => {
      const tone = STATUS_TONE[s.status] ?? 'warn';
      const card = h(`
        <button type="button" class="card tappable" style="text-align:left;margin-bottom:10px;">
          <div class="row-between">
            <h3 style="margin:0;">${s.pasien_nama}</h3>
            <span class="pill pill--${tone}">${STATUS_LABEL[s.status] ?? s.status}</span>
          </div>
          <p class="muted small" style="margin-top:4px;">
            Untuk: ${s.dokter_nama}${s.dokter_instansi ? ' · ' + s.dokter_instansi : ''} · ${new Date(s.created_at).toLocaleString()}
          </p>
        </button>
      `);
      card.onclick = () => openSession(s);
      listEl.appendChild(card);
    });
  }

  function buildPlainText(session, doc, transcript) {
    const structured = doc?.dokumentasi_terstruktur ?? {};
    const lines = [
      `DOKUMENTASI PERCAKAPAN PERAWAT-PASIEN`,
      `Untuk: ${session.dokter_nama}${session.dokter_instansi ? ' (' + session.dokter_instansi + ')' : ''}`,
      `Pasien: ${session.pasien_nama}`,
      `Tanggal: ${new Date(session.created_at).toLocaleString()}`,
      '',
      ...Object.entries(structured).map(([key, value]) => `${key.replace(/_/g, ' ').toUpperCase()}:\n${value}`),
    ];
    if (transcript.length > 0) {
      lines.push('', 'TRANSKRIP PERCAKAPAN:');
      transcript.forEach((t) => lines.push(`${t.speaker}: ${t.text_segment}`));
    }
    lines.push('', 'Catatan: draf ini dibuat otomatis dan perlu diverifikasi oleh dokter sebelum digunakan sebagai dasar tindakan medis.');
    return lines.join('\n');
  }

  async function openSession(session) {
    const doc = await fetchBpjsDocument(session.id);
    const transcript = await fetchBpjsTranscript(session.id);
    const plainText = buildPlainText(session, doc, transcript);

    const detailEl = h(`<div class="page bpjs-detail-page"></div>`);
    const backBar = h(`
      <div class="topbar">
        <button class="btn-text" aria-label="Kembali" style="font-size:20px;padding:0 8px 0 0;">&larr;</button>
        <h1 style="flex:1">${session.pasien_nama}</h1>
      </div>
    `);
    backBar.querySelector('button').onclick = () => {
      el.replaceChildren();
      el.appendChild(header('Riwayat Bot BPJS', { back: true }));
      el.appendChild(listEl);
    };
    detailEl.appendChild(backBar);

    const structured = doc?.dokumentasi_terstruktur ?? {};
    const fieldsHtml = Object.entries(structured)
      .map(
        ([key, value]) => `
        <div style="margin-bottom:10px;">
          <div class="muted small" style="text-transform:capitalize;">${key.replace(/_/g, ' ')}</div>
          <div style="font-size:14px;">${value}</div>
        </div>
      `
      )
      .join('');

    detailEl.appendChild(
      h(`
      <div class="card" style="margin-bottom:14px;">
        <p class="muted small" style="margin:0 0 8px;">Untuk: <strong>${session.dokter_nama}</strong>${session.dokter_instansi ? ' · ' + session.dokter_instansi : ''}</p>
        <h3 style="margin-top:0;">Draf Dokumentasi</h3>
        ${fieldsHtml || '<p class="muted small">Belum ada draf dokumentasi.</p>'}
        ${doc?.generated_by_llm_provider ? `<p class="muted small">Disusun oleh: ${doc.generated_by_llm_provider}</p>` : ''}
      </div>
    `)
    );

    if (transcript.length > 0) {
      detailEl.appendChild(
        h(`
        <div class="card" style="margin-bottom:14px;">
          <h3 style="margin-top:0;">Transkrip</h3>
          ${transcript.map((t) => `<p style="font-size:13px;margin:4px 0;"><strong>${t.speaker}:</strong> ${t.text_segment}</p>`).join('')}
        </div>
      `)
      );
    }

    const actionsEl = h('<div class="row" style="gap:10px;flex-wrap:wrap;"></div>');
    const copyBtn = h('<button class="btn btn-primary" style="flex:1;">Salin Teks</button>');
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(plainText);
        toast('Teks disalin — siap ditempel ke WhatsApp/Email untuk dokter.');
        if (session.status !== 'terkirim') {
          await markBpjsSessionSent(session.id);
          await load();
        }
      } catch (e) {
        toast('Gagal menyalin: ' + e.message);
      }
    };
    actionsEl.appendChild(copyBtn);
    detailEl.appendChild(actionsEl);
    detailEl.appendChild(
      h(`
      <p class="muted small" style="margin-top:12px;">
        Untuk ekspor sebagai file PDF atau DOCX, buka sesi ini langsung dari aplikasi (Bot Hub → Bot BPJS → riwayat sesi) — berkas dibuat di perangkat lalu bisa langsung dibagikan lewat aplikasi apa pun di HP Anda.
      </p>
    `)
    );

    el.replaceChildren();
    el.appendChild(detailEl);
  }

  await load();
  renderList();

  const unwatch = watchBpjsSessions(async () => {
    await load();
    renderList();
  });

  return { dispose: unwatch };
}
