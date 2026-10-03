"""UI smoke check with isolated fixture data; never connects to Supabase.

Run: python web/tests/ui_smoke.py (requires Python Playwright and Chrome).
Screenshots are written to the OS temporary directory.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
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
"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    OUT.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
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
                elif url.startswith(origin):
                    route.continue_()
                else:
                    route.fulfill(content_type='text/javascript', body='')

            page.route('**/*', intercept)
            pages = {
                '/login':'.login-page', '/home':'.home-page', '/bots':'.bots-page',
                '/chat':'.chat-page', '/friends':'.friends-page', '/vpn':'.vpn-page',
                '/vpn-config':'.page', '/settings':'.settings-page',
                '/settings/profile':'.profile-page', '/settings/apikeys':'.apikeys-page',
                '/settings/activity':'.activity-page',
            }
            for width in [320, 390, 768]:
                page.set_viewport_size({'width':width, 'height':844})
                for path, selector in pages.items():
                    page.goto(f'{origin}/#{path}')
                    page.locator(selector).wait_for()
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, path, 'overflow')
                    assert page.locator('.web-nav').is_visible() == (path != '/login')
                    if path == '/chat':
                        assert page.locator('#send').bounding_box()['y'] + 48 <= page.locator('.web-nav').bounding_box()['y']
                    if width == 390:
                        page.screenshot(path=str(OUT / (path.strip('/').replace('/', '-') + '.png')), full_page=True)
            page.goto(f'{origin}/#/home')
            page.get_by_role('button', name='Agents', exact=True).click()
            page.locator('.bots-page').wait_for()
            page.locator('#search').fill('no matching agent')
            assert page.locator('.agent-card').count() == 0
            page.locator('#search').fill('Code')
            assert page.locator('.agent-card').count() == 1
            page.locator('#search').fill('')
            assert page.locator('.agent-card').count() == 8
            page.get_by_role('button', name='Friends', exact=True).click()
            page.locator('.friends-page').wait_for()
            assert page.locator('.web-nav [aria-current="page"]').inner_text() == 'Friends'
            page.goto(f'{origin}/#/login')
            page.locator('#toggle').click()
            assert page.locator('#password').get_attribute('autocomplete') == 'new-password'
            page.locator('#submit').click()
            assert page.locator('#error').is_visible()
            # Embedded mode must leave navigation to Flutter.
            page.add_init_script('window.NativeBridge = {postMessage() {}};')
            page.goto(f'{origin}/#/login')
            page.reload()
            page.locator('.login-page').wait_for()
            assert page.locator('.web-nav').count() == 0
            assert not errors, errors
            browser.close()
            print('PASS: 11 routes x 3 widths, navigation, agent filtering, login validation, native nav exclusion.')
            print(f'Fixture screenshots: {OUT}')
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
