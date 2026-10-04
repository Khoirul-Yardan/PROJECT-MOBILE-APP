"""UI smoke check with isolated fixture data; never connects to Supabase.

Run: python web/tests/ui_smoke.py (requires Python Playwright and Chrome).
Screenshots are written to the OS temporary directory.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import tempfile
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1] / 'public'
OUT = Path(tempfile.gettempdir()) / 'ai-hub-ui-preview'
DB = """
export const sb = { auth: {
  getSession: async () => ({ data: {session: location.hash === '#/login' ? null : {user: {id:'test'}}} }),
  onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}})
}};
export const currentUser = async () => ({id:'test', email:'andi@example.test'});
export const myProfile = async () => ({display_name:'Andi Setiawan',role:'perawat'});
export const fetchActivity = async () => [
  {title:'Profil diperbarui',category:'System',created_at:'2026-09-25T10:00:00Z'},
  {title:'Chat dengan asisten AI',category:'AI',created_at:'2026-09-25T09:30:00Z'},
  {title:'Pengaturan provider disimpan',category:'AI',created_at:'2026-09-25T09:00:00Z'}
];
export const fetchFriendships = async () => [];
export const fetchMessages = async () => [];
export const searchProfiles = async () => [];
export const watchActivity = () => () => {};
export const watchFriendships = () => () => {};
export const watchMessages = () => () => {};
export const upsertProfile = async () => {};
export const sendMessage = async () => {};
export const sendFriendRequest = async () => {};
export const respondFriendRequest = async () => {};
export const logActivity = async () => {};
export const signOut = async () => {};
export const signInWithEmail = async () => ({data:{},error:null});
export const signUpWithEmail = signInWithEmail;
export const fetchNurseBpjsSessions = async () => [];
export const fetchBpjsDocument = async () => null;
export const fetchBpjsTranscript = async () => [];
export const markBpjsSessionSent = async () => {};
export const watchBpjsSessions = () => () => {};
"""
CREDENTIALS = """
export const listCredentials = async () => JSON.parse(sessionStorage.getItem('__fixtureProviders') || 'null') || window.__fixtureProviders || [];
export const hasCredential = async () => false;
export const getCredentialKey = async () => 'fixture-key';
export const saveCredential = async () => {};
export const removeCredential = async () => {};
export const updateCredentialModel = async (id, model) => {
  if (window.__failModelSave) throw new Error('Penyimpanan sedang offline.');
  const providers = await listCredentials();
  const entry = providers.find(p => p.id === id);
  if (!entry) throw new Error('Provider tidak ditemukan.');
  entry.model = model;
  sessionStorage.setItem('__fixtureProviders', JSON.stringify(providers));
};
"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    OUT.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    origin = os.environ.get('UI_SMOKE_ORIGIN', f'http://127.0.0.1:{server.server_port}').rstrip('/')
    errors = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='chrome')
            page = browser.new_page(viewport={'width':390, 'height':844}, device_scale_factor=1)
            page.on('pageerror', lambda error: errors.append(str(error)))

            def intercept(route):
                url = route.request.url
                if url.startswith(origin) and url.split('?')[0].endswith('/db.js'):
                    route.fulfill(content_type='text/javascript', body=DB)
                elif url.startswith(origin) and url.split('?')[0].endswith('/credentials.js'):
                    route.fulfill(content_type='text/javascript', body=CREDENTIALS)
                elif url.startswith(origin):
                    route.continue_()
                else:
                    route.fulfill(content_type='text/javascript', body='')

            page.route('**/*', intercept)
            pages = {
                '/login':'.login-page', '/home':'.home-page', '/bots':'.bots-page',
                '/chat':'.chat-page', '/vpn':'.vpn-page',
                '/vpn-config':'.page', '/settings':'.settings-page',
                '/settings/profile':'.profile-page', '/settings/apikeys':'.apikeys-page',
                '/settings/activity':'.activity-page',
                '/settings/add-api-key':'.add-api-page', '/bpjs':'.bpjs-review-page',
            }
            for width in [320, 390, 768, 1280]:
                page.set_viewport_size({'width':width, 'height':844})
                for path, selector in pages.items():
                    page.goto(f'{origin}/#{path}')
                    page.locator(selector).wait_for()
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, path, 'overflow')
                    assert page.locator('.web-nav').is_visible() == (path != '/login')
                    if path == '/bots' and width < 600:
                        for title in page.locator('.agent-card h3').all():
                            assert title.bounding_box()['width'] >= 120, (width, 'bot title squeezed')
                    if path == '/chat':
                        send_box = page.locator('#send').bounding_box()
                        nav_box = page.locator('.web-nav').bounding_box()
                        assert send_box['y'] + send_box['height'] <= 844
                        if width < 1024:
                            assert send_box['y'] + send_box['height'] <= nav_box['y']
                        else:
                            assert nav_box['x'] + nav_box['width'] < send_box['x']
                    if width in [390, 1280]:
                        suffix = '-desktop' if width == 1280 else ''
                        page.screenshot(path=str(OUT / (path.strip('/').replace('/', '-') + suffix + '.png')))
            page.goto(f'{origin}/#/home')
            page.get_by_role('button', name='Bot', exact=True).click()
            page.locator('.bots-page').wait_for()
            assert page.locator('.agent-card').count() == 3
            page.get_by_role('button', name='Segera Bot FAQ', exact=False).click()
            assert page.locator('#detail').inner_text() == 'Bot FAQ belum tersedia.'
            page.locator('#bpjs-review-link').click()
            page.locator('.bpjs-review-page').wait_for()
            for target in ['/settings/apikeys', '/chat', '/bots', '/vpn']:
                page.goto(f'{origin}/#/home')
                page.locator(f'.module-card[data-go="{target}"]').click()
                page.wait_for_url(f'**/#{target}')
            page.goto(f'{origin}/#/chat')
            page.get_by_role('button', name='Cari ide').click()
            assert page.locator('#input').input_value() == 'Bantu saya mencari ide untuk '
            page.locator('#manage-provider').click()
            page.locator('.apikeys-page').wait_for()
            page.goto(f'{origin}/#/settings/activity')
            page.get_by_role('button', name='VPN', exact=True).first.click()
            assert page.locator('.activity-timeline .empty-state').count() == 1
            page.get_by_role('button', name='Semua', exact=True).click()
            assert page.locator('.activity-timeline > .card').count() == 3
            # Realistic populated states: long provider labels and local chat commands.
            page.add_init_script('''window.__fixtureProviders = [{
                id: 'fixture', label: 'Asisten Dokumentasi dan Produktivitas',
                type: 'chat', model: 'model-contoh', format: 'openai'
            }];''')
            page.reload()
            for width in [320, 390, 1280]:
                page.set_viewport_size({'width': width, 'height': 844})
                page.goto(f'{origin}/#/settings/apikeys')
                page.locator('.provider-entry').wait_for()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.goto(f'{origin}/#/chat')
                page.locator('#input').fill('/help')
                page.locator('#send').click()
                assert 'Perintah tersedia' in page.locator('#messages').inner_text()
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.goto(f'{origin}/#/login')
            page.locator('#toggle').click()
            assert page.locator('#password').get_attribute('autocomplete') == 'new-password'
            page.locator('#submit').click()
            assert page.locator('#error').is_visible()
            # Navigation is web-owned in both browser and Flutter WebView.
            page.add_init_script('''window.NativeBridge = {postMessage(raw) {
                const message = JSON.parse(raw);
                window.__bridgeCalls = [...(window.__bridgeCalls || []), message.type];
                if (message.id) queueMicrotask(() => window.__nativeReply(message.id, '{}'));
            }};''')
            page.goto(f'{origin}/#/login')
            page.reload()
            page.locator('.login-page').wait_for()
            assert not page.locator('.web-nav').is_visible()
            page.goto(f'{origin}/#/bots')
            assert page.locator('.web-nav').count() == 1
            assert page.locator('.web-nav').is_visible()
            page.get_by_role('button', name='Aktif Bot BPJS', exact=False).click()
            assert page.evaluate("window.__bridgeCalls.includes('open_bot_bpjs')")
            assert not errors, errors
            browser.close()
            print('PASS: 12 routes x 4 widths, card navigation, chat prompts, activity filters, bot availability, login validation, embedded navigation and BPJS bridge.')
            print(f'Fixture screenshots: {OUT}')
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
