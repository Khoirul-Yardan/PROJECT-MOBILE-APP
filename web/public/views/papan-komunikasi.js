import { h, icon, header, toast, escapeHtml } from '../ui.js';
import { sb, currentUser, watchKomunikasi } from '../db.js';
import { navigate } from '../router.js';
import { Native } from '../bridge.js';

// Papan Komunikasi — a touch-to-speech board for patients who cannot talk
// (ICU, stroke, post-op). Pure web on purpose: big buttons + the browser's
// speechSynthesis are enough, so no native module is needed. Every tap is
// also logged as a timestamped complaint (jenis/skala/lokasi) the nurse can
// copy straight into the anamnesis. Basis: low-tech AAC boards are feasible
// and safe in ICU communication (docs/REFERENSI-SUMBER-ILMIAH.md [1][2][3]);
// the 0-10 numeric scale is the standard for pain intensity [19].
//
// The board itself is NOT a replacement for the hospital's own nurse call.

const ITEMS = [
  { key: 'nyeri', label: 'Nyeri', emoji: '😣', say: 'Saya merasa nyeri', flow: 'pain' },
  { key: 'sesak', label: 'Sesak napas', emoji: '😮‍💨', say: 'Saya sesak napas', urgent: true },
  { key: 'haus', label: 'Haus', emoji: '🥤', say: 'Saya haus, minta minum' },
  { key: 'lapar', label: 'Lapar', emoji: '🍚', say: 'Saya lapar' },
  { key: 'mual', label: 'Mual', emoji: '🤢', say: 'Saya merasa mual' },
  { key: 'toilet', label: 'Ke toilet', emoji: '🚽', say: 'Saya perlu ke toilet' },
  { key: 'dingin', label: 'Dingin', emoji: '🥶', say: 'Saya kedinginan' },
  { key: 'panas', label: 'Panas', emoji: '🥵', say: 'Saya kepanasan' },
  { key: 'posisi', label: 'Ubah posisi', emoji: '🛏️', say: 'Tolong ubah posisi saya' },
  { key: 'obat', label: 'Minta obat', emoji: '💊', say: 'Saya minta obat' },
  { key: 'panggil', label: 'PANGGIL SUSTER', emoji: '🔔', say: 'Tolong panggil suster', urgent: true, wide: true },
];

const BODY = ['Kepala', 'Dada', 'Perut', 'Punggung', 'Lengan', 'Tungkai', 'Lainnya'];
const LS_EVENTS = 'papan_komunikasi_events';
const LS_PATIENT = 'papan_komunikasi_pasien';

const nowHm = (iso) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

// Native TTS first (the WebView's own speechSynthesis is frequently mute on
// Android); browser speechSynthesis otherwise, with an explicit id-ID voice
// because mobile Chrome stays silent when no voice is bound to the utterance.
function speak(text) {
  if (Native.attached) {
    Native.speak(text).then((r) => { if (!r?.ok) browserSpeak(text); });
    return true;
  }
  return browserSpeak(text);
}

function browserSpeak(text) {
  try {
    if (!('speechSynthesis' in window)) return false;
    const synth = window.speechSynthesis;
    synth.resume();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'id-ID';
    // Near-normal pace — a button tap (e.g. "Nyeri") should speak out
    // immediately and briskly, not a slow stretched-out read. 1.0 is the
    // Web Speech API's normal speaking rate; keep it there instead of
    // dragging it down like the old 0.95.
    u.rate = 1.05;
    const voices = synth.getVoices();
    const voice = voices.find((v) => /^id[-_]ID$/i.test(v.lang)) || voices.find((v) => /^id/i.test(v.lang));
    if (voice) u.voice = voice;
    // cancel() immediately followed by speak() drops the utterance on Android.
    if (synth.speaking || synth.pending) {
      synth.cancel();
      setTimeout(() => synth.speak(u), 120);
    } else {
      synth.speak(u);
    }
    return true;
  } catch {
    return false;
  }
}

function localEvents() {
  try {
    return JSON.parse(localStorage.getItem(LS_EVENTS) || '[]');
  } catch {
    return [];
  }
}
function pushLocal(ev) {
  try {
    const all = [ev, ...localEvents()].slice(0, 200);
    localStorage.setItem(LS_EVENTS, JSON.stringify(all));
  } catch {
    /* storage can be blocked; the Supabase copy is the durable one */
  }
}

async function saveEvent(ev) {
  pushLocal(ev);
  try {
    const user = await currentUser();
    if (!user) return false;
    const { error } = await sb.from('komunikasi_events').insert({
      user_id: user.id,
      pasien_ref: ev.pasien_ref || null,
      jenis: ev.jenis,
      detail: ev.detail || {},
      mendesak: !!ev.mendesak,
    });
    return !error;
  } catch {
    return false;
  }
}

async function loadEvents() {
  try {
    const user = await currentUser();
    if (user) {
      const { data, error } = await sb
        .from('komunikasi_events')
        .select('pasien_ref,jenis,detail,mendesak,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) return data;
    }
  } catch {
    /* fall through to the local copy */
  }
  return localEvents();
}

function describe(ev) {
  const d = ev.detail || {};
  const parts = [ev.label || d.label || ev.jenis];
  if (d.lokasi) parts.push(`lokasi ${d.lokasi.toLowerCase()}`);
  if (d.skala !== undefined && d.skala !== null) parts.push(`skala ${d.skala}/10`);
  return parts.join(', ');
}

const roomLink = (token) => `${location.origin}${location.pathname}#/p?t=${token}`;

async function sendViaToken(token, ev) {
  try {
    const { data, error } = await sb.rpc('komunikasi_kirim', {
      p_token: token, p_jenis: ev.jenis, p_detail: ev.detail || {}, p_mendesak: !!ev.mendesak,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

// Halaman pasien/keluarga: dibuka dari tautan ruangan, tanpa login.
export async function patientView(root) {
  const token = (location.hash.split('?t=')[1] || '').split('&')[0];
  let nama = null;
  try {
    const { data } = await sb.rpc('komunikasi_room_info', { p_token: token });
    nama = data?.[0]?.nama ?? null;
  } catch { /* handled below */ }
  if (!nama) {
    const el = h('<div class="page"><div class="empty-state">Tautan ini tidak berlaku atau sudah dinonaktifkan.<br/>Mohon minta tautan baru kepada perawat.</div></div>');
    root.appendChild(el);
    return {};
  }
  return render(root, { token, nama });
}

export default async function render(root, guest = null) {
  let patient = '';
  try {
    patient = localStorage.getItem(LS_PATIENT) || '';
  } catch {
    /* ignore */
  }
  let tab = 'papan';
  let flow = null; // { step: 'skala'|'lokasi', skala }
  let sentNote = '';

  const el = h(`<div class="page pk-page"></div>`);
  el.appendChild(header(guest ? `Ruang ${escapeHtml(guest.nama)}` : 'Papan Komunikasi', { back: !guest }));
  const body = h('<div></div>');
  el.appendChild(body);
  root.appendChild(el);

  async function record(item, detail = {}) {
    const ev = {
      pasien_ref: patient.trim(),
      jenis: item.key,
      label: item.label,
      detail: { ...detail, label: item.label },
      mendesak: !!item.urgent,
      created_at: new Date().toISOString(),
    };
    const spoken = speak(sentenceFor(item, detail));
    const saved = guest ? await sendViaToken(guest.token, ev) : await saveEvent(ev);
    sentNote = guest
      ? `${describe(ev)}${saved ? '' : ' - GAGAL terkirim, coba lagi atau panggil perawat langsung'}`
      : `${describe(ev)}${saved ? '' : ' (tersimpan di perangkat ini saja)'}`;
    if (!spoken) toast('Suara tidak tersedia di perangkat ini — pesan tetap tercatat.');
    flow = null;
    draw();
  }

  function sentenceFor(item, d) {
    if (item.key !== 'nyeri') return item.say;
    const parts = ['Saya nyeri'];
    if (d.lokasi) parts[0] += ` di ${d.lokasi.toLowerCase()}`;
    if (d.skala !== undefined) parts.push(`skala ${d.skala} dari 10`);
    return parts.join(', ');
  }

  function drawTabs() {
    if (guest) return h('<div></div>');
    const t = h(`<div class="pk-tabs" role="tablist">
      <button type="button" role="tab" class="pk-tab ${tab === 'papan' ? 'on' : ''}" data-t="papan">Papan</button>
      <button type="button" role="tab" class="pk-tab ${tab === 'ruangan' ? 'on' : ''}" data-t="ruangan">Ruangan</button>
      <button type="button" role="tab" class="pk-tab ${tab === 'catatan' ? 'on' : ''}" data-t="catatan">Catatan</button>
    </div>`);
    t.querySelectorAll('.pk-tab').forEach((b) => {
      b.onclick = () => { tab = b.dataset.t; flow = null; draw(); };
    });
    return t;
  }

  function drawBoard() {
    const wrap = h('<div></div>');
    if (!guest) wrap.appendChild(h(`<label class="pk-ref"><span class="small muted">Kode / inisial pasien (opsional, jangan tulis nama lengkap)</span>
      <input id="pk-ref" maxlength="20" value="${escapeHtml(patient)}" placeholder="mis. Bed 3 / AB" autocomplete="off"/></label>`));
    if (!guest) wrap.querySelector('#pk-ref').oninput = (e) => {
      patient = e.target.value;
      try { localStorage.setItem(LS_PATIENT, patient); } catch { /* ignore */ }
    };

    if (sentNote) {
      const ok = h(`<div class="pk-sent" role="status"><strong>Terkirim ✓</strong><br/><span class="small">${escapeHtml(sentNote)}</span></div>`);
      wrap.appendChild(ok);
    }

    if (flow?.step === 'skala') {
      const p = h(`<div class="pk-flow"><h3>Seberapa nyeri? <span class="muted small">(0 = tidak nyeri, 10 = paling nyeri)</span></h3><div class="pk-scale"></div>
        <button type="button" class="btn btn-outline" id="pk-cancel">Batal</button></div>`);
      const grid = p.querySelector('.pk-scale');
      for (let i = 0; i <= 10; i += 1) {
        const b = h(`<button type="button" class="pk-num pk-n${i}">${i}</button>`);
        b.onclick = () => { flow = { step: 'lokasi', skala: i }; draw(); };
        grid.appendChild(b);
      }
      p.querySelector('#pk-cancel').onclick = () => { flow = null; draw(); };
      wrap.appendChild(p);
      return wrap;
    }
    if (flow?.step === 'lokasi') {
      const p = h(`<div class="pk-flow"><h3>Di mana nyerinya? <span class="muted small">(skala ${flow.skala}/10)</span></h3><div class="pk-grid pk-body"></div>
        <button type="button" class="btn btn-outline" id="pk-back">Kembali</button></div>`);
      const grid = p.querySelector('.pk-body');
      BODY.forEach((lokasi) => {
        const b = h(`<button type="button" class="pk-btn">${escapeHtml(lokasi)}</button>`);
        b.onclick = () => record(ITEMS[0], { skala: flow.skala, lokasi });
        grid.appendChild(b);
      });
      p.querySelector('#pk-back').onclick = () => { flow = { step: 'skala' }; draw(); };
      wrap.appendChild(p);
      return wrap;
    }

    const grid = h('<div class="pk-grid"></div>');
    ITEMS.forEach((item) => {
      const b = h(`<button type="button" class="pk-btn ${item.urgent ? 'urgent' : ''} ${item.wide ? 'wide' : ''}">
        <span class="pk-emoji" aria-hidden="true">${item.emoji}</span><span>${escapeHtml(item.label)}</span></button>`);
      b.onclick = () => {
        sentNote = '';
        if (item.flow === 'pain') { flow = { step: 'skala' }; draw(); } else record(item);
      };
      grid.appendChild(b);
    });
    wrap.appendChild(grid);
    wrap.appendChild(h(`<p class="small muted" style="margin-top:14px;">Alat bantu komunikasi — <strong>bukan pengganti</strong> sistem panggil perawat resmi rumah sakit. Untuk keadaan darurat gunakan tombol panggil di tempat tidur.</p>`));
    return wrap;
  }

  async function drawNotes() {
    const wrap = h('<div></div>');
    wrap.appendChild(h('<p class="small muted">Memuat catatan...</p>'));
    body.replaceChildren(drawTabs(), wrap);
    const events = await loadEvents();
    if (tab !== 'catatan') return;
    wrap.replaceChildren();
    if (!events.length) {
      wrap.appendChild(h('<div class="empty-state">Belum ada pesan dari pasien.</div>'));
      return;
    }
    const lines = events.map((ev) => `${nowHm(ev.created_at)} – ${ev.pasien_ref ? `[${ev.pasien_ref}] ` : ''}${describe(ev)}${ev.mendesak ? ' (mendesak)' : ''}`);
    const copy = h(`<button type="button" class="btn btn-primary" style="margin-bottom:12px;">${icon('document')} Salin untuk anamnesis</button>`);
    copy.onclick = async () => {
      const text = `CATATAN KOMUNIKASI PASIEN (Papan Komunikasi)\n${lines.join('\n')}\n\nCatatan: dicatat otomatis dari pilihan pasien; perlu diverifikasi perawat.`;
      try { await navigator.clipboard.writeText(text); toast('Catatan disalin'); } catch { toast('Gagal menyalin — salin manual dari daftar.'); }
    };
    wrap.appendChild(copy);
    const hist = h('<button type="button" class="btn btn-outline" style="margin-bottom:12px;">Buka Dokumentasi (cari &amp; riwayat lengkap)</button>');
    hist.onclick = () => navigate('/bpjs');
    wrap.appendChild(hist);
    const list = h('<div class="pk-log"></div>');
    events.forEach((ev) => {
      list.appendChild(h(`<div class="pk-log-row ${ev.mendesak ? 'urgent' : ''}">
        <span class="pk-time">${nowHm(ev.created_at)}</span>
        <span>${ev.pasien_ref ? `<strong>${escapeHtml(ev.pasien_ref)}</strong> · ` : ''}${escapeHtml(describe(ev))}</span>
        ${ev.mendesak ? '<span class="pill pill--bad">mendesak</span>' : ''}</div>`));
    });
    wrap.appendChild(list);
  }

  async function drawRooms() {
    const wrap = h('<div></div>');
    wrap.appendChild(h('<p class="small muted">Memuat ruangan...</p>'));
    body.replaceChildren(drawTabs(), wrap);
    const user = await currentUser();
    const { data: rooms, error } = user
      ? await sb.from('komunikasi_rooms').select('id,nama,token,aktif,created_at').eq('owner_id', user.id).order('created_at', { ascending: false })
      : { data: [], error: null };
    if (tab !== 'ruangan') return;
    wrap.replaceChildren();
    if (error) {
      wrap.appendChild(h(`<div class="empty-state">Fitur tautan ruangan belum aktif di database (jalankan migrasi komunikasi_rooms di Supabase).<br/><span class="small muted">${escapeHtml(error.message)}</span></div>`));
      return;
    }
    const { data: evs } = await sb.from('komunikasi_events').select('room_id,detail,jenis,mendesak,created_at').not('room_id', 'is', null).order('created_at', { ascending: false }).limit(200);
    const last = new Map();
    (evs || []).forEach((e) => { if (!last.has(e.room_id)) last.set(e.room_id, e); });

    const form = h(`<div class="pk-flow"><label class="pk-ref"><span class="small muted">Nama ruangan / bed (jangan tulis nama lengkap pasien)</span>
      <input id="pk-room-name" maxlength="40" placeholder="mis. Melati - Bed 3" autocomplete="off"/></label>
      <button type="button" class="btn btn-primary" id="pk-room-add">Buat tautan ruangan</button></div>`);
    form.querySelector('#pk-room-add').onclick = async () => {
      const nama = form.querySelector('#pk-room-name').value.trim();
      if (!nama) { toast('Isi nama ruangan dulu.'); return; }
      const { error: e } = await sb.from('komunikasi_rooms').insert({ owner_id: user.id, nama });
      if (e) { toast(`Gagal membuat ruangan: ${e.message}`); return; }
      drawRooms();
    };
    wrap.appendChild(form);
    if (!rooms.length) wrap.appendChild(h('<div class="empty-state">Belum ada ruangan. Buat satu, lalu kirim tautannya ke pasien atau keluarga.</div>'));
    rooms.forEach((r) => {
      const ev = last.get(r.id);
      const card = h(`<div class="pk-log-row ${ev?.mendesak ? 'urgent' : ''}" style="flex-wrap:wrap;gap:8px;">
        <div style="flex:1;min-width:180px;"><strong>${escapeHtml(r.nama)}</strong>${r.aktif ? '' : ' <span class="pill pill--warn">nonaktif</span>'}<br/>
        <span class="small muted">${ev ? `${nowHm(ev.created_at)} - ${escapeHtml(describe(ev))}` : 'Belum ada pesan'}</span></div>
        <button type="button" class="btn btn-outline" data-a="copy">Salin tautan</button>
        <button type="button" class="btn btn-outline" data-a="share">Bagikan</button>
        <button type="button" class="btn btn-outline" data-a="toggle">${r.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
        <button type="button" class="btn btn-outline" data-a="del">Hapus</button></div>`);
      const link = roomLink(r.token);
      const copyLink = async () => {
        try { await navigator.clipboard.writeText(link); toast('Tautan disalin'); } catch { toast(link); }
      };
      card.querySelector('[data-a=copy]').onclick = copyLink;
      card.querySelector('[data-a=share]').onclick = async () => {
        try { await navigator.share({ title: `Papan Komunikasi ${r.nama}`, text: 'Tautan papan komunikasi pasien:', url: link }); }
        catch { await copyLink(); }
      };
      card.querySelector('[data-a=toggle]').onclick = async () => {
        await sb.from('komunikasi_rooms').update({ aktif: !r.aktif }).eq('id', r.id); drawRooms();
      };
      card.querySelector('[data-a=del]').onclick = async () => {
        if (!confirm(`Hapus ruangan ${r.nama}? Tautannya berhenti berlaku.`)) return;
        await sb.from('komunikasi_rooms').delete().eq('id', r.id); drawRooms();
      };
      wrap.appendChild(card);
    });
  }

  function draw() {
    if (tab === 'ruangan') { drawRooms(); return; }
    if (tab === 'catatan') { drawNotes(); return; }
    body.replaceChildren(drawTabs(), drawBoard());
  }
  draw();

  // Perawat: pesan baru dari tautan ruangan muncul langsung (realtime).
  let stopWatch = null;
  if (!guest) {
    stopWatch = watchKomunikasi((payload) => {
      const ev = payload.new;
      if (payload.eventType !== 'INSERT' || !ev?.room_id) return;
      toast(`${ev.mendesak ? 'MENDESAK - ' : ''}${ev.pasien_ref || 'Ruangan'}: ${describe({ ...ev, label: ev.detail?.label })}`);
      if (tab === 'ruangan') drawRooms();
      else if (tab === 'catatan') drawNotes();
    });
  }

  return { dispose: () => { stopWatch?.(); try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } } };
}
