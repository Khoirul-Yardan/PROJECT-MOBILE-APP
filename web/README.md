# AI Hub — Web Layer (Docker)

This container serves **almost the entire AI Hub UI** as a plain-JS single
page app: Login, Home, Chat (AI + Friends, unified), Bot/Agent Hub, Friends,
Settings, Profile, and the VPN status screen. It's loaded inside a single
persistent WebView by the Flutter shell (`app/lib/screens/web_shell_screen.dart`),
which draws only the bottom navigation bar natively.

**Ship the native app once, iterate on everything above forever without a
Play Store / App Store resubmission** — rebuild and redeploy this container
and every installed app picks up the change next time it opens that screen.

## What still isn't here (native, on purpose)

| Stays 100% native (Flutter) | Why |
|---|---|
| Microphone, wake-word ("Halo Jarvis"), TTS, the whole Bot BPJS recording screen | Reliability/latency and OS permission handling are meaningfully worse from a WebView's Web Audio API; this was an explicit product decision. |
| API keys & VPN credentials (Keystore/Keychain) | A WebView-held secret is a much bigger attack surface (XSS) than one that only ever exists for one bridge round-trip. |
| The actual VPN connection | Needs a native VPN/SSH plugin + OS-level permission; not simulate-able from a page. |
| Bottom navigation chrome | Gives Apple/Google review something unambiguously native — see the App Store risk note below. |

Everything else — including the **login screen and the Supabase session
itself** — lives here and runs the Supabase JS SDK directly in the page.

## Run locally

```sh
cd web
docker compose up -d --build
```

Serves on **http://localhost:8090**. You can open it directly in a browser
to preview/develop (the bridge-dependent bits — API keys, VPN, Bot BPJS —
just log a warning to the console and no-op when there's no native shell
listening).

Stop it with `docker compose down`.

## Structure

```
public/
├── index.html            single shell page (loads app.js as an ES module)
├── app.js                bootstraps Supabase, registers routes, auth guard
├── router.js              minimal hash router (#/home, #/chat, ...)
├── db.js                  Supabase JS SDK wrapper (auth, profiles, friends, messages, activity log)
├── ai.js                  calls OpenAI/Claude/Gemini directly, key fetched via the bridge
├── bridge.js               the Web ↔ Native contract (see below)
├── supabase-config.js      project URL + publishable anon key
├── ui.js                  tiny DOM/render helpers, no framework
├── style.css               design tokens shared with the Flutter theme
└── views/                 one file per screen (login, home, chat, bots, friends, vpn, vpn-config, settings, profile, activity)
```

No build step on purpose — plain ES modules, so this container stays "just
nginx serving static files," easy to build/deploy/update anywhere (a VPS,
Cloud Run, Fly.io, behind a reverse proxy).

## The bridge contract

Transport is `NativeBridge.postMessage(json)` (Web → Native, a
`JavascriptChannel` Flutter registers) for requests, and
`window.__nativeReply(id, json)` / `window.__nativeEvent(type, json)`
(Native → Web, via `runJavaScript`) for responses/events. `bridge.js` wraps
this as `Native.*` promises so views never touch the raw protocol.

| Call | Direction | Purpose |
|---|---|---|
| `get_api_key` / `save_api_key` / `has_api_key` | Web → Native (request/response) | Keystore/Keychain read/write |
| `get_vpn_config` / `save_vpn_config` | Web → Native (request/response) | VPN/SSH server details |
| `vpn_connect` / `vpn_disconnect` | Web → Native (request/response) | The (simulated) VPN toggle |
| `open_bot_bpjs` | Web → Native (fire) | Pushes the fully-native Bot BPJS screen |
| `sign_out` | Web → Native (fire) | Clears native's mirrored Supabase session |
| `route_changed` | Web → Native (fire) | Keeps the native bottom-nav highlight in sync |
| `session_changed` | Web → Native (fire) | Mirrors the web session's refresh token into native, so the native-only Bot BPJS screen can still attribute its `activity_log` writes to the signed-in user |

## App Store / Play Store risk — read this before shipping

A native shell that's "mostly a WebView" draws extra scrutiny under Apple's
**Guideline 4.7** in particular; Play Store is more lenient but has a
related policy. Mitigations already in this build:
- The bottom navigation is genuinely native chrome, not drawn by the page.
- Bot BPJS (microphone, wake-word, TTS) is a fully native screen with real
  OS permission prompts — substantial native functionality, not just window
  dressing.
- The WebView only ever points at **one whitelisted, first-party domain**
  (this container's) — document that domain for App Review.
- Credentials and the VPN connection are handled natively, never in the page.

Still budget time to write a clear App Review notes section explaining this
architecture if you're targeting iOS — reviewers reject on suspicion much
more than on the technical merits.

## Deploying somewhere real

Point `WebHubConfig.baseUrl` (`app/lib/services/web_hub_config.dart`) at
wherever this container ends up running. **HTTPS is required for
production** (NFR-09) — override the default with
`--dart-define=WEB_HUB_URL=https://your-domain` when building the app.
