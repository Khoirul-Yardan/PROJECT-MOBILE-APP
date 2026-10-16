#!/bin/sh
# Single-container deployments (Fly.io trial, Railway): run the relay inside
# the web container so there is no second machine to stop/lose DNS. nginx
# proxies /relay/ to it on loopback (RELAY_URL=http://127.0.0.1:8091).
# Runs from /docker-entrypoint.d/ before nginx starts; skipped unless
# RUN_RELAY=1 (docker compose keeps its separate relay service).
[ "$RUN_RELAY" = "1" ] || exit 0
PORT=8091 node /relay/server.js &
# Block nginx until the relay answers, so the first request after a cold
# start does not hit a closed port (502).
i=0
while [ $i -lt 50 ]; do
  nc -z 127.0.0.1 8091 2>/dev/null && break
  i=$((i+1)); sleep 0.1
done
