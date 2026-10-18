"""Admin regression check against an isolated, fictional Supabase fixture.

Run: python web/tests/admin_smoke.py (Node, Python Playwright, Chrome).
No real credentials or database connections are used.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, build_opener, HTTPCookieProcessor
from urllib.error import HTTPError, URLError
import json
import os
import socket
import subprocess
import time

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
USER = {'id': 'fixture-user', 'email': 'contoh@example.test',
        'email_confirmed_at': '2026-10-18T00:00:00Z',
        'created_at': '2026-10-18T00:00:00Z', 'app_metadata': {'provider': 'email'}}
PROFILE = {'id': USER['id'], 'display_name': 'Pengguna Contoh', 'role': 'perawat',
           'bio': '', 'created_at': USER['created_at']}
CALLS = []


class Fixture(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def handle_request(self):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        payload = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or '{}')
        CALLS.append((self.command, parsed.path, query, payload))
        result = []
        if parsed.path == '/auth/v1/admin/users':
            result = {'users': [USER]} if self.command == 'GET' else {'id': 'new-fixture-user', 'email': payload['email']}
        elif parsed.path.startswith('/auth/v1/admin/users/'):
            result = USER
        elif parsed.path.startswith('/rest/v1/'):
            table = parsed.path.rsplit('/', 1)[1]
            if self.command in ('GET', 'HEAD'):
                rows = [PROFILE.copy()] if table == 'profiles' else []
                if table == 'bpjs_sessions':
                    rows = [{'id': 'fixture-session', 'perawat_id': USER['id'], 'status': 'draft',
                             'created_at': USER['created_at'], 'updated_at': USER['created_at'],
                             'patient_name': 'PRIVATE_FIXTURE_VALUE'}]
                columns = query.get('select', ['*'])[0]
                result = rows if columns == '*' else [{k: row[k] for k in columns.split(',') if k in row} for row in rows]
            else:
                result = [{'id': payload.get('id', 'fixture-row'), **payload}]
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Range', f'0-0/{len(result) if isinstance(result, list) else 1}')
        self.send_header('X-Total-Count', '1')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(json.dumps(result).encode())

    do_HEAD = do_GET = do_POST = do_PATCH = do_PUT = do_DELETE = handle_request


def main():
    upstream = ThreadingHTTPServer(('127.0.0.1', 0), Fixture)
    Thread(target=upstream.serve_forever, daemon=True).start()
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    origin = f'http://127.0.0.1:{port}'
    fake_url = f'http://127.0.0.1:{upstream.server_port}'
    password = 'fixture-password-only'
    env = {**os.environ, 'PORT': str(port), 'SUPABASE_URL': fake_url,
           'SUPABASE_SERVICE_KEY': 'sb_secret_fixture_never_real',
           'ADMIN_USER': 'fixture-admin', 'ADMIN_PASSWORD': password,
           'SESSION_SECRET': 'fixture-session-secret-never-real',
           'COOKIE_SECURE': 'false', 'TRUST_PROXY': 'false',
           'WEB_URL': fake_url, 'RELAY_URL': fake_url,
           'SETUP_SQL_PATH': str(ROOT / 'app/supabase/schema-admin.sql')}
    proc = subprocess.Popen(['node', 'admin/server.js'], cwd=ROOT, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    client = build_opener(HTTPCookieProcessor())

    def api(path, method='GET', body=None):
        request = Request(origin + path, method=method,
                          data=None if body is None else json.dumps(body).encode(),
                          headers={'Content-Type': 'application/json', 'X-Requested-With': 'aihub-admin'})
        try:
            with client.open(request, timeout=5) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    try:
        for _ in range(100):
            if proc.poll() is not None:
                raise AssertionError('Fixture admin server exited early')
            try:
                if api('/healthz')[0] == 200:
                    break
            except URLError:
                time.sleep(.05)
        else:
            raise AssertionError('Fixture admin server did not start')

        assert api('/api/schema')[0] == 401
        assert api('/api/login', 'POST', {'username': 'fixture-admin', 'password': password})[0] == 200
        schema = api('/api/schema')[1]
        for name in ('remote_bots', 'remote_providers', 'app_settings'):
            assert name not in schema
            for method, suffix in [('GET', ''), ('POST', ''), ('PATCH', '/fixture'), ('DELETE', '/fixture')]:
                assert api(f'/api/r/{name}{suffix}', method, {} if method in ('POST', 'PATCH') else None)[0] == 404
        assert 'role' not in schema['profiles']['list']
        assert all(col['name'] != 'role' for col in schema['profiles']['columns'])
        assert 'role' not in api('/api/r/profiles')[1]['rows'][0]
        assert 'role' not in api('/api/users')[1]['users'][0]

        for path, method in [('/api/users', 'POST'), ('/api/users/fixture-user', 'PATCH'), ('/api/r/profiles/fixture-user', 'PATCH')]:
            before = len(CALLS)
            assert api(path, method, {'role': 'dokter', 'display_name': 'Ignored'})[0] == 400
            assert len(CALLS) == before, 'Rejected role change must not reach Supabase'
        assert api('/api/users', 'POST', {'email': 'baru@example.test', 'password': password})[0] == 201
        created = [call for call in CALLS if call[0] == 'POST' and call[1] == '/rest/v1/profiles'][-1]
        assert created[3]['role'] == 'general'
        assert api('/api/users/fixture-user', 'PATCH', {'display_name': 'Nama Baru'})[0] == 200
        updated = [call for call in CALLS if call[0] == 'PATCH' and call[1] == '/rest/v1/profiles'][-1]
        assert updated[3] == {'display_name': 'Nama Baru'}
        assert 'PRIVATE_FIXTURE_VALUE' not in json.dumps(api('/api/r/bpjs_sessions')[1])
        assert api('/api/r/bpjs_sessions/fixture', 'PATCH', {'status': 'sent'})[0] == 403
        counts = api('/api/dashboard')[1]['counts']
        assert counts['sessions'] == 1
        assert not any(call[0] == 'GET' and call[1] in ('/rest/v1/bpjs_sessions', '/rest/v1/bpjs_transcripts', '/rest/v1/komunikasi_events', '/rest/v1/chat_messages') and call[2].get('select') == ['*'] for call in CALLS)
        assert 'bots' not in counts and 'providers' not in counts
        assert api('/api/status')[1]['setupDone'] is True
        assert not any(call[1] in ('/rest/v1/remote_bots', '/rest/v1/remote_providers') for call in CALLS)
        print('PASS API: removed catalogs, general accounts, rejected role writes, metadata restrictions')

        with sync_playwright() as p:
            browser = p.chromium.launch(channel='chrome')
            context = browser.new_context(viewport={'width': 1440, 'height': 1000})
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(origin + '/') else route.abort())
            page.goto(origin)
            expect(page.get_by_text('Masuk untuk memeriksa database', exact=False)).to_be_visible()
            page.locator('#u').fill('fixture-admin')
            page.locator('#p').fill(password)
            page.get_by_role('button', name='Masuk', exact=True).click()
            expect(page.get_by_role('heading', name='Dashboard', exact=True)).to_be_visible()
            expect(page.locator('#menu')).to_be_hidden()
            expect(page.locator('.nav')).to_be_visible()
            expect(page.get_by_text('Katalog sistem', exact=True)).to_have_count(0)
            expect(page.get_by_text('Bot tambahan aktif', exact=True)).to_have_count(0)
            for name in ('Bot', 'Provider AI', 'Pengaturan', 'Profil & peran'):
                expect(page.get_by_role('link', name=name, exact=True)).to_have_count(0)
            page.get_by_role('link', name='Akun pengguna', exact=True).click()
            expect(page.get_by_role('cell', name='Pengguna Contoh', exact=True)).to_be_visible()
            expect(page.get_by_role('columnheader', name='Peran', exact=True)).to_have_count(0)
            page.get_by_role('button', name='Tambah pengguna', exact=True).click()
            expect(page.locator('.modal #role')).to_have_count(0)
            page.locator('.modal #email').fill('browser@example.test')
            page.locator('.modal #pw').fill(password)
            page.locator('.modal #dn').fill('Pengguna Browser')
            page.get_by_role('button', name='Buat akun', exact=True).click()
            expect(page.locator('.modal')).to_have_count(0)
            page.get_by_role('button', name='Kelola', exact=True).click()
            expect(page.locator('.modal #role')).to_have_count(0)
            page.locator('.modal #dn').fill('Nama Browser')
            page.get_by_role('button', name='Simpan', exact=True).click()
            expect(page.locator('.modal')).to_have_count(0)
            page.get_by_role('link', name='Profil pengguna', exact=True).click()
            expect(page.get_by_role('cell', name='Pengguna Contoh', exact=True)).to_be_visible()
            expect(page.get_by_role('columnheader', name='role', exact=True)).to_have_count(0)
            page.get_by_role('button', name='Ubah', exact=True).click()
            expect(page.locator('#f-role')).to_have_count(0)
            page.get_by_role('button', name='Batal', exact=True).click()

            page.set_viewport_size({'width': 390, 'height': 844})
            expect(page.locator('#menu')).to_be_visible()
            assert page.locator('#sidebar').evaluate('(el) => el.inert')
            page.locator('#menu').click()
            expect(page.locator('#menu')).to_have_attribute('aria-expanded', 'true')
            page.get_by_role('link', name='Sesi Bot BPJS', exact=True).click()
            expect(page.get_by_role('heading', name='Sesi Bot BPJS', exact=True)).to_be_visible()
            expect(page.locator('#menu')).to_have_attribute('aria-expanded', 'false')
            expect(page.get_by_text('Hanya metadata, hanya baca.', exact=True)).to_be_visible()
            expect(page.get_by_role('button', name='Ubah', exact=True)).to_have_count(0)
            page.locator('#menu').click()
            page.get_by_role('button', name='Tutup menu', exact=True).first.click()
            expect(page.locator('#menu')).to_have_attribute('aria-expanded', 'false')
            page.locator('#menu').click()
            page.keyboard.press('Escape')
            expect(page.locator('#menu')).to_be_focused()
            page.locator('#menu').click()
            page.locator('#menu-backdrop').click(position={'x': 350, 'y': 400})
            expect(page.locator('#menu')).to_have_attribute('aria-expanded', 'false')
            page.set_viewport_size({'width': 1440, 'height': 1000})
            expect(page.locator('#menu')).to_be_hidden()
            assert not page.locator('#sidebar').evaluate('(el) => el.inert')
            for resource in ('remote_bots', 'remote_providers', 'app_settings'):
                page.goto(origin + '/#/r/' + resource)
                expect(page.get_by_text('Tabel tidak dikenal.', exact=True)).to_be_visible()
            assert not errors, errors
            browser.close()
        print('PASS browser: desktop/mobile menu, account forms, profiles, metadata, removed deep links')
    finally:
        proc.terminate()
        proc.wait(timeout=10)
        upstream.shutdown()
        upstream.server_close()


if __name__ == '__main__':
    main()
