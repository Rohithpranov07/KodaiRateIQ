import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initCronJobs } from './src/cron/scheduler';

// ── Config ────────────────────────────────────────────────────
// Railway injects PORT at runtime (typically 8080).
// Default to 3000 for local dev.
const dev  = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT ?? '3000', 10);
// Always bind to all interfaces — required in Docker / Railway
const hostname = '0.0.0.0';

// ── Startup log ───────────────────────────────────────────────
console.log('================================================');
console.log(' KodaiRateIQ — starting');
console.log(` NODE_ENV : ${process.env.NODE_ENV ?? 'development'}`);
console.log(` PORT     : ${port}`);
console.log(` DB       : ${process.env.DATABASE_URL ? 'configured' : 'MISSING — check env vars'}`);
console.log('================================================');

if (!process.env.DATABASE_URL) {
  console.error('[FATAL] DATABASE_URL is not set. Server will start but DB calls will fail.');
}

// ── Boot Next.js ──────────────────────────────────────────────
const app    = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('[Server] Unhandled error for', req.url, err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    });

    server.once('error', (err) => {
      console.error('[Server] Fatal startup error:', err);
      process.exit(1);
    });

    server.listen(port, hostname, () => {
      console.log(`[Server] Ready → http://${hostname}:${port}`);
      console.log(`[Server] Public URL: ${process.env.NEXT_PUBLIC_APP_URL ?? '(not set)'}`);

      // ── Verify DB connectivity ──────────────────────────────
      import('./src/lib/db').then(({ default: prisma }) => {
        prisma.$queryRaw`SELECT 1`
          .then(() => console.log('[DB] Supabase connection verified ✓'))
          .catch((e: Error) => console.error('[DB] Connection failed:', e.message));
      });

      // ── Start cron scheduler ────────────────────────────────
      if (process.env.NODE_ENV === 'production') {
        try {
          console.log('[Cron] Initialising node-cron scheduler...');
          initCronJobs();
          console.log('[Cron] Scheduler active ✓');
        } catch (e) {
          console.error('[Cron] Scheduler boot failed (non-fatal):', e);
        }
      } else {
        console.log('[Cron] Skipped in development mode');
      }
    });
  })
  .catch((err) => {
    console.error('[Server] app.prepare() failed:', err);
    process.exit(1);
  });

// ── Global safety nets ────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled promise rejection:', reason);
  // Do NOT exit — keep the server alive
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception:', err);
  // Exit on truly fatal errors so Railway restarts cleanly
  process.exit(1);
});
