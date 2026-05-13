// ============================================================
// ⚠️  TEMPORARY DEBUG ROUTE — REMOVE BEFORE GA LAUNCH
//
// GET /api/debug/run-scrape
//
// Manually triggers the full OTA scraping pipeline:
//   1. Scrapes all 13 OTA sources for all 5 hotels
//   2. Cross-verifies MAP rates → selects lowest verified BAR
//   3. Writes DailyRate, CompetitorSnapshot, OtaBarAudit to Supabase
//   4. Updates RateHistory with day-over-day deltas
//   5. Generates AI pricing recommendation
//   6. Returns a detailed JSON report
//
// Auth: ?secret=<CRON_SECRET> (required in production)
//
// Usage:
//   curl "https://<host>/api/debug/run-scrape?secret=<CRON_SECRET>"
//
// TO REMOVE: delete src/app/api/debug/ entirely
// ============================================================

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { runFullScrape } from '@/scrapers/orchestrator';
import { generateRecommendation } from '@/engine/recommendation';
import { verifyTodaysRates } from '@/engine/verification';

export const dynamic   = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // 5 min — scraping is slow

export async function GET(request: Request) {
  const start = Date.now();
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  // ── Auth guard ──────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) {
    console.warn('[debug/run-scrape] Unauthorised attempt');
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 });
  }

  const logs: string[] = [];
  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    logs.push(line);
  };

  log('══════════════════════════════════════════════════');
  log('DEBUG RUN-SCRAPE — pipeline starting');
  log(`NODE_ENV   : ${process.env.NODE_ENV}`);
  log(`DATABASE   : ${process.env.DATABASE_URL ? 'configured' : 'MISSING'}`);
  log('══════════════════════════════════════════════════');

  // ── Step 0: DB connectivity ─────────────────────────────────
  log('Step 0 — verifying Supabase connection...');
  try {
    await prisma.$queryRaw`SELECT 1`;
    log('Step 0 ✓ Supabase connected');
  } catch (err: any) {
    log(`Step 0 ✗ DB connection failed: ${err.message}`);
    return NextResponse.json({
      success: false,
      error: `Database connection failed: ${err.message}`,
      logs,
      durationMs: Date.now() - start,
    }, { status: 503 });
  }

  // ── Step 1: Full OTA scrape pipeline ────────────────────────
  log('Step 1 — starting full OTA scrape (13 sources × 5 hotels)...');
  let scrapeReport: Awaited<ReturnType<typeof runFullScrape>> | null = null;

  try {
    scrapeReport = await runFullScrape();
    log(`Step 1 ✓ Scrape complete`);
    log(`  Total rates found  : ${scrapeReport.totalRates}`);
    log(`  MAP rates found    : ${scrapeReport.mapRates}`);
    log(`  Successful sources : ${scrapeReport.successfulSources}`);
    log(`  Failed sources     : ${scrapeReport.failedSources}`);
    log(`  Duration           : ${(scrapeReport.duration / 1000).toFixed(1)}s`);
    log(`  Scrape window      : ${scrapeReport.scrapeWindow}`);
    log(`  Verified hotels    : ${scrapeReport.verification.verifiedHotels}`);
    log(`  Avg confidence     : ${(scrapeReport.verification.avgConfidence * 100).toFixed(0)}%`);
    log(`  Anomalies flagged  : ${scrapeReport.verification.anomalyCount}`);

    if (Object.keys(scrapeReport.verification.otaWinners).length > 0) {
      log('  OTA winners this cycle:');
      for (const [hotel, ota] of Object.entries(scrapeReport.verification.otaWinners)) {
        log(`    ${hotel} → ${ota}`);
      }
    }

    if (scrapeReport.staleStatus.staleHotels.length > 0) {
      log(`  ⚠ Stale hotels: ${scrapeReport.staleStatus.staleHotels.join(', ')}`);
    }
    if (scrapeReport.staleStatus.degradedHotels.length > 0) {
      log(`  ⚠ Degraded hotels: ${scrapeReport.staleStatus.degradedHotels.join(', ')}`);
    }
  } catch (err: any) {
    log(`Step 1 ✗ Scrape pipeline threw: ${err.message}`);
    log(err.stack ?? '');
    return NextResponse.json({
      success: false,
      error: `Scrape pipeline failed: ${err.message}`,
      logs,
      durationMs: Date.now() - start,
    }, { status: 500 });
  }

  // ── Step 2: Read back what was saved to DB ───────────────────
  log('Step 2 — reading back saved rates from Supabase...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let ratesSaved   = 0;
  let hotelsInDB   = 0;
  let snapshotsWritten = 0;

  try {
    ratesSaved = await prisma.dailyRate.count({
      where: { date: { gte: today, lt: tomorrow } },
    });
    hotelsInDB = await prisma.hotel.count();
    snapshotsWritten = await prisma.competitorSnapshot.count({
      where: { date: { gte: today, lt: tomorrow } },
    });

    log(`Step 2 ✓ DB readback`);
    log(`  DailyRate rows today : ${ratesSaved}`);
    log(`  Hotels in DB         : ${hotelsInDB}`);
    log(`  Snapshots written    : ${snapshotsWritten}`);
  } catch (err: any) {
    log(`Step 2 ⚠ DB readback failed (non-fatal): ${err.message}`);
  }

  // ── Step 3: Per-hotel verified BAR summary ───────────────────
  log('Step 3 — fetching per-hotel verified BAR from CompetitorSnapshot...');
  const hotelBarSummary: Array<{
    name: string; bar: number | null; source: string | null; confidence: string; otas: number;
  }> = [];

  try {
    const verification = await verifyTodaysRates();
    for (const r of verification.results) {
      hotelBarSummary.push({
        name:       r.hotelName,
        bar:        r.verifiedMapRate,
        source:     r.bestSource,
        confidence: r.confidenceLabel,
        otas:       r.sourceCount,
      });
      const fmt = (n: number | null) => n ? `₹${n.toLocaleString('en-IN')}` : 'N/A';
      log(`  ${r.hotelName}`);
      log(`    BAR: ${fmt(r.verifiedMapRate)} | OTA: ${r.bestSource ?? '—'} | Conf: ${r.confidenceLabel} | Sources: ${r.sourceCount}/${r.otasChecked}`);
      if (r.anomalies.length > 0) log(`    ⚠ Anomalies: ${r.anomalies.join(' | ')}`);
    }
  } catch (err: any) {
    log(`Step 3 ⚠ BAR fetch failed (non-fatal): ${err.message}`);
  }

  // ── Step 4: AI recommendation ────────────────────────────────
  log('Step 4 — generating AI recommendation...');
  let recommendation: { rate: number; strategy: string; confidence: number } | null = null;

  try {
    const rec = await generateRecommendation();
    recommendation = {
      rate:       rec.recommendedMapRate,
      strategy:   rec.strategy,
      confidence: rec.confidenceScore,
    };
    log(`Step 4 ✓ AI recommendation generated`);
    log(`  Recommended MAP : ₹${rec.recommendedMapRate.toLocaleString('en-IN')}`);
    log(`  Strategy        : ${rec.strategy}`);
    log(`  Confidence      : ${(rec.confidenceScore * 100).toFixed(0)}%`);
    log(`  Demand level    : ${rec.demandLevel ?? '—'}`);
    log(`  Season          : ${rec.seasonType ?? '—'}`);
  } catch (err: any) {
    log(`Step 4 ⚠ AI recommendation failed (non-fatal): ${err.message}`);
    // Non-fatal — rates are still saved even if AI fails
  }

  const totalDuration = Date.now() - start;
  log('══════════════════════════════════════════════════');
  log(`DEBUG RUN-SCRAPE — pipeline complete in ${(totalDuration / 1000).toFixed(1)}s`);
  log('══════════════════════════════════════════════════');

  // ── Response ─────────────────────────────────────────────────
  return NextResponse.json({
    // ⚠️ TEMPORARY DEBUG ROUTE
    _warning: 'This is a temporary debug endpoint. Remove before production launch.',

    success: true,
    durationMs: totalDuration,

    pipeline: {
      hotelsScraped:             scrapeReport.successfulSources,
      sourcesFailed:             scrapeReport.failedSources,
      totalRatesFound:           scrapeReport.totalRates,
      mapRatesFound:             scrapeReport.mapRates,
      ratesSavedToSupabase:      ratesSaved,
      snapshotsWritten,
      hotelsInDatabase:          hotelsInDB,
      verifiedHotels:            scrapeReport.verification.verifiedHotels,
      avgConfidencePct:          Math.round(scrapeReport.verification.avgConfidence * 100),
      anomaliesDetected:         scrapeReport.verification.anomalyCount,
      otaWinners:                scrapeReport.verification.otaWinners,
    },

    hotelBarSummary,

    recommendation,

    staleStatus: scrapeReport.staleStatus,

    recommendationsGenerated: recommendation ? 1 : 0,

    // ── Per-source diagnostics: tells you exactly why each OTA returned 0 rates ──
    sourceDiagnostics: scrapeReport.sourceDiagnostics ?? [],
    blockSummary: scrapeReport.blockSummary ?? {},
    diagnosticSummary: {
      totalNavigations: (scrapeReport.sourceDiagnostics ?? []).length,
      botBlockedCount:  (scrapeReport.sourceDiagnostics ?? []).filter(d => d.botBlocked).length,
      pagesWithPrices:  (scrapeReport.sourceDiagnostics ?? []).filter(d => d.hasPriceSymbol).length,
      avgHtmlSize: (scrapeReport.sourceDiagnostics ?? []).length > 0
        ? Math.round(
            (scrapeReport.sourceDiagnostics ?? []).reduce((s, d) => s + d.htmlSize, 0) /
            (scrapeReport.sourceDiagnostics ?? []).length
          )
        : 0,
    },

    logs,
  });
}
