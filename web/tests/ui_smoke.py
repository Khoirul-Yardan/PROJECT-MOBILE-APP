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
export const fetchNurseBpjsSessions = async () => [{id:'session-test', pasien_nama:'Pasien <uji>', dokter_nama:'Dokter Uji', created_at:'2026-10-02T08:00:00Z', status:'terkirim'}];
export const fetchBpjsDocument = async () => ({dokumentasi_terstruktur:{ringkasan:'Transkrip uji <aman>'},generated_by_llm_provider:null});
export const fetchBpjsTranscript = async () => [{text_segment:'Percakapan <uji>',speaker:'perawat'}];
export const watchBpjsSessions = () => () => {};
"""

AI = """
export const listRegisteredProviders = async () => {
  if (window.failProviders) throw new Error('offline');
  return window.emptyProviders ? [] : [{id:'test-ai',label:'Layanan Uji',type:'chat',model:'model-uji'},{id:'agent-test',label:'Agent Uji',type:'agent'}];
};
export const sendChat = async (entry, history) => {
  window.chatRequests = (window.chatRequests || 0) + 1;
  await new Promise(r => setTimeout(r, 500));
  if (window.failChat) throw new Error('offline');
  return 'Jawaban ' + entry.label + ': ' + history.at(-1).text;
};
export const removeProvider = async () => {};
export const saveProvider = async () => { window.savedProviders = (window.savedProviders || 0) + 1; };
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
                elif url.startswith(origin) and url.split('?')[0].endswith('/ai.js'):
                    route.fulfill(content_type='text/javascript', body=AI)
                elif url.startswith(origin):
                    route.continue_()
                else:
                    route.fulfill(content_type='text/javascript', body='')

            page.route('**/*', intercept)
            pages = {
                '/login':'.login-page', '/home':'.home-page', '/bots':'.bots-page',
                '/chat':'.chat-page', '/bpjs':'.bpjs-review-page', '/vpn':'.vpn-page',
                '/vpn-config':'.page', '/settings':'.settings-page',
                '/settings/profile':'.profile-page', '/settings/apikeys':'.apikeys-page',
                '/settings/activity':'.activity-page',
                '/settings/add-api-key?type=provider':'.add-api-page',
            }
            for width in [320, 360, 390, 768, 1024]:
                page.set_viewport_size({'width':width, 'height':844})
                for path, selector in pages.items():
                    page.goto(f'{origin}/#{path}')
                    page.locator(selector).wait_for()
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, path, 'overflow')
                    assert page.locator('.web-nav').is_visible() == (path != '/login')
                    if path == '/chat' and width < 840:
                        assert page.locator('#send').bounding_box()['y'] + 48 <= page.locator('.web-nav').bounding_box()['y']
                    if width == 390:
                        page.screenshot(path=str(OUT / (path.split('?')[0].strip('/').replace('/', '-') + '.png')), full_page=True)
            page.goto(f'{origin}/#/home')
            page.get_by_role('button', name='Bot', exact=True).click()
            page.locator('.bots-page').wait_for()
            assert page.locator('#start').is_disabled()
            page.locator('#history').click()
            page.locator('.bpjs-review-page').wait_for()
            assert page.locator('.web-nav [aria-current="page"]').inner_text() == 'Bot'
            page.locator('#search').fill('missing')
            assert page.locator('.list-row').count() == 0
            page.locator('#search').fill('Pasien')
            page.locator('.list-row').click()
            page.get_by_text('Status lama; penerimaan oleh dokter tidak tercatat di aplikasi.').wait_for()
            page.get_by_text('Transkrip mentah — belum disusun AI', exact=True).wait_for()
            assert page.locator('.bpjs-detail-page uji').count() == 0
            page.get_by_role('button', name='Kembali ke riwayat').click()
            assert page.locator('#search').input_value() == 'Pasien'
            page.get_by_role('button', name='Chat', exact=True).click()
            page.locator('#input').fill('pesan pertama')
            page.locator('#send').click()
            assert page.locator('#picker').is_disabled()
            page.get_by_role('button', name='Beranda', exact=True).click()
            page.locator('.home-page').wait_for()
            page.get_by_role('button', name='Chat', exact=True).click()
            page.get_by_text('Jawaban Layanan Uji: pesan pertama', exact=True).wait_for()
            page.locator('#input').fill('draf belum dikirim')
            page.locator('#skill-btn').click()
            assert page.locator('#input').input_value() == 'draf belum dikirim'
            page.get_by_role('button', name='Pengaturan', exact=True).click()
            page.locator('.settings-page').wait_for()
            page.get_by_role('button', name='Chat', exact=True).click()
            page.locator('.chat-page').wait_for()
            assert page.locator('#input').input_value() == 'draf belum dikirim'
            page.locator('#picker').select_option('agent-test')
            assert page.locator('.bubble').count() == 0
            page.locator('#picker').select_option('test-ai')
            page.evaluate('window.failChat = true')
            page.locator('#input').fill('coba ulang')
            page.locator('#send').click()
            page.get_by_role('button', name='Coba lagi', exact=True).wait_for()
            page.evaluate('window.failChat = false')
            page.get_by_role('button', name='Coba lagi', exact=True).click()
            page.get_by_text('Jawaban Layanan Uji: coba ulang', exact=True).wait_for()
            assert page.locator('.bubble.me').count() == 2
            assert page.evaluate('window.chatRequests') == 3
            page.evaluate("import('/chat-state.js').then(m => m.setChatOwner('other-user'))")
            page.get_by_role('button', name='Beranda', exact=True).click()
            page.locator('.home-page').wait_for()
            page.get_by_role('button', name='Chat', exact=True).click()
            page.locator('.chat-page').wait_for()
            assert page.locator('.bubble').count() == 0
            page.get_by_role('button', name='VPN', exact=True).click()
            page.locator('.vpn-page').wait_for()
            assert page.locator('#status-text').inner_text() == 'Pratinjau browser'
            page.locator('#server-card').click()
            page.locator('#wg-address').fill('10.0.0.2/32')
            page.get_by_role('button', name='SSH', exact=True).click()
            page.get_by_role('button', name='WireGuard', exact=True).click()
            assert page.locator('#wg-address').input_value() == '10.0.0.2/32'
            assert page.locator('#wg-private').get_attribute('type') == 'password'
            page.get_by_role('button', name='Simpan', exact=True).click()
            assert page.locator('#save-error').inner_text()
            page.goto(f'{origin}/#/settings/add-api-key?type=provider')
            page.locator('#key-input').fill('unknown-test-key')
            assert page.locator('#key-input').get_attribute('type') == 'password'
            page.locator('#detect-result .chip').first.click()
            assert page.evaluate('window.savedProviders || 0') == 0
            page.get_by_role('button', name='Simpan konfigurasi', exact=True).wait_for()
            page.goto(f'{origin}/#/home')
            page.evaluate('window.failProviders = true')
            page.get_by_role('button', name='Chat', exact=True).click()
            page.get_by_text('Layanan belum dapat dimuat.', exact=True).wait_for()
            page.evaluate('window.failProviders = false; window.emptyProviders = true')
            page.get_by_role('button', name='Coba lagi', exact=True).click()
            page.get_by_role('button', name='Tambah layanan', exact=True).wait_for()
            page.goto(f'{origin}/#/login')
            page.locator('#toggle').click()
            assert page.locator('#password').get_attribute('autocomplete') == 'new-password'
            page.locator('#submit').click()
            assert page.locator('#error').is_visible()
            # Embedded mode keeps exactly one web navigation.
            page.add_init_script('window.NativeBridge = {postMessage() {}};')
            page.goto(f'{origin}/#/login')
            page.reload()
            page.locator('.login-page').wait_for()
            assert page.locator('.web-nav').count() == 1
            assert not page.locator('.web-nav').is_visible()
            assert not errors, errors
            browser.close()
            print('PASS: 12 routes x 5 widths; navigation, BPJS filters/status/escaping, chat retention/isolation/retry/account reset, login and embedded navigation.')
            print(f'Fixture screenshots: {OUT}')
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
