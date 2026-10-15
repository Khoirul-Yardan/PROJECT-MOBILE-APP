#!/bin/bash
# Server WireGuard TIRUAN + sshd (terminal) untuk uji coba. Kunci dibuat saat
# start pertama dan disimpan di /state; client.conf ditulis ke /out.
set -e
mkdir -p /state /out
cd /state
[ -f srv.key ] || { wg genkey | tee srv.key | wg pubkey > srv.pub; }
[ -f cli.key ] || { wg genkey | tee cli.key | wg pubkey > cli.pub; }
[ -f psk.key ] || wg genpsk > psk.key
cat > /etc/wireguard/wg0.conf <<CFG
[Interface]
Address = 10.98.0.1/24
ListenPort = 51820
PrivateKey = $(cat srv.key)
[Peer]
PublicKey = $(cat cli.pub)
PresharedKey = $(cat psk.key)
AllowedIPs = 10.98.0.2/32
CFG
cat > /out/client.conf <<CFG
[Interface]
PrivateKey = $(cat cli.key)
Address = 10.98.0.2/24
DNS = 1.1.1.1
[Peer]
PublicKey = $(cat srv.pub)
PresharedKey = $(cat psk.key)
Endpoint = ${PUBLIC_HOST:-127.0.0.1}:51820
AllowedIPs = 10.98.0.0/24
PersistentKeepalive = 25
CFG
wg-quick up wg0
# sshd: user uji tester / tester123
ssh-keygen -A >/dev/null
adduser -D -s /bin/bash tester 2>/dev/null || true
echo "tester:${SSH_PASS:-tester123}" | chpasswd
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
echo "== WireGuard siap: pubkey server $(cat srv.pub)"
exec /usr/sbin/sshd -D -e
