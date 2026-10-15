#!/bin/sh
# via-env: OpenVPN menyetel $username dan $password. Kredensial yang benar
# dibaca dari file (OpenVPN membersihkan env lain saat menjalankan script).
. /etc/openvpn/creds
[ "$username" = "$VPN_USER" ] && [ "$password" = "$VPN_PASS" ] && exit 0
echo "auth gagal untuk '$username'" >&2
exit 1
