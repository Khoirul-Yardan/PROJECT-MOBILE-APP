#!/bin/bash
# Klien WireGuard sungguhan: sambung, ping, lalu SSH LEWAT tunnel.
# Jalankan:  docker compose run --rm wg-client
set -e
cp /out/client.conf /etc/wireguard/wg0.conf
sed -i "s|^Endpoint = .*|Endpoint = wg-test:51820|; /^DNS/d" /etc/wireguard/wg0.conf
wg-quick up wg0
echo "== wg show"; wg show
echo "== ping server lewat tunnel"; ping -c 3 10.98.0.1
echo "== SSH lewat tunnel (tester)"
apk add --no-cache sshpass >/dev/null 2>&1 || true
sshpass -p "${SSH_PASS:-tester123}" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null tester@10.98.0.1 'echo "login OK sebagai $(whoami) di $(hostname)"; uname -sr'
echo "== SSH password salah (harus ditolak)"
sshpass -p salah ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 tester@10.98.0.1 true && echo "TIDAK DITOLAK (buruk)" || echo "ditolak (benar)"
