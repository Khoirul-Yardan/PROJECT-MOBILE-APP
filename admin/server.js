// AI Hub — Panel Admin (backend). Tanpa dependensi npm: node:http + fetch.
//
// Peran: satu-satunya pemegang SUPABASE_SERVICE_KEY. Browser admin hanya bicara
// ke API ini (cookie sesi), dan API ini yang bicara ke Supabase. Lihat
// docs/PANEL-ADMIN.md untuk arsitektur dan aturan privasinya.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sb from './lib/supabase.js';
import * as auth from './lib/auth.js';
import { RESOURCES, cleanPayload, selectList, publicSchema } from './lib/resources.js';

const PORT = Number(process.env.PORT || 8095);
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const SETUP_SQL = process.env.SETUP_SQL_PATH || '/app/schema-admin.sql';
const WEB_URL = process.env.WEB_URL || 'http://web';
const RELAY_URL = process.env.RELAY_URL || 'http://relay:8091';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.ico': 'image/x-icon',
};
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function send(res, status, body, headers = {}) {
  const isJson = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    ...SEC_HEADERS, ...(isJson ? { 'Content-Type': 'application/json; charset=utf-8' } : {}), ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 256 * 1024) throw new HttpError(413, 'Isi permintaan terlalu besar');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'JSON tidak valid'); }
}

// X-Forwarded-For hanya dipercaya bila TRUST_PROXY=true (di belakang reverse proxy
// sendiri); jika tidak, penyerang bisa memalsukannya untuk menghindari pembatas login.
const clientIp = (req) => (process.env.TRUST_PROXY === 'true' && (req.headers['x-forwarded-for'] || '').split(',')[0].trim())
  || req.socket.remoteAddress || '';

// Jejak audit: hanya nama field & ID, tidak pernah isi data pasien.
async function audit(req, session, action, resource, target, detail = {}) {
  try {
    await sb.insert('admin_audit_log', {
      admin: session.u, action, resource, target: target == null ? null : String(target),
      detail, ip: clientIp(req),
    });
  } catch (e) {
    console.error('[audit] gagal mencatat:', e.message);
  }
}

async function probe(url) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return { ok: r.status < 500, status: r.status, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: e.cause?.code || e.message, ms: Date.now() - t0 };
  }
}

const DEFAULT_MAINT = { enabled: false, message: '', starts_at: null, ends_at: null, block: true };

// ---------------------------------------------------------------------------
// Handler API (sudah lolos autentikasi)
// ---------------------------------------------------------------------------
async function api(req, res, url, session) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // buang "api"
  const m = req.method;
  const body = m === 'GET' || m === 'DELETE' ? {} : await readBody(req);
  const q = url.searchParams;

  if (!sb.configured()) throw new HttpError(503, 'SUPABASE_SERVICE_KEY belum diisi di environment server admin');

  if (parts[0] === 'schema' && m === 'GET') return send(res, 200, publicSchema());

  if (parts[0] === 'setup-sql' && m === 'GET') {
    try { return send(res, 200, { sql: await fs.readFile(SETUP_SQL, 'utf8') }); }
    catch { throw new HttpError(404, 'File schema-admin.sql tidak ditemukan di container'); }
  }

  // ---- status sistem (web, relay, supabase, tabel) -----------------------
  if (parts[0] === 'status' && m === 'GET') {
    const t0 = Date.now();
    let supa = { ok: true, ms: 0 };
    try { await sb.count('profiles'); supa.ms = Date.now() - t0; } catch (e) { supa = { ok: false, error: e.message }; }
    const [web, relay] = await Promise.all([probe(`${WEB_URL}/`), probe(`${RELAY_URL}/`)]);
    const tables = {};
    await Promise.all(['app_settings', 'announcements', 'admin_audit_log']
      .map(async (t) => { tables[t] = await sb.tableExists(t); }));
    return send(res, 200, {
      supabase: { ...supa, url: sb.supabaseUrl() }, web: { ...web, url: WEB_URL }, relay: { ...relay, url: RELAY_URL },
      tables, setupDone: Object.values(tables).every(Boolean),
      node: process.version, uptimeSec: Math.round(process.uptime()),
    });
  }

  // ---- dashboard ----------------------------------------------------------
  if (parts[0] === 'dashboard' && m === 'GET') {
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const safe = async (fn, d) => { try { return await fn(); } catch { return d; } };
    const [users, sessions, transcripts, komunikasi, chats, ann, recent, maint, s14] = await Promise.all([
      safe(async () => (await sb.listUsers(1, 1)).total ?? 0, null),
      safe(() => sb.count('bpjs_sessions'), null),
      safe(() => sb.count('bpjs_transcripts'), null),
      safe(() => sb.count('komunikasi_events'), null),
      safe(() => sb.count('chat_messages'), null),
      safe(() => sb.count('announcements', ['active=eq.true']), null),
      safe(() => sb.list('admin_audit_log', { select: 'created_at,admin,action,resource,target', order: 'created_at.desc', limit: 8 }), { rows: [] }),
      safe(async () => (await sb.list('app_settings', { filters: ['key=eq.maintenance'], limit: 1 })).rows[0], null),
      // Aktivitas 14 hari: hanya created_at (metadata), dihitung per hari.
      safe(() => sb.list('bpjs_sessions', { select: 'created_at', filters: [`created_at=gte.${since}`], limit: 5000, order: 'created_at.desc' }), { rows: [] }),
    ]);
    const perDay = {};
    for (let i = 13; i >= 0; i--) perDay[new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)] = 0;
    for (const r of s14.rows) { const d = r.created_at.slice(0, 10); if (d in perDay) perDay[d] += 1; }
    return send(res, 200, {
      counts: { users, sessions, transcripts, komunikasi, chats, announcements: ann },
      sessionsPerDay: perDay, recentAudit: recent.rows, maintenance: maint?.value ?? DEFAULT_MAINT,
    });
  }

  // ---- maintenance ---------------------------------------------------------
  if (parts[0] === 'maintenance') {
    const cur = (await sb.list('app_settings', { filters: ['key=eq.maintenance'], limit: 1 })).rows[0]?.value ?? DEFAULT_MAINT;
    if (m === 'GET') return send(res, 200, cur);
    if (m === 'PUT') {
      const parse = (x) => (x ? new Date(x) : null);
      const s = parse(body.starts_at);
      const e = parse(body.ends_at);
      if ([s, e].some((d) => d && Number.isNaN(d.getTime()))) throw new HttpError(400, 'Tanggal tidak valid');
      const next = {
        enabled: !!body.enabled,
        message: String(body.message || '').slice(0, 500),
        starts_at: s ? s.toISOString() : null,
        ends_at: e ? e.toISOString() : null,
        block: body.block !== false,
        announcement_id: cur.announcement_id || null,
      };
      if (next.starts_at && next.ends_at && next.ends_at <= next.starts_at) throw new HttpError(400, 'Waktu selesai harus setelah waktu mulai');
      if (next.enabled && !next.message) throw new HttpError(400, 'Isi pesan untuk pengguna');

      // Pemberitahuan ke pengguna: satu pengumuman bertipe maintenance yang
      // ikut diperbarui/dinonaktifkan mengikuti status maintenance.
      let announced = false;
      if (body.notify !== false) {
        const annBody = {
          title: next.enabled ? String(body.title || 'Pemeliharaan sistem').slice(0, 120) : 'Pemeliharaan selesai',
          body: next.message,
          kind: 'maintenance',
          starts_at: new Date().toISOString(),
          ends_at: next.ends_at,
          active: next.enabled,
        };
        if (next.announcement_id) {
          try { await sb.update('announcements', 'id', next.announcement_id, annBody); announced = true; }
          catch { next.announcement_id = null; }
        }
        if (!next.announcement_id && next.enabled) {
          next.announcement_id = (await sb.insert('announcements', annBody)).id;
          announced = true;
        }
      }
      await sb.upsert('app_settings', { key: 'maintenance', value: next, is_public: true, updated_at: new Date().toISOString() }, 'key');
      await audit(req, session, next.enabled ? 'maintenance.on' : 'maintenance.off', 'app_settings', 'maintenance',
        { starts_at: next.starts_at, ends_at: next.ends_at, block: next.block, announced });
      return send(res, 200, next);
    }
  }

  // ---- pengguna (GoTrue admin + profiles) ----------------------------------
  if (parts[0] === 'users') {
    const id = parts[1];
    if ('role' in body) throw new HttpError(400, 'Panel ini tidak mengatur peran pengguna');
    if (!id && m === 'GET') {
      const page = Math.max(1, Number(q.get('page')) || 1);
      const raw = await sb.listUsers(page, 25);
      const term = (q.get('search') || '').toLowerCase();
      let users = (raw.users || []).map((u) => ({
        id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
        banned_until: u.banned_until, confirmed: !!u.email_confirmed_at,
        provider: u.app_metadata?.provider || 'email',
      }));
      if (term) users = users.filter((u) => (u.email || '').toLowerCase().includes(term));
      let profiles = [];
      if (users.length) {
        profiles = (await sb.list('profiles', { select: 'id,display_name', filters: [`id=in.(${users.map((u) => u.id).join(',')})`], limit: 100 })).rows;
      }
      const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));
      users.forEach((u) => { u.display_name = byId[u.id]?.display_name || ''; });
      return send(res, 200, { users, total: raw.total ?? users.length, page, perPage: 25 });
    }
    if (!id && m === 'POST') {
      if (!body.email || !body.password) throw new HttpError(400, 'Email dan password wajib');
      if (String(body.password).length < 8) throw new HttpError(400, 'Password minimal 8 karakter');
      const u = await sb.createUser({ email: body.email, password: body.password, email_confirm: true });
      await sb.upsert('profiles', { id: u.id, display_name: body.display_name || body.email.split('@')[0], role: 'general' }, 'id');
      await audit(req, session, 'create', 'users', u.id, { fields: ['email', 'display_name'] });
      return send(res, 201, { id: u.id });
    }
    if (id && m === 'PATCH') {
      const changed = [];
      const gt = {};
      if (body.password) {
        if (String(body.password).length < 8) throw new HttpError(400, 'Password minimal 8 karakter');
        gt.password = body.password; changed.push('password');
      }
      if (body.email) { gt.email = body.email; gt.email_confirm = true; changed.push('email'); }
      if (typeof body.banned === 'boolean') { gt.ban_duration = body.banned ? '876000h' : 'none'; changed.push(body.banned ? 'ban' : 'unban'); }
      if (Object.keys(gt).length) await sb.updateUser(id, gt);
      const prof = {};
      if (body.display_name !== undefined) { prof.display_name = String(body.display_name).slice(0, 80) || 'Pengguna'; changed.push('display_name'); }
      if (Object.keys(prof).length) {
        // PATCH, bukan upsert: tidak menimpa field profil yang tidak diubah.
        const row = await sb.update('profiles', 'id', id, prof);
        if (!row) await sb.insert('profiles', { id, display_name: 'Pengguna', ...prof });
      }
      await audit(req, session, 'update', 'users', id, { fields: changed });
      return send(res, 200, { ok: true });
    }
    if (id && m === 'DELETE') {
      // Menghapus akun ikut menghapus SEMUA datanya (cascade). Wajib ketik email.
      const raw = await sb.listUsers(1, 1000);
      const u = (raw.users || []).find((x) => x.id === id);
      if (!u) throw new HttpError(404, 'Pengguna tidak ditemukan');
      if (q.get('confirm') !== u.email) throw new HttpError(400, 'Ketik email pengguna untuk konfirmasi');
      await sb.deleteUser(id);
      await audit(req, session, 'delete', 'users', id, { email: u.email });
      return send(res, 200, { ok: true });
    }
  }

  // ---- CRUD generik ----------------------------------------------------------
  if (parts[0] === 'r' && RESOURCES[parts[1]]) {
    const name = parts[1];
    const r = RESOURCES[name];
    const id = parts[2];
    if (name === 'profiles' && 'role' in body) throw new HttpError(400, 'Panel ini tidak mengatur peran pengguna');
    if (!id && m === 'GET') {
      const size = Math.min(100, Math.max(5, Number(q.get('size')) || 25));
      const page = Math.max(1, Number(q.get('page')) || 1);
      const filters = [];
      const term = (q.get('search') || '').trim().replace(/[(),*]/g, ' ');
      if (term && r.search.length) filters.push(`or=(${r.search.map((c) => `${c}.ilike.*${term}*`).join(',')})`);
      const out = await sb.list(name, { select: selectList(r), order: r.order, limit: size, offset: (page - 1) * size, filters });
      return send(res, 200, { ...out, page, size });
    }
    if (r.mode !== 'crud') throw new HttpError(403, 'Tabel ini hanya-baca di panel admin (data sensitif)');
    if (!id && m === 'POST') {
      if (r.noCreate) throw new HttpError(405, 'Tidak bisa dibuat dari sini');
      const { data, error } = cleanPayload(r, body, true);
      if (error) throw new HttpError(400, error);
      const row = await sb.insert(name, data);
      await audit(req, session, 'create', name, row?.[r.pk], { fields: Object.keys(data) });
      return send(res, 201, row);
    }
    if (id && m === 'PATCH') {
      const { data, error } = cleanPayload(r, body, false);
      if (error) throw new HttpError(400, error);
      const row = await sb.update(name, r.pk, id, data);
      if (!row) throw new HttpError(404, 'Data tidak ditemukan');
      await audit(req, session, 'update', name, id, { fields: Object.keys(data) });
      return send(res, 200, row);
    }
    if (id && m === 'DELETE') {
      if (r.noDelete) throw new HttpError(405, 'Hapus lewat halaman Pengguna');
      await sb.remove(name, r.pk, id);
      await audit(req, session, 'delete', name, id);
      return send(res, 200, { ok: true });
    }
  }

  throw new HttpError(404, 'Endpoint tidak ditemukan');
}

// ---------------------------------------------------------------------------
async function serveStatic(res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
  try {
    const data = await fs.readFile(file);
    return send(res, 200, data, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  } catch {
    if (path.extname(rel)) return send(res, 404, 'Not found');
    const data = await fs.readFile(path.join(PUBLIC_DIR, 'index.html')); // fallback SPA
    return send(res, 200, data, { 'Content-Type': MIME['.html'] });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/healthz') return send(res, 200, { ok: true });
    if (!url.pathname.startsWith('/api/')) return await serveStatic(res, url.pathname);

    if (!['GET', 'HEAD'].includes(req.method)) {
      // CSRF: SameSite=Strict + header khusus + Origin harus sama dengan Host.
      if (req.headers['x-requested-with'] !== 'aihub-admin') throw new HttpError(403, 'Permintaan ditolak');
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'Origin tidak cocok');
    }

    if (url.pathname === '/api/login' && req.method === 'POST') {
      const ip = clientIp(req);
      if (auth.loginBlocked(ip)) throw new HttpError(429, 'Terlalu banyak percobaan. Coba lagi 10 menit lagi.');
      const { username, password } = await readBody(req);
      const ok = auth.checkCredentials(username ?? '', password ?? '');
      auth.noteLogin(ip, ok);
      if (!ok) {
        await new Promise((r) => setTimeout(r, 600)); // perlambat tebakan
        throw new HttpError(401, 'Username atau password salah');
      }
      if (sb.configured()) await audit(req, { u: username }, 'login', 'session', null);
      const token = auth.issueSession(username);
      return send(res, 200, { ok: true, user: username, token }, { 'Set-Cookie': auth.cookieHeader(token, 8 * 3600) });
    }
    if (url.pathname === '/api/logout' && req.method === 'POST') {
      return send(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieHeader('', 0) });
    }

    const session = auth.readSession(req.headers.cookie, req.headers.authorization);
    // Belum login bukan galat di sini: dipakai UI untuk memilih form login, dan
    // 200 menjaga konsol browser tetap bersih.
    if (url.pathname === '/api/me') return send(res, 200, { user: session ? session.u : null, configured: sb.configured() });
    if (!session) throw new HttpError(401, 'Belum login');

    return await api(req, res, url, session);
  } catch (e) {
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    if (status >= 500) console.error('[admin]', req.method, url.pathname, e.message);
    send(res, status, { error: e.message });
  }
});

if (!process.env.ADMIN_PASSWORD) console.error('[admin] ADMIN_PASSWORD belum diisi — login dinonaktifkan sampai diisi.');
if (!sb.configured()) console.error('[admin] SUPABASE_SERVICE_KEY belum diisi — API data akan menolak permintaan.');
server.listen(PORT, () => console.log(`[admin] panel admin di :${PORT}`));
