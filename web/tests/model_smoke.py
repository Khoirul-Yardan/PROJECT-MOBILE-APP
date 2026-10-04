"""Phone + model selection integration, with isolated credentials/API fixtures."""
from functools import partial
from http.server import ThreadingHTTPServer
from threading import Thread
import json
import os
import re

from playwright.sync_api import sync_playwright, expect
from ui_smoke import ROOT, OUT, DB, CREDENTIALS, QuietHandler


def main():
    OUT.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    origin = os.environ.get('UI_SMOKE_ORIGIN', f'http://127.0.0.1:{server.server_port}').rstrip('/')
    provider = dict(id='gemini', label='Gemini', type='chat', format='gemini',
                    endpoint='https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
                    model='gemini-1.5-flash')
    calls, errors = [], []
    mode = {'api': 'success', 'list': 'success'}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='chrome')
            page = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.add_init_script(f'window.__fixtureProviders = {json.dumps([provider])};')

            def intercept(route):
                url = route.request.url
                if url.startswith(origin) and url.endswith('/db.js'):
                    route.fulfill(content_type='text/javascript', body=DB)
                elif url.startswith(origin) and url.endswith('/credentials.js'):
                    route.fulfill(content_type='text/javascript', body=CREDENTIALS)
                elif url.startswith(origin):
                    route.continue_()
                elif url.startswith('https://generativelanguage.googleapis.com/'):
                    assert 'fixture-key' not in url
                    assert route.request.headers['x-goog-api-key'] == 'fixture-key'
                    if route.request.method == 'GET':
                        if mode['list'] == 'failure':
                            route.fulfill(status=403, json={'error': {'message': 'List access denied'}})
                        else:
                            route.fulfill(json={'models': [
                                {'name': f'models/{name}', 'displayName': name, 'supportedGenerationMethods': ['generateContent']}
                                for name in ['gemini-test-flash', 'gemini-test-pro']
                            ]})
                    else:
                        calls.append({'url': url, 'body': route.request.post_data_json})
                        if mode['api'] == 'quota':
                            route.fulfill(status=429, json={'error': {'message': 'Quota exceeded'}})
                        elif 'gemini-1.5-flash' in url:
                            route.fulfill(status=404, json={'error': {'message': 'models/gemini-1.5-flash is not found or is not supported for generateContent'}})
                        else:
                            route.fulfill(json={'candidates': [{'content': {'parts': [{'text': 'Jawaban dari model yang tersedia.'}]}}]})
                else:
                    route.fulfill(content_type='text/javascript', body='')

            page.route('**/*', intercept)
            page.goto(f'{origin}/#/chat')
            page.locator('#input').fill('Halo Gemini')
            page.locator('#send').click()
            expect(page.locator('#messages')).to_contain_text('Jawaban dari model yang tersedia.')
            expect(page.locator('#model-notice')).to_contain_text('Dialihkan ke gemini-test-flash')
            assert len(calls) == 2
            assert calls[0]['body'] == calls[1]['body']
            assert calls[1]['body']['contents'] == [{'role': 'user', 'parts': [{'text': 'Halo Gemini'}]}]
            assert page.evaluate("JSON.parse(sessionStorage.getItem('__fixtureProviders'))[0].model") == 'gemini-test-flash'
            page.screenshot(path=str(OUT / 'chat-model-fallback.png'))

            # Manual Gemini choice persists and constructs a NEW generation URL.
            page.locator('#chat-model').click()
            expect(page.locator('.model-load-status')).to_contain_text('2 model chat')
            page.locator('#model-select').select_option('gemini-test-pro')
            page.screenshot(path=str(OUT / 'model-picker-phone.png'))
            page.locator('#save-model').click()
            expect(page.locator('dialog')).to_have_count(0)
            page.reload()
            expect(page.locator('#chat-model')).to_contain_text('gemini-test-pro')
            page.locator('#input').fill('Pakai pilihan manual')
            page.locator('#send').click()
            expect(page.locator('#messages')).to_contain_text('Jawaban dari model yang tersedia.')
            assert 'gemini-test-pro:generateContent' in calls[-1]['url']

            # Quota errors are shown once, not retried across models.
            mode['api'] = 'quota'
            before = len(calls)
            page.locator('#input').fill('Cek kuota')
            page.locator('#send').click()
            expect(page.locator('#messages')).to_contain_text('Quota exceeded')
            assert len(calls) == before + 1
            mode['api'] = 'success'

            # A save error leaves the old model intact and the sheet open.
            page.evaluate('window.__failModelSave = true')
            page.locator('#chat-model').click()
            page.locator('#model-select').select_option('auto')
            page.locator('#save-model').click()
            expect(page.locator('#model-error')).to_contain_text('offline')
            assert page.evaluate("JSON.parse(sessionStorage.getItem('__fixtureProviders'))[0].model") == 'gemini-test-pro'
            page.locator('[data-close]').click()
            page.evaluate('window.__failModelSave = false')

            # Users can still enter a model if discovery is unavailable.
            mode['list'] = 'failure'
            page.goto(f'{origin}/#/settings/apikeys')
            page.locator('[data-model]').click()
            expect(page.locator('.model-load-status')).to_contain_text('Daftar belum bisa dimuat')
            page.locator('#model-select').select_option('__custom')
            page.locator('#model-id').fill('models/gemini-test-flash')
            page.locator('#save-model').click()
            expect(page.locator('[data-model]')).to_contain_text('gemini-test-flash')
            mode['list'] = 'success'

            # Fallback still returns a reply if persisting the replacement fails.
            page.evaluate('(p) => sessionStorage.setItem("__fixtureProviders", JSON.stringify([p]))', provider)
            page.evaluate('window.__failModelSave = true')
            page.goto(f'{origin}/#/chat')
            page.locator('#input').fill('Jawab walau simpan offline')
            page.locator('#send').click()
            expect(page.locator('#messages')).to_contain_text('Jawaban dari model yang tersedia.')
            expect(page.locator('#model-notice')).to_contain_text('belum tersimpan')
            assert page.evaluate("JSON.parse(sessionStorage.getItem('__fixtureProviders'))[0].model") == 'gemini-1.5-flash'
            page.evaluate('window.__failModelSave = false')

            # Manual model editing also works for other API formats.
            custom = dict(id='custom', label='Asisten Tim', type='chat', format='openai',
                          endpoint='https://example.test/v1/chat/completions', model='old-model')
            page.evaluate('(p) => sessionStorage.setItem("__fixtureProviders", JSON.stringify([p]))', custom)
            page.goto(f'{origin}/#/settings/apikeys')
            page.locator('[data-model]').click()
            expect(page.locator('#model-select')).not_to_be_visible()
            page.locator('#model-id').fill('team/model-v2')
            page.locator('#save-model').click()
            expect(page.locator('[data-model]')).to_contain_text('team/model-v2')
            page.reload()
            expect(page.locator('[data-model]')).to_contain_text('team/model-v2')
            page.evaluate('(p) => sessionStorage.setItem("__fixtureProviders", JSON.stringify([p]))', {**provider, 'model': 'gemini-test-flash'})

            # Phone widths, reduced-height keyboard viewport and touch Enter.
            for width in [320, 360, 390, 412]:
                page.set_viewport_size({'width': width, 'height': 844})
                page.goto(f'{origin}/#/chat')
                page.locator('#input').fill('Baris pertama')
                page.locator('#input').press('Enter')
                assert page.locator('#input').input_value().endswith('\n')
                page.set_viewport_size({'width': width, 'height': 420})
                expect(page.locator('body')).to_have_class(re.compile('keyboard-open'))
                expect(page.locator('.web-nav')).not_to_be_visible()
                send = page.locator('#send').bounding_box()
                assert send['y'] + send['height'] <= 420
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.screenshot(path=str(OUT / f'chat-keyboard-{width}.png'))
                page.locator('#input').evaluate('(el) => el.blur()')
                page.set_viewport_size({'width': width, 'height': 844})
                expect(page.locator('.web-nav')).to_be_visible()

            assert not errors, errors
            browser.close()
            print('PASS: Gemini fallback, persisted/manual model, new URL, quota handling, save failure, discovery failure, 4 phone widths and keyboard composer.')
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
