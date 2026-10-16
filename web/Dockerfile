# AI Hub — Web Layer container
#
# Serves almost the entire app UI (Login, Home, Chat, Bot/Agent Hub, Friends,
# Settings, Profile, VPN status) as a plain-JS SPA that the Flutter shell
# loads inside a single persistent WebView. Nothing sensitive (credentials,
# VPN config, mic access) ever lives here — see
# app/lib/screens/web_shell_screen.dart for the native side of the bridge.
FROM nginx:1.27-alpine

RUN apk add --no-cache nodejs
COPY relay/server.js /relay/server.js
COPY start-relay.sh /docker-entrypoint.d/40-start-relay.sh
RUN chmod +x /docker-entrypoint.d/40-start-relay.sh
COPY public/ /usr/share/nginx/html/
# Rendered to /etc/nginx/conf.d/default.conf at start by the base image's
# envsubst step, so the same image works under docker compose (relay by
# service name, port 80) and on Railway (PORT injected, relay over the
# private network via RELAY_URL).
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV PORT=80     RELAY_URL=http://relay:8091     NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

EXPOSE 80

# 127.0.0.1, not localhost: this image only binds IPv4, and "localhost"
# resolving to ::1 inside the container made this healthcheck falsely fail
# even though the site was reachable fine from the host.
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://127.0.0.1:${PORT}/ >/dev/null || exit 1
