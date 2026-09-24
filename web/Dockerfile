# AI Hub — Web Layer container
#
# Serves almost the entire app UI (Login, Home, Chat, Bot/Agent Hub, Friends,
# Settings, Profile, VPN status) as a plain-JS SPA that the Flutter shell
# loads inside a single persistent WebView. Nothing sensitive (credentials,
# VPN config, mic access) ever lives here — see
# app/lib/screens/web_shell_screen.dart for the native side of the bridge.
FROM nginx:1.27-alpine

COPY public/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# 127.0.0.1, not localhost: this image only binds IPv4, and "localhost"
# resolving to ::1 inside the container made this healthcheck falsely fail
# even though the site was reachable fine from the host.
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
