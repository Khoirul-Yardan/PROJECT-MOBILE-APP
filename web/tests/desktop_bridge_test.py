"""Bridge security tests use fake actions: never capture or click the desktop."""
import importlib.util
import json
from pathlib import Path
from threading import Thread
import time
import unittest
from unittest.mock import patch
import urllib.request
import urllib.error
from http.server import HTTPServer

spec = importlib.util.spec_from_file_location('desktop_bridge', Path(__file__).resolve().parents[2] / 'mastra-test/scripts/desktop_bridge.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class BridgeTests(unittest.TestCase):
    def request(self, token='secret', origin=None, expires=None, path='/action', body=None):
        server = HTTPServer(('127.0.0.1', 0), bridge.make_handler('secret', expires or time.monotonic()+10))
        worker = Thread(target=server.handle_request, daemon=True)
        worker.start()
        try:
            headers = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}
            if origin:
                headers['Origin'] = origin
            request = urllib.request.Request(f'http://127.0.0.1:{server.server_port}' + path,
                                             json.dumps(body or {'action': 'screenshot'}).encode(), headers)
            try:
                with urllib.request.urlopen(request, timeout=2) as response:
                    return response.status
            except urllib.error.HTTPError as error:
                return error.code
        finally:
            worker.join(timeout=3)
            server.server_close()

    def test_unauthorized_origin_expiry_never_execute(self):
        with patch.object(bridge, 'perform') as action:
            self.assertEqual(self.request(token='bad'), 403)
            self.assertEqual(self.request(origin='http://evil.test'), 403)
            self.assertEqual(self.request(expires=time.monotonic()-1), 403)
            self.assertEqual(self.request(path='/other'), 404)
            action.assert_not_called()

    def test_authorized_screenshot_is_dispatched(self):
        with patch.object(bridge, 'perform', return_value={'message': 'fixture'}) as action:
            self.assertEqual(self.request(), 200)
            action.assert_called_once_with({'action': 'screenshot'}, False)

    def test_control_disabled_before_windows_access(self):
        with self.assertRaises(PermissionError):
            bridge.perform({'action': 'click', 'x': 1, 'y': 2}, False)


if __name__ == '__main__':
    unittest.main()
