"""Isolated browser tests: no real credentials, Supabase, or paid AI calls.
Run: python web/tests/mastra_skills_smoke.py
Optional E2E_ORIGIN=http://localhost:8090 tests the Docker-served frontend.
"""
import json
import base64
import os
import tempfile
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright, expect
from ui_smoke import ROOT, QuietHandler
from e2e_docker import DB, CREDS, HISTORY


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    origin = os.environ.get('E2E_ORIGIN', f'http://127.0.0.1:{server.server_port}')
    providers = [
        dict(id='mastra', label='Mastra Test (Gemini)', type='agent', format='mastra', endpoint=origin + '/mastra', model='google/gemini-2.5-flash'),
        dict(id='gemini', label='Gemini', type='chat', format='gemini', endpoint='https://generativelanguage.googleapis.com/v1beta/models', model='gemini-2.5-flash'),
        dict(id='openai', label='ChatGPT', type='chat', format='openai', endpoint='https://api.openai.com/v1/chat/completions', model='gpt-4.1-mini'),
        dict(id='openrouter', label='OpenRouter', type='chat', format='openai', endpoint='https://openrouter.ai/api/v1/chat/completions', model='openrouter/auto'),
        dict(id='anthropic', label='Claude', type='chat', format='anthropic', endpoint='https://api.anthropic.com/v1/messages', model='claude-haiku-4-5'),
        dict(id='hermes-agent', label='Hermes A2A', type='agent', format='a2a', endpoint='http://agent.test/', model=''),
        dict(id='custom', label='Custom', type='chat', format='openai', endpoint='https://custom.test/v1/chat/completions', model='gpt-4.1-mini'),
    ]
    calls, errors = [], []
    capabilities = dict(protocol='ai-hub-mastra-v1', skills=[dict(id='calculate', name='calculate', description='Hitung angka')], models=[dict(id='google/gemini-2.5-flash', label='Gemini 2.5 Flash')])
    failed = {'discovery': False, 'chat': False}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='chrome')
            page = browser.new_page(viewport={'width': 390, 'height': 844})
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.add_init_script(f'window.__providers={json.dumps(providers)};window.__key="fixture-key";')

            def intercept(route):
                req = route.request
                url = req.url
                def reply(body, status=200):
                    route.fulfill(status=status, content_type='application/json', headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*'}, body=json.dumps(body))
                if req.method == 'OPTIONS':
                    return reply({}, 204)
                if url.startswith(origin):
                    if url.endswith('/db.js'):
                        return route.fulfill(content_type='text/javascript', body=DB)
                    if url.endswith('/credentials.js'):
                        return route.fulfill(content_type='text/javascript', body=CREDS.replace('async (entry) => { window.__providers = [entry]; }', 'async (entry, key) => { window.__providers = [entry]; window.__savedKey = key; }'))
                    if url.endswith('/chat-history.js'):
                        return route.fulfill(content_type='text/javascript', body=HISTORY)
                    if url.endswith('/ai-hub/capabilities'):
                        return reply({'error': {'message': 'Discovery offline'}} if failed['discovery'] else capabilities, 503 if failed['discovery'] else 200)
                    if '/ai-hub/agents/helper/' in url:
                        calls.append((url, req.post_data_json if req.method == 'POST' else {}, req.headers))
                        if failed['discovery']:
                            return reply({'error': {'message': 'Unauthorized'}}, 401)
                        if url.endswith('/capabilities'):
                            return reply({'protocol': 'ai-hub-mastra-agent-v1', 'agent': {'id': 'helper', 'name': 'Agent Pemilik', 'provider': 'Provider Bebas', 'model': 'model-server'}, 'skills': [{'id': 'calculate', 'name': 'calculate'}]})
                        return reply({'protocol': 'ai-hub-mastra-agent-v1', 'text': 'Balasan agent pemilik.'})
                    if url.endswith('/ai-hub/chat'):
                        calls.append((url, req.post_data_json, req.headers))
                        if failed['chat']:
                            return reply({'error': {'message': 'Key Gemini ditolak'}}, 401)
                        return reply({'protocol': 'ai-hub-mastra-v1', 'text': 'Hasil uji Mastra: 42.'})
                    if url.endswith('/relay/'):
                        body = req.post_data_json
                        calls.append((url, body, req.headers))
                        if body['url'].startswith('https://gateway.example.test'):
                            return reply({'status': 200, 'body': json.dumps({'choices': [{'message': {'content': 'OpenClaw HTTP fixture'}}]})})
                        return reply({'status': 200, 'body': json.dumps({'skills': [{'id': 'web', 'name': 'web', 'description': 'Web agent'}]})})
                    return route.continue_()
                if req.method == 'POST':
                    calls.append((url, req.post_data_json, req.headers))
                    if 'googleapis.com' in url:
                        return reply({'candidates': [{'content': {'parts': [{'text': 'Gemini fixture'}]}}]})
                    if url.endswith('/responses'):
                        return reply({'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': 'OpenAI fixture', 'annotations': [{'url': 'https://example.test/source'}]}]}]})
                    if 'anthropic.com' in url:
                        return reply({'content': [{'type': 'server_tool_use'}, {'type': 'text', 'text': 'Claude fixture', 'citations': [{'url': 'https://example.test/claude'}]}]})
                    return reply({'choices': [{'message': {'content': 'OpenRouter fixture'}}]})
                return route.fulfill(content_type='text/javascript', body='')

            page.route('**/*', intercept)
            page.goto(origin + '/#/chat')
            page.locator('#picker .chip').first.wait_for()
            def ask(text):
                page.locator('#input').fill(text)
                page.locator('#send').click()
                expect(page.locator('#send')).to_be_enabled(timeout=10000)
            def select(label):
                page.locator('#picker').get_by_role('button', name=label, exact=True).click()
            def palette():
                page.locator('#skill-btn').click()
                expect(page.locator('#skill-menu')).to_be_visible()
                return page.locator('#skill-menu')

            expect(palette()).to_contain_text('/calculate')
            page.locator('#skill-btn').click()
            ask('/help')
            expect(page.locator('#messages')).to_contain_text('/calculate')
            ask('/calculate 6 * 7')
            expect(page.locator('#messages')).to_contain_text('Hasil uji Mastra: 42.')
            assert calls[-1][1]['messages'] == [{'role': 'user', 'content': '/calculate 6 * 7'}]
            assert calls[-1][2]['authorization'] == 'Bearer fixture-key'
            ask('Apa hasil tadi?')
            expect(page.locator('#messages .bubble.them').last).to_contain_text('42')
            assert len(calls[-1][1]['messages']) == 3
            page.locator('#new-session').click()
            ask('Mulai baru')
            assert len(calls[-1][1]['messages']) == 1
            failed['chat'] = True
            ask('Uji gagal')
            expect(page.locator('#messages')).to_contain_text('Key Gemini ditolak')
            failed['chat'] = False
            failed['discovery'] = True
            ask('/skills')
            expect(page.locator('#model-notice')).to_contain_text('Discovery offline')
            failed['discovery'] = False
            ask('/skills')
            expect(page.locator('#messages')).to_contain_text('Kemampuan Mastra')
            page.locator('#chat-model').click()
            expect(page.locator('#model-select')).to_contain_text('Gemini 2.5 Flash')
            page.locator('[data-close]').click()
            print('PASS Mastra: discovery, chat, history, session isolation, errors, refresh, models')

            for label, toggle, field in [('Gemini', '/url', 'tools'), ('ChatGPT', '/search', 'tools'), ('OpenRouter', '/search', 'plugins'), ('Claude', '/search', 'tools')]:
                select(label)
                menu = palette()
                expect(menu).to_contain_text(toggle)
                expect(menu).not_to_contain_text('/calculate')
                page.locator('#skill-btn').click()
                ask(toggle)
                ask('Uji tools fiktif')
                expect(page.locator('#messages .bubble.them').last).to_contain_text('fixture')
                assert calls[-1][1][field]
                if label == 'Gemini':
                    assert calls[-1][1]['tools'] == [{'url_context': {}}]
                if label == 'ChatGPT':
                    assert calls[-1][0].endswith('/responses') and calls[-1][1]['store'] is False
                    expect(page.locator('#messages a[href="https://example.test/source"]')).to_be_visible()
                if label == 'Claude':
                    assert calls[-1][1]['tools'][0]['type'] == 'web_search_20250305'
                print('PASS provider tool request:', label)

            select('Custom')
            menu = palette()
            expect(menu).not_to_contain_text('/search')
            expect(menu).not_to_contain_text('/code')
            page.locator('#skill-btn').click()
            select('Hermes A2A')
            expect(palette()).to_contain_text('/web')
            assert any(c[1].get('headers', {}).get('Authorization') == 'Bearer fixture-key' for c in calls if c[0].endswith('/relay/'))
            print('PASS no tool leakage and authenticated agent discovery')

            page.goto(origin + '/#/settings/add-api-key?type=provider')
            expect(page.locator('#mastra-card')).to_have_count(0)
            expect(page.locator('#mastra-save')).to_have_count(0)
            page.goto(origin + '/#/settings/add-api-key?type=agent')
            expect(page.locator('#agent-setup')).to_be_visible()
            expect(page.locator('#agent-setup textarea')).to_have_count(1)
            expect(page.locator('#agent-setup input')).to_have_count(0)
            expect(page.locator('#agent-kind')).to_have_count(0)
            expect(page.locator('#agent-recognition')).to_contain_text('Dikenal otomatis dari pola key-nya')
            expect(page.locator('#recognized-keys')).to_contain_text('Nous Portal')
            expect(page.locator('#recognized-keys')).to_contain_text('AQ.')
            expect(page.locator('#mastra-card')).to_have_count(0)
            expect(page.locator('#openclaw-url')).to_have_count(0)
            expect(page.locator('#mastra-url')).to_have_count(0)
            assert page.locator('#mastra-direct').count() == 0
            token = 'fixture-agent-token-123456'
            page.locator('#key-input').fill('sk-' + 'a' * 32)
            expect(page.locator('#detect-result')).not_to_contain_text('Terbaca: ChatGPT')
            expect(page.locator('#agent-kind')).to_be_visible()
            page.locator('#key-input').fill('sk-proj-' + 'a' * 24)
            expect(page.locator('#detect-result')).to_contain_text('Terbaca: ChatGPT')
            page.locator('#key-input').fill('sk-ant-oat01-fixture')
            expect(page.locator('#detect-result')).not_to_contain_text('Terbaca: Claude')
            page.locator('#key-input').fill('sk-nous-fixture-detection')
            expect(page.locator('#detect-result')).to_contain_text('Terbaca: Hermes')
            expect(page.locator('#agent-url')).to_have_count(0)
            page.locator('#agent-save').click()
            expect(page.locator('#slot-label')).to_have_value('Hermes 2')
            page.locator('#key-input').fill(token)
            expect(page.locator('#slot-label')).to_have_count(0)
            expect(page.locator('#detect-result')).to_contain_text('belum dapat dikenali')
            expect(page.locator('#agent-url')).to_have_count(0)
            page.locator('#agent-kind').select_option('hermes-agent')
            expect(page.locator('#agent-url')).to_be_visible()
            expect(page.locator('#agent-token')).to_have_count(0)
            page.locator('#agent-url').fill('https://hermes.example.test')
            page.locator('#agent-save').click()
            page.wait_for_function('window.__providers.length === 1')
            assert page.evaluate('window.__providers[0].format') == 'a2a'
            assert page.evaluate('window.__savedKey') == token
            page.goto(origin + '/#/settings/add-api-key?type=agent')
            page.locator('#key-input').fill('https://gateway.example.test')
            page.locator('#agent-kind').select_option('openclaw-http')
            expect(page.locator('#agent-token')).to_be_visible()
            expect(page.locator('#agent-url')).to_have_count(0)
            page.locator('#agent-token').fill(token)
            page.locator('#agent-save').click()
            page.wait_for_function("window.__providers[0]?.format === 'openclaw-http'")
            assert page.evaluate('window.__providers[0].endpoint') == 'https://gateway.example.test/v1/chat/completions'
            assert page.evaluate('window.__providers[0].model') == 'openclaw/default'
            page.goto(origin + '/#/chat')
            expect(page.locator('#chat-model')).not_to_be_visible()
            ask('Uji HTTP OpenClaw fiktif')
            expect(page.locator('#messages')).to_contain_text('OpenClaw HTTP fixture')
            payload = json.loads(calls[-1][1]['body'])
            assert payload['model'] == 'openclaw/default' and payload['messages'][-1]['content'] == 'Uji HTTP OpenClaw fiktif'
            page.goto(origin + '/#/settings/add-api-key?type=agent')
            page.locator('#key-input').fill(origin + '/ai-hub/agents/helper')
            expect(page.locator('#agent-kind')).to_have_value('mastra')
            expect(page.locator('#agent-id')).to_have_count(0)
            page.locator('#agent-token').fill(token)
            page.locator('#mastra-check').click()
            expect(page.locator('#mastra-save')).to_be_visible()
            page.locator('#agent-token').fill(token + '-changed')
            expect(page.locator('#mastra-save')).to_have_count(0)
            expect(page.locator('#mastra-check')).to_be_enabled()
            page.locator('#key-input').fill('')
            expect(page.locator('#agent-kind')).to_have_count(0)
            expect(page.locator('#agent-token')).to_have_count(0)
            code = 'aihub-mastra-v1.' + base64.urlsafe_b64encode(json.dumps({'endpoint': origin, 'agentId': 'helper', 'token': token}).encode()).decode().rstrip('=')
            page.locator('#key-input').fill('aihub-mastra-v1.invalid')
            expect(page.locator('#detect-result')).to_contain_text('tidak valid')
            page.locator('#key-input').fill(code)
            failed['discovery'] = True
            page.locator('#mastra-check').click()
            expect(page.locator('#detect-result')).to_contain_text('Token agent ditolak')
            expect(page.locator('#mastra-save')).to_have_count(0)
            failed['discovery'] = False
            page.locator('#mastra-check').click()
            expect(page.locator('#detect-result')).to_contain_text('Provider Bebas')
            expect(page.locator('#detect-result')).to_contain_text('model-server')
            page.locator('#mastra-save').click()
            page.wait_for_function('window.__providers.length === 1')
            saved = page.evaluate('window.__providers[0]')
            assert saved['format'] == 'mastra-agent' and saved['model'] == ''
            assert saved['type'] == 'agent' and saved['endpoint'] == origin + '/ai-hub/agents/helper'
            assert page.evaluate('window.__savedKey') == token
            assert token not in json.dumps(saved)
            page.evaluate('(key) => window.__key = key', token)
            page.goto(origin + '/#/chat')
            expect(page.locator('#chat-model')).not_to_be_visible()
            ask('Uji agent milik orang lain')
            expect(page.locator('#messages')).to_contain_text('Balasan agent pemilik.')
            assert calls[-1][1] == {'messages': [{'role': 'user', 'content': 'Uji agent milik orang lain'}]}
            assert calls[-1][2]['authorization'] == 'Bearer ' + token
            assert not errors, errors
            page.screenshot(path=str(Path(tempfile.gettempdir()) / 'ai-hub-mastra-test.png'))
            print('PASS Mastra setup and no browser errors')
            browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
