#!/bin/bash
# Uji profil .ovpn dari dalam jaringan docker (klien OpenVPN sungguhan).
# Pakai:  ./test-client.sh [user] [pass] [keypass]
U=${1:-tester}; P=${2:-tester123}; K=${3:-keypass123}
cd "$(dirname "$0")"
NET=$(docker inspect ovpn-test --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')
MSYS_NO_PATHCONV=1 docker run --rm --cap-add NET_ADMIN --device /dev/net/tun --network "$NET" \
  -v "$PWD/out:/out:ro" -e U="$U" -e P="$P" -e K="$K" alpine:3.20 sh -c '
apk add --no-cache openvpn >/dev/null 2>&1
sed "s/^remote .*/remote ovpn-test 1194 tcp/" /out/kp-la-test.ovpn > /tmp/c.ovpn
printf "%s\n%s\n" "$U" "$P" > /tmp/auth; printf "%s\n" "$K" > /tmp/key
timeout 25 openvpn --config /tmp/c.ovpn --auth-user-pass /tmp/auth --askpass /tmp/key --verb 3 > /tmp/log 2>&1 &
sleep 14
grep -E "Initialization Sequence Completed|AUTH_FAILED|Bad decrypt|private key|Cannot load|TLS Error|PUSH_REPLY|Options error" /tmp/log | head
ip addr show tun0 2>/dev/null | grep inet && ping -c2 -W2 10.99.0.1 | tail -3
'
