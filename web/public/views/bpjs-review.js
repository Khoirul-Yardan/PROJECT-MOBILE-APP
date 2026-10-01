import { h, header, toast } from '../ui.js';
import {
  fetchDoctorBpjsSessions,
  fetchNurseBpjsSessions,
  fetchBpjsDocument,
  fetchBpjsTranscript,
  submitBpjsReview,
  watchBpjsSessions,
  currentUser,
  myProfile,
} from '../db.js';

const STATUS_LABEL = {
  recording: 'Merekam',
  processing: 'Diproses',
  sent: 'Terkirim',
  pending_review: 'Menunggu Review',
  needs_revision: 'Perlu Revisi',
  matches_bpjs_form: 'Sesuai Form BPJS',
};

const STATUS_TONE = {
  pending_review: 'warn',
  needs_revision: 'bad',
  matches_bpjs_form: 'ok',
};

// Doctor-side review for Bot BPJS sessions. Recording happens natively on
// the nurse's device (see app/lib/screens/bot_bpjs_screen.dart); once a
// session is saved it's just rows in Supabase, so the doctor reviews it
// from their own account here — same data, independent device, which is
// what the PRD's "doctor verifies from their own side" step actually needs.
export default async function render(root) {
  const user = await currentUser();
  const profile = await myProfile();
  const isDoctor = profile?.role === 'dokter';

  const el = h(`<div class="page bpjs-review-page"></div>`);
  el.appendChild(header('Dokumentasi BPJS', { back: true }));
  el.appendChild(
    h(`
    <p class="muted small" style="margin-top:-8px;">
      ${
        isDoctor
          ? 'Sesi dari perawat yang mengirim dokumentasi ke Anda.'
          : 'Sesi Bot BPJS yang sudah Anda kirim ke dokter.'
      }
    </p>
  `)
  );
  const listEl = h('<div class="list"></div>');
  el.appendChild(listEl);
  root.appendChild(el);

  let sessions = [];

  async function load() {
    sessions = isDoctor ? await fetchDoctorBpjsSessions() : await fetchNurseBpjsSessions();
  }

  function renderList() {
    listEl.innerHTML = '';
    if (sessions.length === 0) {
      listEl.appendChild(
        h(
          `<div class="empty-state">${
            isDoctor ? 'Belum ada sesi dikirim ke Anda.' : 'Belum ada sesi Bot BPJS. Buka Bot Hub → Bot BPJS di aplikasi untuk mulai.'
          }</div>`
        )
      );
      return;
    }
    sessions.forEach((s) => {
      const otherName = isDoctor
        ? s.nurse_profile?.display_name ?? 'Perawat'
        : s.doctor_profile?.display_name ?? 'Dokter';
      const tone = STATUS_TONE[s.status] ?? 'warn';
      const card = h(`
        <button type="button" class="card tappable" style="text-align:left;margin-bottom:10px;">
          <div class="row-between">
            <h3 style="margin:0;">${s.pasien_nama}</h3>
            <span class="pill pill--${tone}">${STATUS_LABEL[s.status] ?? s.status}</span>
          </div>
          <p class="muted small" style="margin-top:4px;">
            ${isDoctor ? 'Dari' : 'Untuk'}: ${otherName} · ${new Date(s.created_at).toLocaleString()}
          </p>
        </button>
      `);
      card.onclick = () => openSession(s);
      listEl.appendChild(card);
    });
  }

  async function openSession(session) {
    const doc = await fetchBpjsDocument(session.id);
    const transcript = await fetchBpjsTranscript(session.id);

    const detailEl = h(`<div class="page bpjs-detail-page"></div>`);
    const backBar = h(`
      <div class="topbar">
        <button class="btn-text" aria-label="Kembali" style="font-size:20px;padding:0 8px 0 0;">&larr;</button>
        <h1 style="flex:1">${session.pasien_nama}</h1>
      </div>
    `);
    backBar.querySelector('button').onclick = () => {
      el.replaceChildren();
      el.appendChild(header('Dokumentasi BPJS', { back: true }));
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

    if (isDoctor && session.status === 'pending_review') {
      const noteInput = h('<textarea placeholder="Catatan untuk perawat (opsional)" rows="2" style="margin-bottom:10px;"></textarea>');
      detailEl.appendChild(noteInput);
      const actionsEl = h('<div class="row" style="gap:10px;"></div>');
      const approveBtn = h('<button class="btn btn-primary" style="flex:1;">Sesuai Form BPJS</button>');
      const reviseBtn = h('<button class="btn btn-outline" style="flex:1;">Perlu Revisi</button>');
      approveBtn.onclick = async () => {
        try {
          await submitBpjsReview(session.id, 'matches_bpjs_form', noteInput.value.trim());
          toast('Ditandai sesuai form BPJS.');
          el.replaceChildren();
          el.appendChild(header('Dokumentasi BPJS', { back: true }));
          el.appendChild(listEl);
          await load();
          renderList();
        } catch (e) {
          toast(e.message || 'Gagal menyimpan review.');
        }
      };
      reviseBtn.onclick = async () => {
        try {
          await submitBpjsReview(session.id, 'needs_revision', noteInput.value.trim());
          toast('Dikirim kembali untuk revisi.');
          el.replaceChildren();
          el.appendChild(header('Dokumentasi BPJS', { back: true }));
          el.appendChild(listEl);
          await load();
          renderList();
        } catch (e) {
          toast(e.message || 'Gagal menyimpan review.');
        }
      };
      actionsEl.appendChild(reviseBtn);
      actionsEl.appendChild(approveBtn);
      detailEl.appendChild(actionsEl);
    } else if (session.status !== 'pending_review' && session.status !== 'recording' && session.status !== 'processing') {
      const tone = STATUS_TONE[session.status] ?? 'warn';
      detailEl.appendChild(
        h(`
        <div class="card" style="background:var(--${tone}-tint);">
          <p style="margin:0;font-size:13px;">
            Status: <strong>${STATUS_LABEL[session.status] ?? session.status}</strong>
          </p>
        </div>
      `)
      );
    }

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
