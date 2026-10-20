"""Windows bridge, local opt-in. Screenshots returned only over authenticated requests.
Run: python mastra-test/scripts/desktop_bridge.py [--allow-control] [--minutes 60]
Ctrl+C stops access. Token is generated in ignored .env; recreate Mastra afterwards.
"""
import argparse
import base64
import ctypes
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import secrets
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
KEYS = {'TAB': 0x09, 'ESC': 0x1B, 'UP': 0x26, 'DOWN': 0x28, 'LEFT': 0x25, 'RIGHT': 0x27}


def token_from_env():
    path = ROOT / '.env'
    content = path.read_text(encoding='utf-8-sig') if path.exists() else ''
    for line in content.splitlines():
        if line.startswith('AI_HUB_DESKTOP_TOKEN='):
            token = line.split('=', 1)[1].strip().strip('\"\'')
            if len(token) < 32:
                raise ValueError('AI_HUB_DESKTOP_TOKEN harus minimal 32 karakter.')
            return token
    token = secrets.token_urlsafe(32)
    with path.open('a', encoding='utf-8') as stream:
        stream.write('\nAI_HUB_DESKTOP_TOKEN=' + token + '\n')
    return token


def perform(body, allow_control):
    action = body.get('action')
    if action == 'screenshot' and set(body) == {'action'}:
        output = ROOT / '.desktop-captures'
        output.mkdir(exist_ok=True)
        path = output / (time.strftime('%Y%m%d-%H%M%S-') + secrets.token_hex(4) + '.png')
        result = subprocess.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
                                 str(ROOT / 'scripts' / 'capture-screen.ps1'), '-OutputPath', str(path)],
                                capture_output=True, text=True, timeout=12, creationflags=0x08000000)
        if result.returncode != 0 or not path.exists():
            raise RuntimeError('Capture failed')
        return screenshot_result(path, result.stdout.strip())
    if not allow_control:
        raise PermissionError('Control disabled')
    user32 = ctypes.windll.user32
    user32.SetProcessDPIAware()
    if action == 'click' and set(body) == {'action', 'x', 'y'}:
        x, y = body['x'], body['y']
        if type(x) is not int or type(y) is not int or not (0 <= x < user32.GetSystemMetrics(0) and 0 <= y < user32.GetSystemMetrics(1)):
            raise ValueError('Invalid coordinates')
        if not user32.SetCursorPos(x, y):
            raise RuntimeError('Pointer unavailable')
        user32.mouse_event(0x0002, 0, 0, 0, 0)
        user32.mouse_event(0x0004, 0, 0, 0, 0)
        return {'message': f'Klik kiri pada ({x}, {y}) dikirim ke Windows.'}
    if action == 'key' and set(body) == {'action', 'key'} and body['key'] in KEYS:
        key = KEYS[body['key']]
        user32.keybd_event(key, 0, 0, 0)
        user32.keybd_event(key, 0, 2, 0)
        return {'message': f"Tombol {body['key']} dikirim ke Windows."}
    raise ValueError('Unsupported action')


def screenshot_result(path, dimensions):
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    result = {'message': f'Screenshot layar utama laptop tersimpan: {path}\nUkuran: {dimensions} piksel. SHA-256: {digest}',
              'file': path.name, 'sha256': digest}
    if len(raw) <= 4 * 1024 * 1024:
        result['image'] = {'mimeType': 'image/png', 'data': base64.b64encode(raw).decode('ascii')}
        result['message'] += '\nGambar dikirim ke Chat dan mengikuti riwayat akun. Tidak otomatis dianalisis model AI.'
    else:
        result['message'] += '\nGambar melebihi batas lampiran 4 MiB; salinan lengkap tetap tersimpan di laptop.'
    return result


def make_handler(token, expires, allow_control=False):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def reply(self, status, data):
            encoded = json.dumps(data).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def do_POST(self):
            self.connection.settimeout(5)
            supplied = self.headers.get('Authorization', '').encode('utf-8')
            expected = ('Bearer ' + token).encode('utf-8')
            if self.headers.get('Origin') or not hmac.compare_digest(supplied, expected) or time.monotonic() > expires:
                return self.reply(403, {'error': 'Access denied'})
            if self.path != '/action':
                return self.reply(404, {'error': 'Not found'})
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 1024:
                    return self.reply(413, {'error': 'Invalid size'})
                body = json.loads(self.rfile.read(size))
                if not isinstance(body, dict):
                    raise ValueError()
                self.reply(200, perform(body, allow_control))
            except PermissionError:
                self.reply(403, {'error': 'Control disabled'})
            except Exception:
                self.reply(400, {'error': 'Action failed'})
    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--allow-control', action='store_true')
    parser.add_argument('--minutes', type=int, default=60)
    args = parser.parse_args()
    if not 1 <= args.minutes <= 120:
        parser.error('--minutes must be 1..120')
    token = token_from_env()
    expires = time.monotonic() + args.minutes * 60
    server = HTTPServer(('127.0.0.1', 4112), make_handler(token, expires, args.allow_control))
    server.timeout = 1
    print(f'Desktop bridge aktif {args.minutes} menit. Kontrol: {args.allow_control}. Ctrl+C untuk berhenti.', flush=True)
    try:
        while time.monotonic() < expires:
            server.handle_request()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
