FROM node:20-alpine

WORKDIR /app

# Install security updates
RUN apk upgrade --no-cache

# Install dependencies and remove npm/cache to prevent Trivy CVEs
COPY package*.json ./
RUN npm install --omit=dev && \
    npm cache clean --force && \
    rm -rf /root/.npm /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY src/ ./src/
COPY tests/ ./tests/

ENV NODE_ENV=production
ENV BUDGET_PORT=5005

EXPOSE 5005

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5005/health').then(r => process.exit(r.ok ? 0 : 1))"

CMD ["node", "src/server.js"]
