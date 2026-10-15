"""E2E "Login dengan akun" (OAuth PKCE OpenRouter) di layar Hubungkan Provider AI.

openrouter.ai DITIRU (halaman login + endpoint tukar kode) karena login akun
asli butuh kredensial pengguna; yang diuji adalah sisi aplikasi: tombol,
parameter PKCE, penukaran kode -> kunci, penyimpanan, dan jalur gagal.
Screenshot -> Images/UjiTest/.

Run (server statis dulu):
  python -m http.server 8091 --directory web/public
  E2E_ORIGIN=http://localhost:8091 python web/tests/e2e_oauth.py
"""
from pathlib import Path
import base64, hashlib, json, os, sys
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
import e2e_docker as e
from e2e_docker import DB, HISTORY, SHOTS, check

ORIGIN = os.environ.get('E2E_ORIGIN', 'http://localhost:8091')

# Fixture kredensial yang bertahan antar-navigasi (localStorage), karena alur
# OAuth meninggalkan halaman lalu kembali.
CREDS = """
const P = () => JSON.parse(localStorage.getItem('fx.providers') || '[]');
export const listCredentials = async () => P();
export const listCredentialSlots = async () => P();
export const hasCredential = async () => P().length > 0;
export const countCredentialSlots = async (id) => P().filter(p => p.id === id).length;
export const getCredentialKey = async () => localStorage.getItem('fx.key');
export const getCredentialKeySlots = async () => [{ id: 's1', label: 'k', apiKey: localStorage.getItem('fx.key') }];
export const saveCredential = async (entry, key) => {
  localStorage.setItem('fx.providers', JSON.stringify([...P(), entry]));
  localStorage.setItem('fx.key', key);
};
export const removeCredential = async () => {};
export const removeCredentialSlot = async () => {};
export const updateCredentialModel = async () => {};
"""

LOGIN_PAGE = """<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<body style="font-family:system-ui;background:#0f0f14;color:#fff;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center;padding:24px;border:1px solid #333;border-radius:16px;max-width:320px">
<div style="font-size:12px;color:#f5a623;margin-bottom:8px">HALAMAN LOGIN OPENROUTER (SIMULASI UNTUK TES)</div>
<h2 style="margin:0 0 8px">Authorize AI Hub</h2>
<p style="color:#aaa;font-size:14px">AI Hub meminta izin membuat API key atas nama akunmu.</p>
<button style="padding:12px 24px;border-radius:10px;border:0;background:#6366f1;color:#fff;font-size:16px">Authorize</button>
</div></body>"""


def make_page(browser, exchange_status=200):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    page = ctx.new_page()
    log = {'auth_url': None, 'exchange': None}
    errors = []
    page.on('pageerror', lambda x: errors.append(str(x)))

    def intercept(route):
        url = route.request.url
        path = url.split('?')[0]
        if url.startswith(ORIGIN):
            if path.endswith('/db.js'):
                return route.fulfill(content_type='text/javascript', body=DB)
            if path.endswith('/credentials.js'):
                return route.fulfill(content_type='text/javascript', body=CREDS)
            if path.endswith('/chat-history.js'):
                return route.fulfill(content_type='text/javascript', body=HISTORY)
            return route.continue_()
        if url.startswith('https://openrouter.ai/auth?') or url.startswith('https://openrouter.ai/auth/?'):
            log['auth_url'] = url
            return route.fulfill(content_type='text/html', body=LOGIN_PAGE)
        if 'openrouter.ai/api/v1/auth/keys' in url:
            if route.request.method == 'OPTIONS':
                return route.fulfill(status=204, headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*'})
            log['exchange'] = json.loads(route.request.post_data or '{}')
            body = {'key': 'sk-or-v1-' + 'a' * 40} if exchange_status == 200 else {'error': {'message': 'Kode tidak valid atau kedaluwarsa'}}
            return route.fulfill(status=exchange_status, content_type='application/json',
                                 headers={'access-control-allow-origin': '*'}, body=json.dumps(body))
        return route.fulfill(content_type='text/javascript', body='')  # CDN dll.
    page.route('**/*', intercept)
    return ctx, page, log, errors


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome')

        # 1. Tombol login akun tampil di layar Hubungkan Provider AI
        ctx, page, log, errs = make_page(browser)
        page.goto(f'{ORIGIN}/#/settings/add-api-key')
        page.locator('.add-api-page').wait_for()
        page.wait_for_timeout(500)
        page.screenshot(path=str(SHOTS / '40-oauth-pilihan-login-akun-atau-api-key.png'))
        btn = page.locator('[data-oauth="openrouter"]')
        check('OAuth: tombol "Login dengan akun OpenRouter" tampil', btn.is_visible())
        check('OAuth: opsi API key manual tetap ada', page.locator('#key-input').is_visible())
        check('OAuth: hanya provider ber-OAuth yang punya tombol login', page.locator('[data-oauth]').count() == 1)

        # 2. Klik -> pindah ke openrouter.ai/auth dengan parameter PKCE yang benar
        btn.click()
        page.wait_for_url('https://openrouter.ai/auth*')
        page.wait_for_timeout(300)
        page.screenshot(path=str(SHOTS / '41-oauth-halaman-login-openrouter-SIMULASI.png'))
        q = parse_qs(urlparse(log['auth_url']).query)
        check('OAuth: callback_url = origin aplikasi', q.get('callback_url') == [ORIGIN + '/'], str(q.get('callback_url')))
        check('OAuth: code_challenge_method = S256', q.get('code_challenge_method') == ['S256'])
        challenge = q['code_challenge'][0]
        verifier = page.evaluate("localStorage.getItem('aihub.oauth.openrouter.verifier')") if False else None

        # 3. OpenRouter mengembalikan ?code= -> aplikasi menukar & menyimpan kunci
        page.goto(f'{ORIGIN}/?code=KODE-UJI-123#/settings/add-api-key')
        page.wait_for_function("localStorage.getItem('fx.providers')", timeout=15000)
        page.wait_for_timeout(600)
        page.screenshot(path=str(SHOTS / '42-oauth-kembali-terhubung-toast.png'))
        saved = json.loads(page.evaluate("localStorage.getItem('fx.providers')"))
        check('OAuth: OpenRouter tersimpan lewat login akun', saved and saved[0]['id'] == 'openrouter', str(saved)[:120])
        check('OAuth: kunci hasil tukar tersimpan', (page.evaluate("localStorage.getItem('fx.key')") or '').startswith('sk-or-v1-'))
        check('OAuth: kode dikirim ke endpoint tukar', log['exchange'] and log['exchange']['code'] == 'KODE-UJI-123', str(log['exchange'])[:100])
        ver = (log['exchange'] or {}).get('code_verifier', '')
        calc = base64.urlsafe_b64encode(hashlib.sha256(ver.encode()).digest()).decode().rstrip('=')
        check('OAuth: code_verifier cocok dengan code_challenge (PKCE)', bool(ver) and calc == challenge)
        check('OAuth: ?code= dibersihkan dari URL', 'code=' not in page.url, page.url)
        check('OAuth: tidak ada JS error', not errs, str(errs))
        ctx.close()

        # 4. Jalur gagal: OpenRouter menolak kode -> pesan jelas, tidak ada yang tersimpan
        ctx, page, log, errs = make_page(browser, exchange_status=400)
        page.goto(f'{ORIGIN}/#/settings/add-api-key')
        page.locator('[data-oauth="openrouter"]').click()
        page.wait_for_url('https://openrouter.ai/auth*')
        page.goto(f'{ORIGIN}/?code=KODE-KEDALUWARSA#/settings/add-api-key')
        page.wait_for_function("document.getElementById('toast')", timeout=15000)
        page.wait_for_timeout(500)
        toast = page.locator('#toast').inner_text()
        page.screenshot(path=str(SHOTS / '43-oauth-gagal-kode-ditolak.png'))
        check('OAuth gagal: pesan error ditampilkan', 'gagal' in toast.lower() and 'kedaluwarsa' in toast.lower(), toast)
        check('OAuth gagal: tidak ada kunci tersimpan', page.evaluate("localStorage.getItem('fx.providers')") is None)
        ctx.close()

        # 5. ?code= tanpa permintaan login dari aplikasi diabaikan (tak ada verifier)
        ctx, page, log, errs = make_page(browser)
        page.goto(f'{ORIGIN}/?code=ASING#/home')
        page.wait_for_timeout(1500)
        check('OAuth: ?code= asing diabaikan (tak ada tukar kode)', log['exchange'] is None)
        ctx.close()
        browser.close()

    fails = [r for r in e.results if not r[1]]
    print(f'\n{len(e.results) - len(fails)}/{len(e.results)} lulus')
    (SHOTS / 'hasil-oauth.json').write_text(json.dumps(e.results, ensure_ascii=False, indent=1), encoding='utf-8')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
