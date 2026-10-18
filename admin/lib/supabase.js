// Klien tipis ke Supabase (PostgREST + GoTrue admin) memakai service key.
// Key ini melewati RLS, makanya HANYA hidup di proses server ini: tidak
// pernah dikirim ke browser, tidak pernah di-log.

const URL_BASE = (process.env.SUPABASE_URL || 'https://zcydtoywdcfjmhofdwwq.supabase.co').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';

export const configured = () => KEY.length > 20;
export const supabaseUrl = () => URL_BASE;

function headers(extra = {}) {
  const h = { apikey: KEY, 'Content-Type': 'application/json', ...extra };
  // Key lama (JWT eyJ…) harus juga dikirim sebagai Bearer; key baru sb_secret_… tidak.
  if (KEY.startsWith('eyJ')) h.Authorization = `Bearer ${KEY}`;
  return h;
}

async function call(path, { method = 'GET', body, prefer, range, timeout = 15000 } = {}) {
  const h = headers();
  if (prefer) h.Prefer = prefer;
  if (range) h.Range = range;
  const res = await fetch(`${URL_BASE}${path}`, {
    method, headers: h, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!res.ok) {
    const msg = (data && (data.message || data.msg || data.error_description || data.error)) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.code = data && data.code;
    throw err;
  }
  return { data, res };
}

const enc = encodeURIComponent;

/** Daftar baris + total (header Content-Range). */
export async function list(table, { select = '*', order, limit = 25, offset = 0, filters = [] } = {}) {
  const q = [`select=${enc(select)}`];
  if (order) q.push(`order=${order}`);
  for (const f of filters) q.push(f);
  const { data, res } = await call(`/rest/v1/${table}?${q.join('&')}`, {
    prefer: 'count=exact', range: `${offset}-${offset + limit - 1}`,
  });
  const total = Number((res.headers.get('content-range') || '').split('/')[1]);
  return { rows: data || [], total: Number.isFinite(total) ? total : (data || []).length };
}

export async function count(table, filters = []) {
  const q = ['select=*', ...filters].join('&');
  // HEAD hanya mengambil jumlah; GET sebelumnya ikut mengambil satu baris
  // lengkap, termasuk isi pasien yang tidak diperlukan dashboard admin.
  const { res } = await call(`/rest/v1/${table}?${q}`, { method: 'HEAD', prefer: 'count=exact', range: '0-0' });
  const total = Number((res.headers.get('content-range') || '').split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}

export async function insert(table, row) {
  const { data } = await call(`/rest/v1/${table}`, { method: 'POST', body: row, prefer: 'return=representation' });
  return data?.[0] ?? null;
}

export async function upsert(table, row, conflict) {
  const { data } = await call(`/rest/v1/${table}?on_conflict=${conflict}`, {
    method: 'POST', body: row, prefer: 'resolution=merge-duplicates,return=representation',
  });
  return data?.[0] ?? null;
}

export async function update(table, pk, id, patch) {
  const { data } = await call(`/rest/v1/${table}?${pk}=eq.${enc(id)}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
  return data?.[0] ?? null;
}

export async function remove(table, pk, id) {
  await call(`/rest/v1/${table}?${pk}=eq.${enc(id)}`, { method: 'DELETE' });
}

// ---- GoTrue admin (akun pengguna) -----------------------------------------
export async function listUsers(page = 1, perPage = 50) {
  const { data, res } = await call(`/auth/v1/admin/users?page=${page}&per_page=${perPage}`);
  // GoTrue menaruh total di header, bukan di body.
  const total = Number(res.headers.get('x-total-count'));
  return { ...data, total: Number.isFinite(total) && total > 0 ? total : (data?.users || []).length };
}
export async function createUser(body) {
  const { data } = await call('/auth/v1/admin/users', { method: 'POST', body });
  return data;
}
export async function updateUser(id, body) {
  const { data } = await call(`/auth/v1/admin/users/${enc(id)}`, { method: 'PUT', body });
  return data;
}
export async function deleteUser(id) {
  await call(`/auth/v1/admin/users/${enc(id)}`, { method: 'DELETE' });
}

/** Apakah tabel ada (migrasi schema-admin.sql sudah dijalankan)? */
export async function tableExists(table) {
  try {
    await call(`/rest/v1/${table}?select=*`, { method: 'HEAD', range: '0-0' });
    return true;
  } catch (e) {
    return !(e.status === 404 || e.code === 'PGRST205' || e.code === '42P01');
  }
}
