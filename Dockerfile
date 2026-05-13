# ============================================================
# KodaiRateIQ — Production Dockerfile (Railway)
#
# Stages:
#   base    → Alpine + Playwright (Chromium) system deps
#   deps    → npm ci + prisma generate
#   builder → next build
#   runner  → lean production image
#
# PORT is injected by Railway at runtime — NOT hardcoded here.
# CMD: tsx server.ts  (Next.js HTTP + node-cron scheduler)
# ============================================================

# ── Base: Node 20 Alpine + Playwright/Chromium system libs ───
FROM node:20-alpine AS base

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Use system Chromium — no browser download needed
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV NEXT_TELEMETRY_DISABLED=1

# ── Deps: install node_modules + generate Prisma client ──────
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

# npm ci installs all deps including devDeps (tsx lives there)
RUN npm ci

RUN npx prisma generate

# ── Builder: compile Next.js ──────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ── Runner: production image ──────────────────────────────────
FROM base AS runner
WORKDIR /app

# NODE_ENV and telemetry
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Bind address — always 0.0.0.0 inside Docker
ENV HOSTNAME=0.0.0.0

# PORT is intentionally NOT set here.
# Railway injects PORT at container startup (typically 8080).
# server.ts reads: parseInt(process.env.PORT ?? '3000', 10)

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# node_modules (tsx, node-cron, prisma, playwright, next, ...)
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules  ./node_modules

# Compiled Next.js output
COPY --from=builder --chown=nextjs:nodejs /app/.next         ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public        ./public

# App source + prisma schema (needed at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/src           ./src
COPY --from=builder --chown=nextjs:nodejs /app/prisma        ./prisma

# Server entry point + TypeScript config
COPY --from=builder --chown=nextjs:nodejs /app/server.ts     ./server.ts
COPY --from=builder --chown=nextjs:nodejs /app/package.json  ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts

USER nextjs

# No EXPOSE — Railway assigns and injects PORT dynamically.
# tsx runs server.ts which starts Next.js + cron scheduler.
CMD ["node_modules/.bin/tsx", "server.ts"]
