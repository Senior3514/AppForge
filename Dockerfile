# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
# Fonts: the branding kit and store screenshots render text (incl. Hebrew/Arabic) on the server.
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core fonts-noto-core fonts-noto-ui-core fonts-noto-cjk ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @appforge/web build
ENV NODE_ENV=production
EXPOSE 3000
# API (8787, internal) + web (3000, public). Put a reverse proxy with TLS in front of 3000.
CMD ["node", "scripts/run.mjs", "start"]
