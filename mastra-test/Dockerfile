FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
ENV MASTRA_HOST=0.0.0.0
EXPOSE 4111
HEALTHCHECK --interval=20s --timeout=5s --start-period=60s CMD node -e "fetch('http://127.0.0.1:4111/ai-hub/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "dev"]
