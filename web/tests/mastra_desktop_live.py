"""Live Docker chat/model with isolated account/history fixture. No Supabase writes.
--screenshot also tests Windows capture through authenticated Mastra Chat.
Only booleans/status are printed, never secrets or desktop contents.
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from e2e_docker import DB, CREDS, HISTORY


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--screenshot', action='store_true')
    args = parser.parse_args()
    config = {}
    for line in (Path(__file__).resolve().parents[2] / 'mastra-test/.env').read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            config[key.strip()] = value.strip().strip('\"\'')
    origin = 'http://localhost:8090'
    provider = dict(id='mastra-live', label='Mastra lokal', type='agent', format='mastra-agent',
                    endpoint=origin + '/mastra/ai-hub/agents/ai-hub', model='')
    report = {'account_fixture': True, 'model_live': True}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome')
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        page.add_init_script('window.__providers=' + json.dumps([provider]) + ';window.__key=' + json.dumps(config['AI_HUB_AGENT_TOKEN']) + ';')
        def route(request):
            name = request.request.url.rsplit('/', 1)[-1]
            fixture = {'db.js': DB, 'credentials.js': CREDS, 'chat-history.js': HISTORY}.get(name)
            if fixture is not None:
                return request.fulfill(content_type='text/javascript', body=fixture)
            if request.request.url.startswith(origin):
                return request.continue_()
            return request.abort()
        page.route('**/*', route)
        page.goto(origin + '/#/chat')
        expect(page.locator('#send')).to_be_enabled(timeout=20000)
        for label, prompt, expected in [('calculation', 'Gunakan calculate: 6 dikali 7. Jawab singkat.', '42')] + (
                [('screenshot', '/computer screenshot', 'Screenshot layar utama laptop tersimpan:'),
                 ('followup', 'Gunakan calculate untuk 8 dikali 9. Jawab angkanya saja.', '72')] if args.screenshot else []):
            page.locator('#input').fill(prompt)
            with page.expect_response(lambda r: r.url.endswith('/ai-hub/agents/ai-hub/chat'), timeout=120000) as pending:
                page.locator('#send').click()
            response = pending.value
            body = response.json()
            report[label + '_status'] = response.status
            report[label + '_correct'] = expected in body.get('text', '')
            expect(page.locator('#messages .bubble.them').last).to_contain_text(expected, timeout=20000)
            expect(page.locator('#send')).to_be_enabled()
            if label == 'screenshot':
                image = page.locator('#messages .chat-image').last
                expect(image).to_be_visible()
                page.wait_for_function("Array.from(document.querySelectorAll('#messages .chat-image')).some(i => i.complete && i.naturalWidth > 0)")
                report['screenshot_image_visible'] = image.evaluate('(image) => image.naturalWidth > 0')
                image.click()
                expect(page.locator('.image-lightbox')).to_be_visible()
                page.locator('.image-lightbox-close').click()
            if label == 'followup':
                request = response.request.post_data_json
                report['image_not_resent_as_prompt'] = all('data:image/' not in m['content'] for m in request['messages'])
                assert report['image_not_resent_as_prompt']
        browser.close()
    print(json.dumps(report))
    assert all(value for key, value in report.items() if key.endswith('_correct'))


if __name__ == '__main__':
    main()
