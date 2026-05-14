// ============================================================
// ⚠️  TEMPORARY DEBUG ROUTE — REMOVE BEFORE GA LAUNCH
//
// GET /api/debug/run-scrape?secret=<CRON_SECRET>
//
// Triggers the full OTA scrape pipeline and returns a detailed
// JSON report including per-source health and diagnostics.
//
// Auth: ?secret=<CRON_SECRET> (required in production)
// ============================================================

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { runFullScrape } from '@/scrapers/orchestrator';
import { generateRecommendation } from '@/engine/recommendation';
import { verifyTodaysRates } from '@/engine/verification';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // 5 min — scraping is intentionally slow

export async function GET(request: Request) {
  const start = Date.now();
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  // ── Auth ────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) {
    console.warn('[debug/run-scrape] Unauthorised attempt');
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 });
  }

  const logs: string[] = [];
  const ts  = () => new Date().toISOString();
  const log = (msg: string) => { const l = `[${ts()}] ${msg}`; console.log(l); logs.push(l); };

  log('═══════════════════════════════════════════════════');
  log('DEBUG RUN-SCRAPE — pipeline starting');
  log(`NODE_ENV   : ${process.env.NODE_ENV}`);
  log(`DATABASE   : ${process.env.DATABASE_URL ? 'configured' : '⚠ MISSING'}`);
  log('═══════════════════════════════════════════════════');

  // ── Step 0: DB connectivity ─────────────────────────────────
  log('Step 0 — verifying Supabase connection...');
  try {
    await prisma.$queryRaw`SELECT 1`;
    log('Step 0 ✓ Supabase connected');
  } catch (err: any) {
    log(`Step 0 ✗ DB connection FAILED: ${err.message}`);
    return NextResponse.json({
      success: false,
      error: `Database connection failed: ${err.message}`,
      hotelsScraped: 0, sourcesFailed: 0,
      totalRatesFound: 0, mapRatesFound: 0,
      ratesSavedToSupabase: 0, verifiedHotels: 0,
      logs, durationMs: Date.now() - start,
    }, { status: 503 });
  }

  // ── Step 1: Full OTA scrape ─────────────────────────────────
  log('Step 1 — starting full OTA scrape (12 OTA sources × 5 hotels)...');
  let scrapeReport: Awaited<ReturnType<typeof runFullScrape>>;

  try {
    scrapeReport = await runFullScrape();
  } catch (err: any) {
    log(`Step 1 ✗ Scrape pipeline threw: ${err.message}`);
    log(err.stack ?? '');
    return NextResponse.json({
      success: false,
      error: `Scrape pipeline failed: ${err.message}`,
      hotelsScraped: 0, sourcesFailed: 0,
      totalRatesFound: 0, mapRatesFound: 0,
      ratesSavedToSupabase: 0, verifiedHotels: 0,
      logs, durationMs: Date.now() - start,
    }, { status: 500 });
  }

  log(`Step 1 ✓ Scrape complete`);
  log(`  Total rates found  : ${scrapeReport.totalRatesFound}`);
  log(`  MAP rates          : ${scrapeReport.mapRatesFound}`);
  log(`  Successful sources : ${scrapeReport.results.filter(r => r.success).length}`);
  log(`  Zero-rate sources  : ${scrapeReport.zeroRateSources}`);
  log(`  Failed sources     : ${scrapeReport.sourcesFailed}`);
  log(`  Duration           : ${(scrapeReport.duration / 1000).toFixed(1)}s`);
  log(`  Verified hotels    : ${scrapeReport.verifiedHotels}`);
  log(`  Avg confidence     : ${(scrapeReport.verification.avgConfidence * 100).toFixed(0)}%`);

  for (const w of scrapeReport.warnings) log(`  ⚠ ${w}`);

  if (scrapeReport.totalRatesFound === 0) {
    log('  ⛔ ZERO RATES — check sourceDiagnostics for root cause');
  }

  for (const h of scrapeReport.sourceHealth) {
    if (h.selectorHealth !== 'healthy') {
      log(`  ⚠ ${h.source}: health=${h.selectorHealth} captcha=${h.captchaDetected} rates=${h.pricesFound}`);
    }
  }

  // ── Step 2: DB readback ─────────────────────────────────────
  log('Step 2 — reading back saved rates from Supabase...');
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  let ratesSaved = 0, hotelsInDB = 0, snapshotsWritten = 0;
  try {
    [ratesSaved, hotelsInDB, snapshotsWritten] = await Promise.all([
      prisma.dailyRate.count({ where: { date: { gte: today, lt: tomorrow } } }),
      prisma.hotel.count(),
      prisma.competitorSnapshot.count({ where: { date: { gte: today, lt: tomorrow } } }),
    ]);
    log(`Step 2 ✓  DailyRate rows today : ${ratesSaved}`);
    log(`          Hotels in DB         : ${hotelsInDB}`);
    log(`          Snapshots written    : ${snapshotsWritten}`);
    if (ratesSaved === 0 && scrapeReport.totalRatesFound > 0) {
      log('          ⛔ Rates found but 0 saved — DB write error');
    }
  } catch (err: any) {
    log(`Step 2 ⚠ DB readback failed (non-fatal): ${err.message}`);
  }

  // ── Step 3: Per-hotel verified BAR summary ──────────────────
  log('Step 3 — fetching per-hotel verified BAR...');
  const hotelBarSummary: Array<{
    name: string; bar: number | null; source: string | null; confidence: string; otas: number;
  }> = [];
  try {
    const verification = await verifyTodaysRates();
    for (const r of verification.results) {
      hotelBarSummary.push({
        name: r.hotelName, bar: r.verifiedMapRate,
        source: r.bestSource, confidence: r.confidenceLabel, otas: r.sourceCount,
      });
      const fmt = (n: number | null) => n ? `₹${n.toLocaleString('en-IN')}` : 'N/A';
      log(`  ${r.hotelName}: ${fmt(r.verifiedMapRate)} [${r.bestSource ?? '—'}] ${r.confidenceLabel} (${r.sourceCount}/${r.otasChecked} OTAs)`);
      if (r.anomalies.length) log(`    ⚠ ${r.anomalies.join(' | ')}`);
    }
  } catch (err: any) {
    log(`Step 3 ⚠ BAR fetch failed (non-fatal): ${err.message}`);
  }

  // ── Step 4: AI recommendation ───────────────────────────────
  log('Step 4 — generating AI recommendation...');
  let recommendation: { rate: number; strategy: string; confidence: number } | null = null;
  try {
    const rec = await generateRecommendation();
    recommendation = { rate: rec.recommendedMapRate, strategy: rec.strategy, confidence: rec.confidenceScore };
    log(`Step 4 ✓ ₹${rec.recommendedMapRate.toLocaleString('en-IN')} — ${rec.strategy}`);
  } catch (err: any) {
    log(`Step 4 ⚠ AI recommendation failed (non-fatal): ${err.message}`);
  }

  const durationMs = Date.now() - start;
  log('═══════════════════════════════════════════════════');
  log(`COMPLETE in ${(durationMs / 1000).toFixed(1)}s`);
  log('═══════════════════════════════════════════════════');

  // ── Build enhanced per-source diagnostics ──────────────────
  const diagnostics = (scrapeReport.sourceDiagnostics ?? []).map(d => ({
    source:          d.source,
    hotelName:       d.hotelName,
    pageTitle:       d.pageTitle,
    htmlSize:        d.htmlSize,
    bodyTextLength:  d.bodyTextLength,
    hasPriceSymbol:  d.hasPriceSymbol,
    captchaDetected: d.botBlocked,
    blockReason:     d.blockReason,
    samplePrices:    d.samplePrices,
    navigationMs:    d.navigationMs,
    ratesExtracted:  d.ratesExtracted,
    selectorHealth:  d.ratesExtracted > 0 ? 'healthy' : d.botBlocked ? 'blocked' : 'degraded',
    screenshotPath:  d.screenshotPath,
  }));

  return NextResponse.json({
    _warning: 'Temporary debug endpoint — remove before GA launch.',

    // ── Flat fields (expected by external callers) ──────────
    success:              scrapeReport.success,
    hotelsScraped:        scrapeReport.results.filter(r => r.success).length,
    sourcesFailed:        scrapeReport.sourcesFailed,
    zeroRateSources:      scrapeReport.zeroRateSources,
    totalRatesFound:      scrapeReport.totalRatesFound,
    mapRatesFound:        scrapeReport.mapRatesFound,
    ratesSavedToSupabase: ratesSaved,
    verifiedHotels:       scrapeReport.verifiedHotels,

    // ── Nested pipeline object ──────────────────────────────
    pipeline: {
      hotelsScraped:        scrapeReport.results.filter(r => r.success).length,
      sourcesFailed:        scrapeReport.sourcesFailed,
      zeroRateSources:      scrapeReport.zeroRateSources,
      totalRatesFound:      scrapeReport.totalRatesFound,
      mapRatesFound:        scrapeReport.mapRatesFound,
      ratesSavedToSupabase: ratesSaved,
      snapshotsWritten,
      hotelsInDatabase:     hotelsInDB,
      verifiedHotels:       scrapeReport.verifiedHotels,
      avgConfidencePct:     Math.round(scrapeReport.verification.avgConfidence * 100),
      anomaliesDetected:    scrapeReport.verification.anomalyCount,
      otaWinners:           scrapeReport.verification.otaWinners,
      dbWrites:             scrapeReport.dbWrites,
    },

    hotelBarSummary,
    recommendation,
    staleStatus:    scrapeReport.staleStatus,
    scrapeWindow:   scrapeReport.scrapeWindow,
    warnings:       scrapeReport.warnings,

    // ── Per-source health (one entry per OTA) ───────────────
    sourceHealth:   scrapeReport.sourceHealth,
    healthReports:  scrapeReport.sourceHealth,

    // ── Per-navigation diagnostics ──────────────────────────
    sourceDiagnostics: diagnostics,
    blockSummary:      scrapeReport.blockSummary,

    diagnosticSummary: {
      totalNavigations:  diagnostics.length,
      botBlockedCount:   diagnostics.filter(d => d.captchaDetected).length,
      pagesWithPrices:   diagnostics.filter(d => d.hasPriceSymbol).length,
      healthySelectors:  diagnostics.filter(d => d.selectorHealth === 'healthy').length,
      degradedSelectors: diagnostics.filter(d => d.selectorHealth === 'degraded').length,
      avgHtmlSize: diagnostics.length
        ? Math.round(diagnostics.reduce((s, d) => s + d.htmlSize, 0) / diagnostics.length)
        : 0,
    },

    durationMs,
    logs,
  });
}
