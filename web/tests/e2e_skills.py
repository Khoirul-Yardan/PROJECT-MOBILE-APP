"""E2E palet "/" di Chat mengikuti provider yang dipilih.

Gemini -> /search, /code (Google Search & eksekusi kode, dikirim sebagai `tools`
ke API Gemini); ChatGPT gpt-4o-mini -> /search; Hermes Agent (A2A) -> daftar
skill dari kartu agent-nya sendiri. Gemini API dan relay A2A DITIRU (kunci/
agent asli tidak dipakai); yang diuji adalah sisi aplikasi. Screenshot ->
Images/UjiTest/.

Run: python -m http.server 8091 --directory web/public
     E2E_ORIGIN=http://localhost:8091 python web/tests/e2e_skills.py
"""
import json, os, sys
from playwright.sync_api import sync_playwright
import e2e_docker as e
from e2e_docker import DB, CREDS, HISTORY, SHOTS, check

ORIGIN = os.environ.get('E2E_ORIGIN', 'http://localhost:8091')

PROVIDERS = [
    dict(id='gemini', label='Gemini', vendor='Google', type='chat', format='gemini',
         endpoint='https://generativelanguage.googleapis.com/v1beta/models', model='gemini-2.5-flash'),
    dict(id='openai', label='ChatGPT', vendor='OpenAI', type='chat', format='openai',
         endpoint='https://api.openai.com/v1/chat/completions', model='gpt-4o-mini'),
    dict(id='hermes-agent', label='Hermes Agent (A2A)', vendor='Self-hosted', type='agent', format='a2a',
         endpoint='http://hermes.test:9900/', model=''),
]
AGENT_CARD = {'skills': [
    {'id': 'terminal', 'name': 'terminal', 'description': 'Jalankan perintah shell'},
    {'id': 'kanban', 'name': 'kanban', 'description': 'Kelola papan tugas'},
]}


def make_page(browser, gemini_calls):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda x: errors.append(str(x)))
    page.add_init_script(f'window.__providers = {json.dumps(PROVIDERS)}; window.__key = "fixture-key";')

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
            if path.endswith('/relay/'):  # relay A2A: kembalikan kartu agent
                return route.fulfill(content_type='application/json',
                                     body=json.dumps({'status': 200, 'body': json.dumps(AGENT_CARD)}))
            return route.continue_()
        if 'generativelanguage.googleapis.com' in url:
            cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*'}
            if route.request.method == 'OPTIONS':
                return route.fulfill(status=204, headers=cors)
            if route.request.method == 'POST':
                gemini_calls.append(json.loads(route.request.post_data or '{}'))
                return route.fulfill(status=200, content_type='application/json', headers=cors, body=json.dumps(
                    {'candidates': [{'content': {'parts': [{'text': 'Jawaban Gemini (simulasi).'}]}}]}))
            return route.fulfill(status=200, content_type='application/json', headers=cors, body='{"models":[]}')
        return route.fulfill(content_type='text/javascript', body='')
    page.route('**/*', intercept)
    return ctx, page, errors


def open_palette(page):
    page.locator('#skill-btn').click()
    page.locator('#skill-menu:not(.hidden)').wait_for()
    page.wait_for_timeout(300)
    return page.locator('#skill-menu').inner_text()


def pick(page, label):
    page.locator('#picker .chip', has_text=label).click()
    page.wait_for_timeout(500)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome')
        calls = []
        ctx, page, errs = make_page(browser, calls)
        page.goto(f'{ORIGIN}/#/chat')
        page.locator('.chat-page').wait_for()
        page.wait_for_timeout(600)

        # Gemini
        pick(page, 'Gemini')
        menu = open_palette(page)
        page.screenshot(path=str(SHOTS / '50-skills-gemini-search-dan-code.png'))
        check('Skills Gemini: /search & /code tampil', '/search' in menu and '/code' in menu, menu.replace('\n', ' | '))
        check('Skills Gemini: perintah umum tetap ada', all(c in menu for c in ('/system', '/clear', '/help')))

        # ChatGPT
        page.locator('#skill-btn').click()  # tutup
        pick(page, 'ChatGPT')
        menu = open_palette(page)
        page.screenshot(path=str(SHOTS / '51-skills-chatgpt-hanya-umum.png'))
        check('Skills ChatGPT: /search tersedia, /code tidak untuk model ini', '/search' in menu and '/code' not in menu)
        check('Skills ChatGPT: perintah umum ada', '/system' in menu and '/help' in menu)

        # Hermes Agent (A2A)
        page.locator('#skill-btn').click()
        pick(page, 'Hermes')
        page.wait_for_timeout(500)
        menu = open_palette(page)
        page.screenshot(path=str(SHOTS / '52-skills-hermes-dari-kartu-agent.png'))
        check('Skills Hermes: skill dari kartu agent tampil', '/terminal' in menu and '/kanban' in menu, menu.replace('\n', ' | '))
        check('Skills Hermes: tanpa /search & /code milik Gemini', '/search' not in menu and '/code' not in menu)
        page.locator('#skill-btn').click()

        # Toggle /search di Gemini lalu kirim -> body request memuat google_search
        pick(page, 'Gemini')
        page.locator('#input').fill('/search')
        page.locator('#send').click()
        page.wait_for_timeout(600)
        page.screenshot(path=str(SHOTS / '53-skills-gemini-search-diaktifkan.png'))
        check('Toggle /search: konfirmasi AKTIF tampil', 'AKTIF' in page.locator('#messages').inner_text())
        menu = open_palette(page)
        check('Toggle /search: palet menandai AKTIF', '/search' in menu and 'AKTIF' in menu)
        page.locator('#skill-btn').click()
        page.locator('#input').fill('Berapa kurs dolar hari ini?')
        page.locator('#send').click()
        page.wait_for_function("!document.querySelector('#send').disabled", timeout=20000)
        page.wait_for_timeout(500)
        page.screenshot(path=str(SHOTS / '54-skills-gemini-jawaban-dengan-search.png'))
        check('Gemini + /search: request memuat tools google_search',
              calls and calls[-1].get('tools') == [{'google_search': {}}], str(calls[-1].get('tools') if calls else None))
        check('Gemini + /search: balasan tampil', 'Jawaban Gemini' in page.locator('#messages').inner_text())

        # Matikan lagi -> request berikutnya tanpa tools
        page.locator('#input').fill('/search')
        page.locator('#send').click()
        page.wait_for_timeout(400)
        page.locator('#input').fill('Tanpa pencarian.')
        page.locator('#send').click()
        page.wait_for_function("!document.querySelector('#send').disabled", timeout=20000)
        check('Gemini: /search dimatikan -> request tanpa tools', calls and 'tools' not in calls[-1])
        check('Skills: tidak ada JS error', not errs, str(errs))
        ctx.close()
        browser.close()

    fails = [r for r in e.results if not r[1]]
    print(f'\n{len(e.results) - len(fails)}/{len(e.results)} lulus')
    (SHOTS / 'hasil-skills.json').write_text(json.dumps(e.results, ensure_ascii=False, indent=1), encoding='utf-8')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
