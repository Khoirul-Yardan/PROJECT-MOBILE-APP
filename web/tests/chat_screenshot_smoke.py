"""Screenshot rendering + history reload, fixture only (no desktop or Supabase)."""
import base64
import json
import struct
import zlib
from playwright.sync_api import sync_playwright, expect
from e2e_docker import DB, CREDS


def fixture_png():
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    raw = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 32, 24, 8, 2, 0, 0, 0))
    raw += chunk(b'IDAT', zlib.compress((b'\x00' + b'\x80\xc0\xe0' * 32) * 24)) + chunk(b'IEND', b'')
    return base64.b64encode(raw).decode()


HISTORY = """
const read = () => JSON.parse(sessionStorage.getItem('fixture-history') || '[]');
export async function saveMessage(id,label,session,role,content) {
  sessionStorage.setItem('fixture-history', JSON.stringify([...read(), {id,session,role,content}]));
}
export const loadMessages = async (id,session) => read().filter(r=>r.id===id && r.session===session).map(r=>({text:r.content,fromMe:r.role==='user'}));
export const getLatestSessionId = async id => read().filter(r=>r.id===id).at(-1)?.session || null;
export const listConversations = async () => [];
export const clearConversation = async () => {};
"""


def main():
    origin = 'http://localhost:8090'
    provider = dict(id='mastra-image', label='Mastra image fixture', type='agent', format='mastra-agent',
                    endpoint=origin + '/mastra/ai-hub/agents/ai-hub', model='')
    image = fixture_png()
    requests = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome')
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        page.add_init_script('window.__providers=' + json.dumps([provider]) + ';window.__key="fixture-agent-token";')
        def intercept(route):
            url = route.request.url
            name = url.rsplit('/', 1)[-1]
            module = {'db.js': DB, 'credentials.js': CREDS, 'chat-history.js': HISTORY}.get(name)
            if module is not None:
                return route.fulfill(content_type='text/javascript', body=module)
            body = None
            if url.endswith('/ai-hub/agents/ai-hub/capabilities'):
                body = {'protocol': 'ai-hub-mastra-agent-v1', 'skills': [{'id':'computer','name':'computer'}]}
            elif url.endswith('/ai-hub/agents/ai-hub/chat'):
                payload = route.request.post_data_json
                requests.append(payload)
                text = ('Screenshot fixture\n\n![Layar](data:image/png;base64,' + image + ')') if payload['messages'][-1]['content'] == '/computer screenshot' else 'Jawaban berikutnya.'
                body = {'protocol': 'ai-hub-mastra-agent-v1', 'text': text}
            if body is not None:
                return route.fulfill(content_type='application/json', body=json.dumps(body))
            return route.continue_() if url.startswith(origin) else route.abort()
        page.route('**/*', intercept)
        page.goto(origin + '/#/chat')
        page.locator('#input').fill('/computer screenshot')
        page.locator('#send').click()
        picture = page.locator('#messages .chat-image')
        expect(picture).to_be_visible()
        page.wait_for_function("document.querySelector('.chat-image')?.naturalWidth === 32")
        page.reload()
        expect(page.locator('#messages .chat-image')).to_be_visible()
        page.wait_for_function("document.querySelector('.chat-image')?.naturalWidth === 32")
        page.locator('#messages .chat-image').click()
        expect(page.locator('.image-lightbox')).to_be_visible()
        with page.expect_download() as downloaded:
            page.locator('.image-lightbox-download').click()
        assert downloaded.value.failure() is None
        page.locator('.image-lightbox-close').click()
        page.locator('#input').fill('Lanjutkan chat')
        page.locator('#send').click()
        expect(page.locator('#messages .bubble.them').last).to_contain_text('Jawaban berikutnya.')
        assert len(requests) == 2
        assert all('data:image/' not in m['content'] for m in requests[-1]['messages'])
        assert page.evaluate("sessionStorage.getItem('fixture-history').includes('data:image/png;base64,')")
        browser.close()
    print('PASS screenshot fixture: inline PNG, reload history, lightbox, download, next request excludes image bytes.')


if __name__ == '__main__':
    main()
