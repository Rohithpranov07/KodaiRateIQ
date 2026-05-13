# ============================================================
# KodaiRateIQ — Production Dockerfile (Railway)
#
# Multi-stage build:
#   base    → Alpine + Playwright (Chromium) system deps
#   deps    → npm ci + prisma generate
#   builder → next build  +  esbuild server.ts → dist/server.js
#   runner  → minimal production image
#
# PORT is injected by Railway at runtime (typically 8080).
# NODE_ENV is forced to production in CMD regardless of Railway vars.
# ============================================================

# ── Base: Node 20 Alpine + system Chromium ────────────────────
FROM node:20-alpine AS base

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV NEXT_TELEMETRY_DISABLED=1

# ── Deps: install all node_modules + generate Prisma client ──
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci
RUN npx prisma generate

# ── Builder: Next.js build + compile server.ts → dist/server.js
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 1. Build the Next.js app (compiles pages, API routes → .next/)
RUN npm run build

# 2. Bundle server.ts + all src/** into a single dist/server.js
#    --packages=external: next/prisma/playwright stay as require()
#    esbuild resolves @/ aliases via tsconfig.json paths automatically
RUN npm run build:server

# ── Runner: lean production image ─────────────────────────────
FROM base AS runner
WORKDIR /app

# ── Environment defaults ──────────────────────────────────────
# These are defaults only. The CMD below overrides NODE_ENV to
# guarantee production mode even if Railway injects development.
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# ── Runtime node_modules ──────────────────────────────────────
# next, @prisma/client, playwright, node-cron are all require()'d
# by dist/server.js at runtime.
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules          ./node_modules
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules/.prisma  ./node_modules/.prisma

# ── Compiled Next.js application ─────────────────────────────
COPY --from=builder --chown=nextjs:nodejs /app/.next                 ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public                ./public

# ── Prisma schema (runtime introspection + query engine) ──────
COPY --from=builder --chown=nextjs:nodejs /app/prisma                ./prisma

# ── Compiled server entry point ───────────────────────────────
COPY --from=builder --chown=nextjs:nodejs /app/dist                  ./dist

# ── Project root markers (needed by Next.js server) ──────────
COPY --from=builder --chown=nextjs:nodejs /app/package.json          ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts        ./next.config.ts

USER nextjs

# ── Startup command ───────────────────────────────────────────
# Use sh -c to force NODE_ENV=production at process start.
# This overrides any value Railway may have injected (e.g. development).
# dist/server.js also sets process.env.NODE_ENV='production' internally
# for a belt-and-suspenders guarantee.
CMD ["sh", "-c", "NODE_ENV=production node dist/server.js"]
