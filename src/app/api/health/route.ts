// ============================================================
// KodaiRateIQ — Health Check API
// GET /api/health
//
// Returns:
//   status    "ok" | "degraded"
//   db        "connected" | "error: <message>"
//   env       presence of critical env vars
//   uptime    process uptime in seconds
//   timestamp ISO timestamp
// ============================================================

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const startedAt = Date.now();

  // ── DB ping ───────────────────────────────────────────────
  let dbStatus: string;
  let dbLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
    dbStatus = 'connected';
  } catch (err: any) {
    dbStatus = `error: ${err?.message ?? 'unknown'}`;
  }

  // ── Env var presence check ────────────────────────────────
  const env = {
    DATABASE_URL:    !!process.env.DATABASE_URL,
    DIRECT_URL:      !!process.env.DIRECT_URL,
    MIMO_API_KEY:    !!process.env.MIMO_API_KEY,
    CRON_SECRET:     !!process.env.CRON_SECRET,
    NODE_ENV:        process.env.NODE_ENV ?? 'unknown',
    PORT:            process.env.PORT ?? '(not set — using default)',
  };

  // ── Latest scrape log ─────────────────────────────────────
  let lastScrape: { status: string; createdAt: Date; errorMessage: string | null } | null = null;
  try {
    lastScrape = await prisma.scrapeLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { status: true, createdAt: true, errorMessage: true },
    });
  } catch {
    // non-fatal — DB might not have logs yet
  }

  const isHealthy = dbStatus === 'connected';

  const body = {
    status:   isHealthy ? 'ok' : 'degraded',
    db:       dbStatus,
    dbLatencyMs,
    env,
    uptime:   Math.round(process.uptime()),
    lastScrape: lastScrape
      ? { status: lastScrape.status, at: lastScrape.createdAt, error: lastScrape.errorMessage }
      : null,
    responseMs: Date.now() - startedAt,
    timestamp:  new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
