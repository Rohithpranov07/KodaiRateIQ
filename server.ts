// ============================================================
// PRODUCTION GUARD — must be the very first lines.
// Railway may not inject NODE_ENV=production automatically.
// Forcing it here ensures Next.js and all libraries (Prisma,
// node-cron, etc.) run in production mode regardless of the
// host environment configuration.
// ============================================================
if (process.env.NODE_ENV !== 'development') {
  // Force production mode — Railway may not inject NODE_ENV=production.
  // Cast needed because @types/node marks NODE_ENV as readonly.
  (process.env as Record<string, string>).NODE_ENV = 'production';
}

import { createServer } from 'http';
import { parse } from 'url';
import path from 'path';
import next from 'next';
import { initCronJobs } from './src/cron/scheduler';

// ── Config ────────────────────────────────────────────────────
// Railway injects PORT at runtime (typically 8080).
const port     = parseInt(process.env.PORT ?? '3000', 10);
const hostname = '0.0.0.0';           // always bind all interfaces in Docker
const dir      = path.resolve('.');    // project root = WORKDIR (/app)

// In the compiled dist/server.js, dev is ALWAYS false.
// This file is only built for production. Dev mode uses tsx server.ts directly.
const dev = false;

// ── Startup banner ────────────────────────────────────────────
console.log('================================================');
console.log(' KodaiRateIQ — starting');
console.log(` NODE_ENV : ${process.env.NODE_ENV}`);
console.log(` PORT     : ${port}`);
console.log(` HOSTNAME : ${hostname}`);
console.log(` DIR      : ${dir}`);
console.log(` DB       : ${process.env.DATABASE_URL ? 'configured' : 'MISSING — check env vars'}`);
console.log('================================================');

if (!process.env.DATABASE_URL) {
  console.error('[WARN] DATABASE_URL is not set. DB calls will fail until set.');
}

// ── Boot Next.js ──────────────────────────────────────────────
const app    = next({ dev, hostname, port, dir });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('[Server] Unhandled request error for', req.url, err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    });

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server] Port ${port} is already in use`);
      } else {
        console.error('[Server] Fatal startup error:', err);
      }
      process.exit(1);
    });

    server.listen(port, hostname, () => {
      console.log(`[Server] ✓ Ready → http://${hostname}:${port}`);
      console.log(`[Server] Public URL: ${process.env.NEXT_PUBLIC_APP_URL ?? '(NEXT_PUBLIC_APP_URL not set)'}`);

      // ── Supabase connectivity check ─────────────────────────
      import('./src/lib/db')
        .then(({ default: prisma }) =>
          (prisma as any).$queryRaw`SELECT 1`
            .then(() => console.log('[DB] ✓ Supabase connected'))
            .catch((e: Error) => console.error('[DB] ✗ Connection failed:', e.message))
        )
        .catch((e: Error) => console.error('[DB] ✗ Failed to load db module:', e.message));

      // ── Cron scheduler ──────────────────────────────────────
      try {
        console.log('[Cron] Initialising scraping scheduler...');
        initCronJobs();
        console.log('[Cron] ✓ Scheduler active (6am / 12pm / 6pm IST)');
      } catch (e) {
        // Non-fatal — web server still runs if cron fails
        console.error('[Cron] ✗ Scheduler boot failed (non-fatal):', e);
      }
    });
  })
  .catch((err: Error) => {
    console.error('[Server] ✗ app.prepare() failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  });

// ── Global safety nets ────────────────────────────────────────
process.on('unhandledRejection', (reason: unknown) => {
  // Log but don't crash — keeps the server alive for transient failures
  console.error('[Process] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err: Error) => {
  console.error('[Process] Uncaught exception:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('[Process] SIGTERM received — shutting down gracefully');
  process.exit(0);
});
