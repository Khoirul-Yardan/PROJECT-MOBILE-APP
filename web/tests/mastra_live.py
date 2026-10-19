"""Opt-in live Mastra test. Uses a supplied test account and a fictional chat.
Usage: python web/tests/mastra_live.py <ignored-login-json> <mastra-env>
No credential values, browser storage, raw errors or patient content are printed.
"""
import base64
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect


def main():
    stage = 'configuration'
    report = {'live': True}
    try:
        login = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
        env = {}
        for line in Path(sys.argv[2]).read_text(encoding='utf-8-sig').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('\"\'')
        origin = 'http://localhost:8090'
        code = 'aihub-mastra-v1.' + base64.urlsafe_b64encode(json.dumps({
            'endpoint': origin + '/mastra', 'agentId': 'ai-hub', 'token': env['AI_HUB_AGENT_TOKEN'],
        }).encode()).decode().rstrip('=')
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='chrome')
            page = browser.new_page(viewport={'width': 390, 'height': 844})
            page.set_default_timeout(20000)
            try:
                stage = 'login'
                page.goto(origin + '/#/login')
                page.locator('#email').fill(login['email'])
                page.locator('#password').fill(login['password'])
                page.locator('#submit').click()
                page.wait_for_url('**/#/home')
                report['login'] = True
                stage = 'discovery'
                page.goto(origin + '/#/settings/add-api-key?type=agent')
                page.locator('#key-input').fill(code)
                with page.expect_response(lambda r: '/ai-hub/agents/ai-hub/capabilities' in r.url) as pending:
                    page.locator('#mastra-check').click()
                response = pending.value
                report['discovery_status'] = response.status
                metadata = response.json()
                report['provider'] = metadata.get('agent', {}).get('provider')
                report['model'] = metadata.get('agent', {}).get('model')
                expect(page.locator('#mastra-save')).to_be_visible()
                stage = 'save'
                page.locator('#mastra-save').click()
                page.wait_for_function("!location.hash.includes('add-api-key')")
                report['credential_saved'] = page.evaluate('''async () => {
                  const {sb, currentUser} = await import('/db.js');
                  const user = await currentUser();
                  const {data,error} = await sb.from('api_credentials')
                    .select('type,format,endpoint,encrypted_key,iv')
                    .eq('user_id',user.id).eq('format','mastra-agent')
                    .eq('endpoint',location.origin+'/mastra/ai-hub/agents/ai-hub');
                  return !error && data.length > 0 && data.every(r => r.type==='agent' && r.encrypted_key && r.iv);
                }''')
                if not report['credential_saved']:
                    raise RuntimeError('save failed')
                stage = 'chat'
                page.goto(origin + '/#/chat')
                page.locator('#picker .chip').filter(has_text='Mastra · Mastra Test (Google)').click()
                expect(page.locator('#send')).to_be_enabled()
                page.locator('#new-session').click()
                page.locator('#input').fill('Uji integrasi fiktif AI Hub: gunakan calculate untuk menghitung 6 dikali 7, lalu jawab singkat dalam Bahasa Indonesia.')
                with page.expect_response(lambda r: r.url.endswith('/ai-hub/agents/ai-hub/chat'), timeout=150000) as pending:
                    page.locator('#send').click()
                response = pending.value
                report['chat_status'] = response.status
                body = response.json()
                report['reply_received'] = isinstance(body.get('text'), str) and bool(body['text'].strip())
                report['calculation_correct'] = '42' in body.get('text', '')
                expect(page.locator('#send')).to_be_enabled(timeout=20000)
                if report['reply_received'] and report['calculation_correct']:
                    expect(page.locator('#messages .bubble.them').last).to_contain_text('42')
                    report['reply_visible'] = True
                else:
                    report['reply_visible'] = False
                if response.status != 200 or not report['reply_visible']:
                    raise RuntimeError('chat failed')
                report['success'] = True
            finally:
                try:
                    page.evaluate("async () => { const { signOut } = await import('/db.js'); await signOut(); }")
                except Exception:
                    pass
                browser.close()
    except Exception:
        report['success'] = False
        report['failed_stage'] = stage
    print(json.dumps(report))
    return 0 if report.get('success') else 1


if __name__ == '__main__':
    sys.exit(main())
