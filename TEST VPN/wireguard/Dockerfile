FROM alpine:3.20
RUN apk add --no-cache wireguard-tools iptables openssh iproute2 iputils bash
COPY entrypoint.sh test-client.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh
EXPOSE 51820/udp 22/tcp
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
