FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY src/ ./src/
COPY tests/ ./tests/

ENV NODE_ENV=production
ENV AUTH_PORT=5001

EXPOSE 5001

# Healthcheck
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5001/health').then(r => process.exit(r.ok ? 0 : 1))"

CMD ["node", "src/server.js"]
