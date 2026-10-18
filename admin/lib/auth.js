// Login admin: satu akun dari environment (ADMIN_USER / ADMIN_PASSWORD).
// Sesi = cookie bertanda tangan HMAC (HttpOnly, SameSite=Strict). Tanpa
// database sesi; ganti SESSION_SECRET untuk memaksa semua admin keluar.
import crypto from 'node:crypto';

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TTL_MS = 8 * 3600 * 1000;
export const COOKIE = 'aihub_admin';

const sign = (payload) => crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkCredentials(user, password) {
  const u = process.env.ADMIN_USER || 'admin';
  const p = process.env.ADMIN_PASSWORD || '';
  if (!p) return false; // tidak pernah menerima password kosong
  // Hitung keduanya agar waktu respons tidak membocorkan mana yang salah.
  const okU = safeEqual(user, u);
  const okP = safeEqual(password, p);
  return okU && okP;
}

export function issueSession(user) {
  const payload = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verify(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return s.exp > Date.now() ? s : null;
  } catch { return null; }
}

/** Sesi dari cookie, atau dari header Authorization: Bearer (cadangan bila
 * browser menolak cookie). Token yang sama, tanda tangan yang sama. */
export function readSession(cookieHeader, authHeader) {
  const m = new RegExp(`(?:^|;\s*)${COOKIE}=([^;]+)`).exec(cookieHeader || '');
  const fromCookie = m ? verify(m[1]) : null;
  if (fromCookie) return fromCookie;
  const b = /^Bearer (.+)$/.exec(authHeader || '');
  return b ? verify(b[1]) : null;
}

export function cookieHeader(value, maxAgeSec) {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure}`;
}

// Pembatas percobaan login per IP: 8 gagal / 10 menit.
const fails = new Map();
export function loginBlocked(ip) {
  const e = fails.get(ip);
  return !!e && e.count >= 8 && Date.now() - e.first < 600000;
}
export function noteLogin(ip, ok) {
  if (ok) return fails.delete(ip);
  const e = fails.get(ip);
  if (!e || Date.now() - e.first > 600000) fails.set(ip, { count: 1, first: Date.now() });
  else e.count += 1;
}
