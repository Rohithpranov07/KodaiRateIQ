# ============================================================
# KodaiRateIQ — Production Dockerfile (Railway)
#
# Multi-stage build:
#   base    → Alpine + Playwright (Chromium) system deps
#   deps    → npm ci + prisma generate
#   builder → next build + esbuild server.ts → dist/server.js
#   runner  → lean production image, node dist/server.js
#
# PORT is injected by Railway at runtime (typically 8080).
# server.ts reads process.env.PORT and binds to 0.0.0.0.
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

# ── Deps: install node_modules + generate Prisma client ──────
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci
RUN npx prisma generate

# ── Builder: compile Next.js app + compile server.ts → JS ────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 1. Build the Next.js application (.next/)
RUN npm run build

# 2. Bundle server.ts + all src/** imports into dist/server.js
#    --packages=external keeps node_modules as require() calls.
#    esbuild resolves @/ aliases via tsconfig.json paths.
RUN npm run build:server

# ── Runner: minimal production image ─────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
# PORT is NOT hardcoded — Railway injects it at startup.

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Runtime node_modules (next, prisma, playwright, node-cron, ...)
# server.ts imports these as require() — they must be present.
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules  ./node_modules

# Prisma generated client (must match the one generated in deps)
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules/.prisma \
                                                              ./node_modules/.prisma

# Compiled Next.js output
COPY --from=builder --chown=nextjs:nodejs /app/.next         ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public        ./public

# Prisma schema (needed for runtime introspection / migrations)
COPY --from=builder --chown=nextjs:nodejs /app/prisma        ./prisma

# Compiled server bundle — the only thing we need to run
COPY --from=builder --chown=nextjs:nodejs /app/dist          ./dist

# package.json needed by Next.js for project root resolution
COPY --from=builder --chown=nextjs:nodejs /app/package.json  ./package.json

USER nextjs

# Railway injects PORT; no EXPOSE needed (Railway detects it).
CMD ["node", "dist/server.js"]
