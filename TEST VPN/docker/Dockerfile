FROM alpine:3.20
RUN apk add --no-cache openvpn openssl iptables bash openssh-server shadow
COPY entrypoint.sh /entrypoint.sh
COPY auth.sh /etc/openvpn/auth.sh
RUN sed -i 's/\r$//' /entrypoint.sh /etc/openvpn/auth.sh && chmod +x /entrypoint.sh /etc/openvpn/auth.sh
EXPOSE 1194/tcp
# sshd hanya didengarkan di 10.99.0.1 (di dalam tunnel) - tidak dipublish ke host
ENTRYPOINT ["/entrypoint.sh"]
