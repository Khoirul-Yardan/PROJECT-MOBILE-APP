#!/bin/bash
set -e
PKI=/pki
mkdir -p $PKI /out
cd $PKI
if [ ! -f ca.crt ]; then
  echo "[ovpn-test] membuat PKI baru..."
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=TestVPN-CA" -keyout ca.key -out ca.crt 2>/dev/null
  cat > ext-server.cnf <<X
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
X
  cat > ext-client.cnf <<X
basicConstraints=CA:FALSE
keyUsage=digitalSignature
extendedKeyUsage=clientAuth
X
  openssl req -newkey rsa:2048 -nodes -subj "/CN=test-server" -keyout server.key -out server.csr 2>/dev/null
  openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 3650 -extfile ext-server.cnf -out server.crt 2>/dev/null
  # key klien terenkripsi, seperti "ENCRYPTED PRIVATE KEY" di profil asli
  openssl req -newkey rsa:2048 -subj "/CN=test-client" -passout "pass:$KEY_PASS" -keyout client.key -out client.csr 2>/dev/null
  openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 3650 -extfile ext-client.cnf -out client.crt 2>/dev/null
  openssl dhparam -out dh.pem 2048 2>/dev/null
  openvpn --genkey secret ta.key 2>/dev/null || true
fi

# tulis ulang .ovpn tiap start (PUBLIC_HOST bisa berubah)
cat > /out/kp-la-test.ovpn <<X
client
dev tun
remote $PUBLIC_HOST 1194 tcp
tun-mtu 1500
tls-client
nobind
user nobody
group nogroup
ping 15
ping-restart 45
persist-tun
persist-key
mute-replay-warnings
verb 3
cipher AES-128-CBC
auth SHA512
pull
auth-user-pass
connect-retry 1
reneg-sec 3600
remote-cert-tls server
<ca>
$(cat ca.crt)
</ca>
<cert>
$(openssl x509 -in client.crt)
</cert>
<key>
$(openssl pkcs8 -topk8 -v2 aes-256-cbc -in client.key -passin "pass:$KEY_PASS" -passout "pass:$KEY_PASS")
</key>
X
echo "[ovpn-test] profil klien: /out/kp-la-test.ovpn (user=$VPN_USER pass=$VPN_PASS keypass=$KEY_PASS)"

mkdir -p /dev/net
[ -c /dev/net/tun ] || mknod /dev/net/tun c 10 200
iptables -t nat -A POSTROUTING -s 10.99.0.0/24 -o eth0 -j MASQUERADE 2>/dev/null || true

printf "VPN_USER='%s'
VPN_PASS='%s'
" "$VPN_USER" "$VPN_PASS" > /etc/openvpn/creds
chmod 644 /etc/openvpn/creds
# --- SSH uji, hanya terjangkau lewat tunnel VPN (10.99.0.1:22) ---
id "$VPN_USER" >/dev/null 2>&1 || adduser -D -s /bin/bash "$VPN_USER"
echo "$VPN_USER:$VPN_PASS" | chpasswd
ssh-keygen -A >/dev/null 2>&1
mkdir -p /run/sshd
# tun0 baru ada setelah openvpn jalan; sshd dijalankan setelah itu
( for i in $(seq 1 30); do ip addr show tun0 2>/dev/null | grep -q 10.99.0.1 && break; sleep 1; done
  /usr/sbin/sshd -o ListenAddress=10.99.0.1 -o PasswordAuthentication=yes -o PermitRootLogin=no     && echo "[ovpn-test] sshd aktif di 10.99.0.1:22 (user=$VPN_USER pass=$VPN_PASS)" ) &

exec openvpn --dev tun --proto tcp --port 1194 --server 10.99.0.0 255.255.255.0 \
  --ca ca.crt --cert server.crt --key server.key --dh dh.pem \
  --cipher AES-128-CBC --data-ciphers AES-256-GCM:AES-128-GCM:AES-128-CBC --data-ciphers-fallback AES-128-CBC \
  --auth SHA512 --keepalive 15 45 --persist-key --persist-tun \
  --script-security 3 --auth-user-pass-verify /etc/openvpn/auth.sh via-env \
  --push "route 10.99.0.0 255.255.255.0" --push "ping 15" \
  --reneg-sec 3600 --verb 3 --user nobody --group nogroup
