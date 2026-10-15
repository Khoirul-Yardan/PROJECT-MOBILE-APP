"""E2E terhadap web yang jalan di Docker (http://localhost:8090), data Supabase
diganti fixture. Kunci OpenAI dibaca dari env OPENAI_API_KEY (tidak ditulis ke
disk). Screenshot -> Images/UjiTest/.

Run: OPENAI_API_KEY=sk-... python web/tests/e2e_docker.py
"""
from pathlib import Path
import json, os, sys
from playwright.sync_api import sync_playwright
import re
from ui_smoke import DB as _DB, ROOT


def _full_db():
    """Fixture db.js + stub untuk setiap export db.js asli yang belum ada,
    supaya fixture tidak usang tiap kali db.js menambah fungsi."""
    real = (ROOT / 'db.js').read_text(encoding='utf-8')
    names = set(re.findall(r'export\s+(?:async\s+)?(?:function|const)\s+(\w+)', real))
    have = set(re.findall(r'export\s+(?:async\s+)?(?:function|const)\s+(\w+)', _DB))
    extra = ''.join(f'export const {n} = async () => null;' + chr(10) for n in sorted(names - have - {'sb'}))
    return _DB + chr(10) + extra


DB = _full_db()

ORIGIN = os.environ.get('E2E_ORIGIN', 'http://localhost:8090')
SHOTS = Path(__file__).resolve().parents[2] / 'Images' / 'UjiTest'
KEY = os.environ.get('OPENAI_API_KEY', '')
SHOTS.mkdir(parents=True, exist_ok=True)

CREDS = """
const P = () => window.__providers || [];
export const listCredentials = async () => P();
export const listCredentialSlots = async () => [];
export const hasCredential = async () => P().length > 0;
export const countCredentialSlots = async () => 1;
export const getCredentialKey = async () => window.__key;
export const getCredentialKeySlots = async () => [{ id: 's1', label: 'Kunci 1', apiKey: window.__key }];
export const saveCredential = async (entry) => { window.__providers = [entry]; };
export const removeCredential = async () => {};
export const removeCredentialSlot = async () => {};
export const updateCredentialModel = async (id, m) => { const e = P().find(p => p.id === id); if (e) e.model = m; };
"""
HISTORY = """
export const saveMessage = async () => {};
export const loadMessages = async () => [];
export const getLatestSessionId = async () => null;
export const listConversations = async () => [];
export const clearConversation = async () => {};
"""
OPENAI = dict(id='openai', label='ChatGPT', vendor='OpenAI', type='chat', format='openai',
              endpoint='https://api.openai.com/v1/chat/completions', model='gpt-4o-mini')

results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS' if ok else 'FAIL'), name, detail)


def new_page(browser, key, mock=None, width=390, height=844):
    ctx = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=2)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.add_init_script(f'window.__providers = {json.dumps([OPENAI])}; window.__key = {json.dumps(key)};')

    def intercept(route):
        url = route.request.url
        path = url.split('?')[0]
        if url.startswith(ORIGIN) and path.endswith('/db.js'):
            route.fulfill(content_type='text/javascript', body=DB)
        elif url.startswith(ORIGIN) and path.endswith('/credentials.js'):
            route.fulfill(content_type='text/javascript', body=CREDS)
        elif url.startswith(ORIGIN) and path.endswith('/chat-history.js'):
            route.fulfill(content_type='text/javascript', body=HISTORY)
        elif url.startswith(ORIGIN):
            route.continue_()
        elif mock and 'api.openai.com' in url:
            mock(route)
        elif 'api.openai.com' in url:
            route.continue_()
        else:
            route.fulfill(content_type='text/javascript', body='')
    page.route('**/*', intercept)
    return page, errors


def ask(page, text, wait_ms=30000):
    page.locator('#input').fill(text)
    page.locator('#send').click()
    page.wait_for_timeout(800)
    page.wait_for_function("!document.querySelector('#send').disabled", timeout=wait_ms)
    page.wait_for_timeout(500)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome')

        # 1. Jalur NYATA: kunci asli -> api.openai.com
        page, errs = new_page(browser, KEY)
        page.goto(f'{ORIGIN}/#/chat')
        page.locator('.chat-page').wait_for()
        page.wait_for_timeout(700)
        page.screenshot(path=str(SHOTS / '01-chat-chatgpt-siap-kirim.png'))
        check('Chat: tab ChatGPT tampil', page.get_by_text('ChatGPT').first.is_visible())
        ask(page, 'Halo, ini tes koneksi dari AI Hub. Balas singkat.')
        body = page.locator('#messages').inner_text()
        page.screenshot(path=str(SHOTS / '02-chat-chatgpt-API-NYATA-error-kredit-habis.png'))
        quota = 'credit' in body.lower() or 'quota' in body.lower()
        check('Chat NYATA: error kredit OpenAI ditampilkan jelas (bukan crash)', quota, body[-160:].replace('\n', ' '))
        check('Chat NYATA: tidak ada JS error', not errs, str(errs))
        page.context.close()

        # 2. Jalur SUKSES tersimulasi: respons OpenAI ditiru (kunci asli tak punya kredit)
        def mock(route):
            if route.request.method == 'OPTIONS':
                return route.fulfill(status=204, headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*'})
            if route.request.method == 'GET':  # daftar model untuk pemilih model
                return route.fulfill(status=200, content_type='application/json',
                                     headers={'access-control-allow-origin': '*'},
                                     body=json.dumps({'data': [{'id': m} for m in ('gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini')]}))
            sent = json.loads(route.request.post_data or '{}')
            last = sent['messages'][-1]['content']
            reply = ('Halo! Koneksi berhasil. Anda bertanya: "' + last[:60] + '". '
                     'Saya bisa membantu merangkum anamnesis dan menyusun dokumentasi BPJS.')
            route.fulfill(status=200, content_type='application/json',
                          headers={'access-control-allow-origin': '*'},
                          body=json.dumps({'choices': [{'message': {'role': 'assistant', 'content': reply}}]}))
        page, errs = new_page(browser, KEY or 'sk-proj-fixture', mock=mock)
        page.goto(f'{ORIGIN}/#/chat')
        page.locator('.chat-page').wait_for()
        ask(page, 'Apa saja yang bisa dibantu Bot BPJS?')
        body = page.locator('#messages').inner_text()
        page.screenshot(path=str(SHOTS / '03-chat-chatgpt-SIMULASI-balasan-sukses.png'))
        check('Chat SIMULASI: balasan tampil di gelembung', 'Koneksi berhasil' in body)
        ask(page, 'Lanjutkan, jelaskan alurnya.')
        page.screenshot(path=str(SHOTS / '04-chat-chatgpt-SIMULASI-percakapan-2-giliran.png'))
        check('Chat SIMULASI: riwayat 2 giliran', page.locator('#messages').inner_text().count('Koneksi berhasil') == 2)
        page.locator('#chat-model').click()
        page.wait_for_timeout(600)
        page.screenshot(path=str(SHOTS / '05-chat-chatgpt-pemilih-model.png'))
        check('Chat: tidak ada JS error', not errs, str(errs))
        page.context.close()

        # 3. Layar API key (kunci palsu agar rahasia asli tak masuk screenshot)
        page, errs = new_page(browser, 'sk-proj-fixture')
        page.goto(f'{ORIGIN}/#/settings/add-api-key')
        page.locator('.add-api-page').wait_for()
        page.screenshot(path=str(SHOTS / '06-tambah-api-key-kosong.png'))
        page.locator('#key-input').fill('sk-proj-' + 'X' * 40)
        page.wait_for_timeout(600)
        page.screenshot(path=str(SHOTS / '07-tambah-api-key-terdeteksi-ChatGPT.png'))
        check('API key: pola sk-proj- dikenali sebagai ChatGPT', 'ChatGPT' in page.locator('.add-api-page').inner_text())
        page.context.close()
        browser.close()
    fails = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(fails)}/{len(results)} lulus')
    (SHOTS / 'hasil-chat.json').write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding='utf-8')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
