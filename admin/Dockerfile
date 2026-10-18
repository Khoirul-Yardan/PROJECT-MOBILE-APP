# AI Hub — Panel Admin. Node tanpa dependensi npm (tidak ada `npm install`).
FROM node:20-alpine
WORKDIR /app
COPY server.js ./
COPY lib ./lib
COPY public ./public
ENV PORT=8095 NODE_ENV=production
EXPOSE 8095
# 127.0.0.1, bukan localhost: container hanya bind IPv4 (lihat web/Dockerfile).
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:${PORT}/healthz >/dev/null || exit 1
USER node
CMD ["node", "server.js"]
