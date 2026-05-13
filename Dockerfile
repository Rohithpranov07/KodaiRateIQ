# ============================================================
# KodaiRateIQ — Production Dockerfile (Railway)
#
# Multi-stage build:
#   base    — Alpine + Playwright system deps
#   deps    — npm install + prisma generate
#   builder — next build
#   runner  — lean production image
#
# Startup: tsx server.ts
#   → boots Next.js HTTP server
#   → initialises node-cron scraping scheduler (3× daily IST)
# ============================================================

# ── Base: Node 20 Alpine + Playwright browser deps ───────────
FROM node:20-alpine AS base

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Playwright to use the system Chromium (no download needed)
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV NEXT_TELEMETRY_DISABLED=1

# ── Deps: install all node_modules + generate Prisma client ──
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install ALL deps (including devDeps — tsx is in devDeps)
RUN npm ci

# Generate Prisma client against the schema
RUN npx prisma generate

# ── Builder: compile Next.js app ──────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ── Runner: minimal production image ─────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# All node_modules (tsx, node-cron, prisma, playwright, etc.)
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules ./node_modules

# Compiled Next.js output
COPY --from=builder --chown=nextjs:nodejs /app/.next   ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public  ./public

# Application source needed at runtime by server.ts
COPY --from=builder --chown=nextjs:nodejs /app/src     ./src
COPY --from=builder --chown=nextjs:nodejs /app/prisma  ./prisma

# Custom server entry point + config files
COPY --from=builder --chown=nextjs:nodejs /app/server.ts    ./server.ts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

USER nextjs

EXPOSE 3000

# tsx executes server.ts → starts Next.js + node-cron scheduler
CMD ["node_modules/.bin/tsx", "server.ts"]
