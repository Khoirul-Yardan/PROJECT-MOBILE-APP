"""Read-only production/admin smoke in desktop Chrome.

python web/tests/admin_live.py
For the physical Android phone use: node web/tests/admin_phone.mjs
Credentials are read in memory from web/.env; no credentials, rows, or screenshots
are logged. Login creates the normal audit event; no other writes are performed.
"""
import argparse
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]


def login_credentials():
    values = {}
    for line in (ROOT / 'web/.env').read_text(encoding='utf-8-sig').splitlines():
        key, sep, value = line.partition('=')
        if sep and key.strip() in ('ADMIN_USER', 'ADMIN_PASSWORD'):
            value = value.strip()
            if value[:1] in ('"', "'") and value[-1:] == value[:1]:
                value = value[1:-1]
            values[key.strip()] = value
    if not values.get('ADMIN_PASSWORD'):
        raise RuntimeError('ADMIN_PASSWORD belum tersedia di web/.env')
    return values.get('ADMIN_USER', 'admin'), values['ADMIN_PASSWORD']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--origin', default='https://ai-hub-admin.fly.dev')
    args = parser.parse_args()
    origin = args.origin.rstrip('/')
    if origin not in ('https://ai-hub-admin.fly.dev', 'http://127.0.0.1:8095'):
        raise SystemExit('Origin harus merupakan deployment admin yang ditetapkan.')
    failures = []

    def check(label, valid):
        print(('PASS ' if valid else 'FAIL ') + label, flush=True)
        if not valid:
            failures.append(label)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome')
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        page = next((tab for tab in context.pages if urlparse(tab.url).netloc == urlparse(origin).netloc), None)
        page = page or context.new_page()
        page.bring_to_front()
        errors = []
        page.on('pageerror', lambda _error: errors.append(True))
        page.set_default_timeout(20000)
        page.goto(origin, wait_until='domcontentloaded', timeout=60000)
        page.locator('#u, .shell').first.wait_for(state='visible')
        if page.locator('#u').count():
            username, password = login_credentials()
            page.locator('#u').fill(username)
            page.locator('#p').fill(password)
            with page.expect_response(lambda r: urlparse(r.url).path == '/api/login') as response:
                page.get_by_role('button', name='Masuk', exact=True).click()
            check('login HTTPS', response.value.status == 200)
            del username, password
        expect(page.locator('.shell')).to_be_visible()
        check('katalog lama tidak tampil', page.locator('.nav a[href="#/r/remote_bots"], .nav a[href="#/r/remote_providers"], .nav a[href="#/r/app_settings"]').count() == 0)
        cookies = [cookie for cookie in context.cookies(origin) if cookie['name'] == 'aihub_admin']
        check('cookie HttpOnly, Secure, SameSite Strict', bool(cookies) and all(c['httpOnly'] and c['sameSite'] == 'Strict' and (c['secure'] or not origin.startswith('https:')) for c in cookies))
        del cookies

        # Sesudah login, semua tindakan tes berikutnya hanya membaca.
        def read_only(route):
            if route.request.method in ('GET', 'HEAD', 'OPTIONS'):
                route.continue_()
            else:
                failures.append('unexpected write blocked')
                route.abort()

        page.route(origin + '/api/**', read_only)
        try:
            schema_res = context.request.get(origin + '/api/schema')
            check('schema API', schema_res.status == 200)
            schema = schema_res.json()
            check('schema profil tanpa peran', 'role' not in schema['profiles']['list'] and all(c['name'] != 'role' for c in schema['profiles']['columns']))
            for name in ('remote_bots', 'remote_providers', 'app_settings'):
                response = context.request.get(origin + '/api/r/' + name)
                check('katalog dinonaktifkan: ' + name, response.status == 404)
            dashboard = context.request.get(origin + '/api/dashboard')
            check('dashboard API', dashboard.status == 200)
            if dashboard.status == 200:
                check('jumlah database tersedia', all(value is not None for value in dashboard.json()['counts'].values()))
            status = context.request.get(origin + '/api/status', timeout=60000)
            check('status API', status.status == 200)
            if status.status == 200:
                data = status.json()
                for component in ('supabase', 'web', 'relay'):
                    check('koneksi ' + component, data[component]['ok'])
                for table, available in data['tables'].items():
                    check('tabel tersedia: ' + table, available)
            sql = context.request.get(origin + '/api/setup-sql')
            check('sumber SQL terkemas', sql.status == 200 and 'create table' in sql.json().get('sql', '').lower())

            navigation = page.locator('.nav a').evaluate_all('(links) => links.map(a => ({href: a.getAttribute("href"), label: a.textContent.trim()}))')
            page.goto(origin + '/#/system', wait_until='domcontentloaded')
            expect(page.get_by_role('heading', name='Status & Setup', exact=True)).to_be_visible()
            for item in navigation:
                if page.locator('#menu').is_visible():
                    page.locator('#menu').click()
                    expect(page.locator('#menu')).to_have_attribute('aria-expanded', 'true')
                endpoint = '/api/' + item['href'].removeprefix('#/')
                if endpoint == '/api/system':
                    endpoint = '/api/status'
                try:
                    with page.expect_response(lambda response: urlparse(response.url).path == endpoint, timeout=60000) as loaded:
                        page.locator('.nav a[href="' + item['href'] + '"]').click()
                    check('halaman ' + item['label'], loaded.value.status == 200)
                    expect(page.locator('#view h1')).to_be_visible()
                    check('lebar layar ' + item['label'], page.evaluate('() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1'))
                    if page.locator('#menu').is_visible():
                        expect(page.locator('#menu')).to_have_attribute('aria-expanded', 'false')
                    if item['href'] == '#/users':
                        check('tabel akun tanpa peran', page.get_by_role('columnheader', name='Peran', exact=True).count() == 0)
                        page.get_by_role('button', name='Tambah pengguna', exact=True).click()
                        check('form akun tanpa peran', page.locator('.modal #role').count() == 0)
                        page.get_by_role('button', name='Batal', exact=True).click()
                except Exception as error:
                    check('navigasi ' + item['label'] + ' (' + type(error).__name__ + ')', False)
            check('tidak ada galat JavaScript', not errors)
            page.goto(origin + '/#/dashboard', wait_until='domcontentloaded')
        finally:
            page.unroute(origin + '/api/**', read_only)
            browser.close()
    if failures:
        raise SystemExit(f'{len(failures)} pemeriksaan gagal; isi data tidak dicetak.')


if __name__ == '__main__':
    main()
