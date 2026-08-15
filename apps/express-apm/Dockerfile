# --- EXPRESS APM SERVICE (pnpm + Vite) ---
FROM node:20-alpine

RUN corepack enable

WORKDIR /app

# Copy manifests first
COPY package.json pnpm-lock.yaml ./

# Install deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build TypeScript
RUN pnpm build

# Expose APM envs
ENV ELASTIC_APM_SERVICE_NAME=express-apm
ENV ELASTIC_APM_SERVER_URL=""
ENV ELASTIC_APM_ENVIRONMENT=development
ENV ELASTIC_APM_SECRET_TOKEN=""
ENV ELASTIC_APM_API_KEY=""

EXPOSE 3000

# Run via Vite (not node dist/server.js)
CMD ["pnpm", "dev", "--host"]
