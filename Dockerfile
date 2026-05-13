# ============================================================
# KodaiRateIQ — Production Dockerfile (Railway)
#
# Base: node:20-bookworm-slim (Debian glibc + OpenSSL 3.x)
#
# Chromium strategy: Playwright BUNDLED browser (NOT system apt pkg)
#   - apt chromium caused crashpad / SIGTRAP in Railway containers
#   - Playwright's own Chromium is matched exactly to the installed
#     playwright version, avoiding ABI mismatches
#   - System deps for Playwright installed manually via apt
#   - Browser downloaded once in `deps` stage, copied to `runner`
#
# Stages:
#   base    → Debian slim + all Playwright system-level OS deps
#   deps    → npm ci + prisma generate + playwright install chromium
#   builder → next build + esbuild server.ts → dist/server.js
#   runner  → minimal production image
# ============================================================

# ── Base: Node 20 Debian bookworm-slim ───────────────────────
FROM node:20-bookworm-slim AS base

# Playwright Chromium requires these system libraries.
# Listed explicitly to avoid pulling unnecessary packages.
# Source: https://playwright.dev/docs/browsers#install-system-dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core system libs
    ca-certificates \
    wget \
    # NSS / NSPR (TLS, crypto)
    libnss3 \
    libnspr4 \
    # DBus
    libdbus-1-3 \
    # ATK accessibility
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libatspi2.0-0 \
    # CUPS printing
    libcups2 \
    # DRM / graphics
    libdrm2 \
    libgbm1 \
    # X11 compositing
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    # Fonts & rendering
    libpango-1.0-0 \
    libcairo2 \
    fonts-freefont-ttf \
    # Sound (needed by Chromium even headless)
    libasound2 \
    # GLib
    libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

# Playwright downloads browsers here (shared across all stages)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NEXT_TELEMETRY_DISABLED=1

# ── Deps: npm install + prisma generate + playwright browser ─
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install all node_modules (including devDeps — esbuild/tsx live there)
RUN npm ci

# Generate Prisma client — produces debian-openssl-3.0.x engine
RUN npx prisma generate

# Download Playwright's bundled Chromium to PLAYWRIGHT_BROWSERS_PATH
# This is the version-matched browser for the installed playwright package.
# Do NOT use system Chromium — it caused SIGTRAP crashes on Railway.
RUN npx playwright install chromium

# ── Builder: compile Next.js + bundle server.ts ──────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build
RUN npm run build:server

# ── Runner: lean production image ────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# PORT intentionally unset — Railway injects it at runtime

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Runtime node_modules (next, @prisma/client, playwright, node-cron)
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules      ./node_modules

# Playwright bundled Chromium browser (downloaded in deps stage)
COPY --from=deps    --chown=nextjs:nodejs /ms-playwright         /ms-playwright

# Compiled Next.js output
COPY --from=builder --chown=nextjs:nodejs /app/.next             ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public            ./public

# Prisma schema + generated client
COPY --from=builder --chown=nextjs:nodejs /app/prisma            ./prisma

# Compiled server bundle (plain CJS, no tsx needed at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/dist              ./dist

# Project root markers
COPY --from=builder --chown=nextjs:nodejs /app/package.json      ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts    ./next.config.ts

USER nextjs

CMD ["sh", "-c", "NODE_ENV=production node dist/server.js"]
