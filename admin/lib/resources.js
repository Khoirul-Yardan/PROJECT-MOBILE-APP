// Daftar tabel yang boleh disentuh panel admin, dan SEBERAPA jauh.
//
// Ini pagar privasi utama (AGENTS.md §2 butir 5): service_role melewati RLS,
// jadi server sendiri yang membatasi. Tabel konfigurasi = CRUD penuh. Tabel
// yang memuat data pasien/rahasia pengguna = hanya metadata, read-only, dan
// kolom isi (transkrip, nama pasien, kunci terenkripsi, dsb.) TIDAK PERNAH
// di-select. Menambah tabel baru ke sini = keputusan yang dicatat di
// docs/KEPUTUSAN.md.

const text = (name, o = {}) => ({ name, type: 'text', ...o });

export const RESOURCES = {
  // ---- CRUD: konfigurasi sistem ------------------------------------------
  announcements: {
    label: 'Pengumuman',
    group: 'Konten',
    mode: 'crud',
    pk: 'id',
    order: 'created_at.desc',
    search: ['title', 'body'],
    list: ['title', 'kind', 'starts_at', 'ends_at', 'active'],
    columns: [
      text('title', { required: true, max: 120 }),
      { name: 'body', type: 'textarea', max: 2000 },
      { name: 'kind', type: 'select', options: ['info', 'success', 'warning', 'maintenance'], default: 'info' },
      { name: 'starts_at', type: 'datetime', notNull: true, hint: 'mulai tampil (kosong = sekarang)' },
      { name: 'ends_at', type: 'datetime', hint: 'berhenti tampil (kosong = sampai dinonaktifkan)' },
      { name: 'active', type: 'bool', default: true },
    ],
  },
  profiles: {
    label: 'Profil pengguna',
    group: 'Pengguna',
    mode: 'crud',
    pk: 'id',
    order: 'created_at.desc',
    search: ['display_name'],
    list: ['display_name', 'created_at'],
    select: ['id', 'display_name', 'bio', 'created_at'],
    noCreate: true,
    noDelete: true, // hapus akun lewat halaman Pengguna (juga menghapus auth)
    columns: [
      text('display_name', { required: true }),
      { name: 'bio', type: 'textarea' },
    ],
  },

  // ---- READ-ONLY, hanya metadata: data pasien & rahasia -------------------
  bpjs_sessions: meta('Sesi Bot BPJS', 'id', ['id', 'perawat_id', 'status', 'created_at', 'updated_at'], 'created_at.desc'),
  bpjs_transcripts: meta('Segmen transkrip', 'id', ['id', 'session_id', 'speaker', 'timestamp_offset_ms', 'created_at'], 'created_at.desc'),
  bpjs_documents: meta('Dokumentasi LLM', 'id', ['id', 'session_id', 'generated_by_llm_provider', 'created_at', 'updated_at'], 'created_at.desc'),
  komunikasi_events: meta('Papan Komunikasi: event', 'id', ['id', 'user_id', 'jenis', 'mendesak', 'created_at'], 'created_at.desc'),
  komunikasi_rooms: meta('Papan Komunikasi: ruangan', 'id', ['id', 'owner_id', 'aktif', 'created_at'], 'created_at.desc'),
  chat_messages: meta('Pesan Chat', 'id', ['id', 'user_id', 'provider_id', 'session_id', 'role', 'is_error', 'created_at'], 'created_at.desc'),
  api_credentials: meta('API key pengguna', 'id', ['id', 'user_id', 'provider_id', 'label', 'type', 'format', 'model', 'created_at'], 'created_at.desc'),
  vpn_configs: meta('Konfigurasi VPN', 'user_id', ['user_id', 'protocol', 'updated_at'], 'updated_at.desc'),
  activity_log: meta('Log aktivitas pengguna', 'id', ['id', 'user_id', 'category', 'badge', 'created_at'], 'created_at.desc'),

  // ---- Khusus server: tidak dibuka lewat CRUD generik --------------------
  admin_audit_log: {
    label: 'Audit log admin',
    group: 'Sistem',
    mode: 'readonly',
    pk: 'id',
    order: 'created_at.desc',
    search: ['action', 'resource', 'admin'],
    list: ['created_at', 'admin', 'action', 'resource', 'target'],
    select: ['id', 'admin', 'action', 'resource', 'target', 'detail', 'ip', 'created_at'],
    columns: [],
  },
};

function meta(label, pk, select, order) {
  return {
    label,
    group: 'Data (metadata)',
    mode: 'meta',
    pk,
    order,
    search: [],
    list: select,
    select,
    columns: [],
    note: 'Isi data (teks percakapan, nama pasien, kunci terenkripsi) sengaja tidak ditampilkan: data pasien hanya terbaca pemilik sesi.',
  };
}

/** Kolom yang boleh ditulis pada resource CRUD (whitelist). */
export function writableColumns(res, creating) {
  return res.columns.filter((c) => creating || !c.createOnly).map((c) => c.name);
}

export function selectList(res) {
  if (res.select) return res.select.join(',');
  return '*'; // hanya resource crud (konfigurasi), tanpa kolom rahasia
}

/** Validasi + normalisasi satu payload; mengembalikan {data} atau {error}. */
export function cleanPayload(res, body, creating) {
  const allowed = new Set(writableColumns(res, creating));
  const data = {};
  for (const col of res.columns) {
    if (!allowed.has(col.name) || !(col.name in body)) continue;
    let v = body[col.name];
    if (v === '' || v === undefined) v = null;
    if (v === null) {
      if (col.required) return { error: `${col.name} wajib diisi` };
      if (col.type === 'text' || col.type === 'textarea') data[col.name] = '';
      else if (col.notNull) { if (!creating) data[col.name] = new Date().toISOString(); } // buat baru: biarkan default DB
      else if (col.type === 'select' || col.type === 'number' || col.type === 'bool') { if (col.default !== undefined) data[col.name] = col.default; }
      else data[col.name] = null;
      continue;
    }
    switch (col.type) {
      case 'number': v = Number(v); if (!Number.isFinite(v)) return { error: `${col.name} harus angka` }; break;
      case 'bool': v = v === true || v === 'true' || v === 1; break;
      case 'datetime': {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return { error: `${col.name}: tanggal tidak valid` };
        v = d.toISOString();
        break;
      }
      case 'json':
        if (typeof v === 'string') {
          try { v = JSON.parse(v); } catch { return { error: `${col.name}: JSON tidak valid` }; }
        }
        break;
      case 'select':
        if (!col.options.includes(v)) return { error: `${col.name}: pilihan tidak valid` };
        break;
      default:
        v = String(v);
        if (col.max && v.length > col.max) return { error: `${col.name}: maksimal ${col.max} karakter` };
        if (col.pattern && v && !new RegExp(col.pattern).test(v)) return { error: `${col.name}: format tidak valid` };
    }
    data[col.name] = v;
  }
  if (creating) {
    for (const col of res.columns) {
      if (col.required && (data[col.name] === undefined || data[col.name] === null || data[col.name] === '')) {
        return { error: `${col.name} wajib diisi` };
      }
    }
  }
  if (res.touch) data[res.touch] = new Date().toISOString();
  return { data };
}

/** Skema aman untuk dikirim ke UI. */
export function publicSchema() {
  const out = {};
  for (const [name, r] of Object.entries(RESOURCES)) {
    out[name] = {
      name, label: r.label, group: r.group, mode: r.mode, pk: r.pk, list: r.list,
      columns: r.columns, note: r.note || null, search: r.search.length > 0,
      noCreate: !!r.noCreate, noDelete: !!r.noDelete,
    };
  }
  return out;
}
