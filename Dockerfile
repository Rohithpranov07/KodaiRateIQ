# ============================================================
# KodaiRateIQ — Production Dockerfile (Railway)
#
# Base: node:20-bookworm-slim (Debian, glibc, OpenSSL 3.x)
# NOT Alpine — Alpine uses musl libc which is incompatible with
# Prisma's linux-musl engine on Railway's OpenSSL 1.1 runtime.
# Debian bookworm ships OpenSSL 3.x and glibc, fully compatible.
#
# Multi-stage build:
#   base    → Debian slim + Playwright (Chromium) system deps
#   deps    → npm ci + prisma generate (generates linux-x64 engine)
#   builder → next build + esbuild server.ts → dist/server.js
#   runner  → lean production image
#
# PORT is injected by Railway at runtime (typically 8080).
# NODE_ENV is forced to production in CMD + server.ts.
# ============================================================

# ── Base: Node 20 Debian bookworm-slim ───────────────────────
FROM node:20-bookworm-slim AS base

# Install Chromium + runtime dependencies via apt.
# Debian bookworm's chromium package pulls all required libs
# (libnss3, libgbm1, libatk, libxcomposite, etc.) automatically.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-freefont-ttf \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Point Playwright to the system Chromium (no browser download).
# Debian bookworm chromium binary is at /usr/bin/chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV NEXT_TELEMETRY_DISABLED=1

# ── Deps: install node_modules + generate Prisma client ──────
# Running inside node:20-bookworm-slim ensures prisma generate
# produces linux-x64-openssl-3.0.x engine, NOT linux-musl.
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci
RUN npx prisma generate

# ── Builder: compile Next.js + bundle server.ts ───────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 1. Build Next.js app (pages + API routes → .next/)
RUN npm run build

# 2. Bundle server.ts + src/** → dist/server.js (plain CJS)
#    --packages=external: next/prisma/playwright stay as require()
RUN npm run build:server

# ── Runner: lean production image ────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
# PORT intentionally unset — Railway injects it at container start

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Runtime node_modules (next, @prisma/client, playwright, node-cron)
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules         ./node_modules

# Compiled Next.js output (all API routes, pages, assets)
COPY --from=builder --chown=nextjs:nodejs /app/.next                ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public               ./public

# Prisma schema + generated client (linux-x64-openssl-3.0.x engine)
COPY --from=builder --chown=nextjs:nodejs /app/prisma               ./prisma

# Compiled server entry point (150kb CJS bundle, no tsx needed)
COPY --from=builder --chown=nextjs:nodejs /app/dist                 ./dist

# Project root markers
COPY --from=builder --chown=nextjs:nodejs /app/package.json         ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts       ./next.config.ts

USER nextjs

# Force NODE_ENV=production at process start — overrides any value
# Railway may have injected. dist/server.js also sets it internally.
CMD ["sh", "-c", "NODE_ENV=production node dist/server.js"]
