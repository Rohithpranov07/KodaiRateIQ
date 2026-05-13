# ============================================================
# KodaiRateIQ — Production Dockerfile (Railway)
#
# Base: node:20-bookworm-slim (Debian glibc + OpenSSL 3.x)
#
# Chromium: Playwright BUNDLED browser via `playwright install chromium`
#   PLAYWRIGHT_BROWSERS_PATH=0  →  browser stored inside
#   node_modules/playwright-core/.local-browsers/
#   Copied to runner automatically with node_modules.
#   No separate /ms-playwright layer needed.
#
# Stages:
#   base    → Debian slim + all Playwright OS-level system deps (apt)
#   deps    → npm ci + playwright install + prisma generate
#   builder → next build + esbuild server.ts → dist/server.js
#   runner  → minimal production image
# ============================================================

# ── Base: Node 20 Debian bookworm-slim ───────────────────────
FROM node:20-bookworm-slim AS base

# All system-level libraries Playwright's Chromium requires.
# Running `playwright install-deps` needs npm installed first so we
# list packages explicitly here — covers everything Chromium needs
# on Debian bookworm including X11 protocol and audio stubs.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    # NSS / NSPR — TLS, crypto
    libnss3 \
    libnspr4 \
    # DBus
    libdbus-1-3 \
    # ATK accessibility tree
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libatspi2.0-0 \
    # CUPS printing (Chromium links against it even headless)
    libcups2 \
    # DRM / GPU buffer
    libdrm2 \
    libgbm1 \
    # X11 protocol (required even in headless mode)
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    # Pango / Cairo rendering
    libpango-1.0-0 \
    libcairo2 \
    # GLib
    libglib2.0-0 \
    # Sound stub (Chromium links against ALSA even headless)
    libasound2 \
    # Fonts
    fonts-freefont-ttf \
    fonts-liberation \
 && rm -rf /var/lib/apt/lists/*

# PLAYWRIGHT_BROWSERS_PATH=0 is Playwright's special value meaning:
# "install browsers inside node_modules/playwright-core/.local-browsers/"
# This means copying node_modules → runner automatically brings the browser.
# No separate /ms-playwright COPY step needed.
ENV PLAYWRIGHT_BROWSERS_PATH=0
ENV NEXT_TELEMETRY_DISABLED=1

# ── Deps: npm ci + Playwright browser + Prisma client ────────
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install ALL node_modules (devDeps included — esbuild/tsx live there)
RUN npm ci

# Install Playwright OS-level deps via its own resolver (belt-and-suspenders
# on top of the manual apt list above — ensures nothing is missed).
RUN npx playwright install-deps chromium

# Download the version-matched bundled Chromium browser.
# Installs to node_modules/playwright-core/.local-browsers/ (BROWSERS_PATH=0)
RUN npx playwright install chromium

# Generate Prisma client → debian-openssl-3.0.x engine
RUN npx prisma generate

# ── Builder: Next.js build + compile server.ts ───────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 1. Next.js app build (.next/)
RUN npm run build

# 2. Bundle server.ts + src/** → dist/server.js (plain CJS, no tsx at runtime)
RUN npm run build:server

# ── Runner: production image ──────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PLAYWRIGHT_BROWSERS_PATH=0
# PORT intentionally unset — Railway injects it at container start

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# node_modules includes:
#   • next, @prisma/client, playwright, node-cron (runtime deps)
#   • playwright-core/.local-browsers/chromium-* (bundled browser)
#   • Prisma query engine: libquery_engine-debian-openssl-3.0.x.so.node
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules    ./node_modules

# Compiled Next.js output (all pages + API routes)
COPY --from=builder --chown=nextjs:nodejs /app/.next           ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

# Prisma schema (runtime introspection)
COPY --from=builder --chown=nextjs:nodejs /app/prisma          ./prisma

# Compiled server bundle (plain CJS — no tsx required)
COPY --from=builder --chown=nextjs:nodejs /app/dist            ./dist

# Project root markers
COPY --from=builder --chown=nextjs:nodejs /app/package.json    ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts  ./next.config.ts

USER nextjs

# sh -c forces NODE_ENV=production regardless of what Railway injected.
# dist/server.js also sets it internally as a belt-and-suspenders guard.
CMD ["sh", "-c", "NODE_ENV=production node dist/server.js"]
