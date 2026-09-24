# AI Hub

A hybrid app: a thin native Flutter shell wraps almost the entire UI, served
from the `../web/` Docker container inside a single persistent WebView. The
goal — **ship to Play Store / App Store once, then iterate on the app by
redeploying the container, no store resubmission needed.**

## Run

```sh
cd ../web && docker compose up -d --build   # the web layer this app loads
cd ../app
flutter pub get
flutter run
```

Defaults to `http://localhost:8090` (or `http://10.0.2.2:8090` on the
Android emulator). Override with `--dart-define=WEB_HUB_URL=https://your-domain`
for a real deployment.

## Validate

```sh
flutter analyze --no-pub
flutter test --no-pub
flutter build web --no-pub
```

## What's native vs. what's in the web container

**Native (this Flutter app, `lib/`):**
- `screens/splash_screen.dart` — branding only, then hands off.
- `screens/web_shell_screen.dart` — the whole shell: a persistent WebView +
  native bottom nav (Home/Chat/Bot/VPN/More) + the bridge implementation.
- `screens/bot_bpjs_screen.dart` — Bot BPJS's full voice-session flow
  (wake-word, recording, TTS, doctor picker, review). Kept 100% native on
  purpose: a WebView's Web Audio API is meaningfully less reliable for
  mic/wake-word than a native plugin, and OS permission prompts need to be
  the real thing.
- `services/ai_provider_service.dart` — API key storage only (Keystore/Keychain);
  the actual chat request happens in the web layer's JS.
- `services/vpn_config_service.dart` — VPN/SSH server details, same reasoning.
- `services/supabase_service.dart` — mirrors the web layer's session so the
  native-only Bot BPJS screen can still write `activity_log` rows; it does
  **not** own the "real" session or render any auth UI.

**Web (`../web/`, see its README for the full bridge contract):** Login,
Home, Chat (AI + Friends, unified, with the AI-while-chatting-with-a-friend
toggle), Bot/Agent Hub catalog, Friends, Settings, Profile, Activity Log,
and the VPN status screen. Runs the Supabase JS SDK directly — auth,
profiles, friendships, messages, and activity logging are all client-side
Supabase calls from the page, scoped by Row Level Security exactly like the
native client used to be.

Credentials (API keys, VPN config) never live in the web layer beyond a
single bridge round-trip — see `web/README.md`'s bridge table.

## Supabase setup

Run `supabase/schema.sql` once in the Supabase Dashboard (Project → SQL
Editor → New query) — it's safe to re-run. It creates `activity_log`, the
Friend System tables (`profiles` — with `role`/`bio` — and `friendships`),
and `messages` (1:1 direct messages) with Row Level Security. Enable Email
sign-ups (Authentication → Providers → Email) since the app requires a real
account.

## App Store / Play Store risk

Read `../web/README.md`'s "App Store / Play Store risk" section before
shipping to iOS — a mostly-WebView shell draws extra App Review scrutiny
(Guideline 4.7). The mitigations already built in (native bottom nav, fully
native Bot BPJS, single whitelisted domain, credentials/VPN native-only) are
there specifically to address that.
