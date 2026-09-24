/// Where the hybrid "Web Layer" container (see `web/`) is reachable from
/// this device. Defaults to the Docker Compose port on localhost.
///
/// A real Android device over USB reaches it via `adb reverse tcp:8090
/// tcp:8090` (run once per `flutter run` session — see `web/README.md`),
/// which forwards the *device's* localhost:8090 to the host machine's, so
/// plain `localhost` works there too — no emulator-only `10.0.2.2` alias or
/// LAN IP juggling needed.
///
/// For a shipped build, point this at the container's real, HTTPS domain
/// instead (NFR-09: WebView traffic must be HTTPS with a whitelisted
/// domain) — override via `--dart-define=WEB_HUB_URL=https://your-domain`.
class WebHubConfig {
  WebHubConfig._();

  static const _override = String.fromEnvironment('WEB_HUB_URL');

  static String get baseUrl =>
      _override.isNotEmpty ? _override : 'http://localhost:8090';
}
