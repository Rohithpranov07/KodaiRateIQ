// ============================================================
// KodaiRateIQ — Scraping Orchestrator v6
//
// Architecture:
//   • Uses OTA scrapers (Booking, Agoda, Goibibo, MMT, etc.)
//   • Official hotel websites are ALL DNS-blocked from Railway —
//     see official.ts comments for documentation.
//   • Playwright is required dynamically inside base.ts/BrowserManager,
//     never at module level (would break Next.js SSR build).
//   • Each scraper gets an isolated BrowserContext; the shared browser
//     process resets automatically after fatal crashes.
//   • MAX_CONCURRENT_BROWSERS = 2 (Railway ~512 MB RAM limit).
//
// Pipeline:
//   1.  Scrape all OTA tiers (Official → T1 → T2 → T3)
//   2.  Cross-verify MAP rates  → select lowest verified BAR
//   3.  Write DailyRate + CompetitorSnapshot + OtaBarAudit rows
//   4.  Update RateHistory (deltas, moving averages, volatility)
//   5.  Detect stale data
// ============================================================

import { BookingScraper }      from './booking';
import { GoibiboScraper }      from './goibibo';
import { MakeMyTripScraper }   from './makemytrip';
import { AgodaScraper }        from './agoda';
import { ExpediaScraper }      from './expedia';
import { HotelsDotComScraper } from './hotelsdotcom';
import { CleartripScraper }    from './cleartrip';
import { EaseMyTripScraper }   from './easemytrip';
import { IxigoScraper }        from './ixigo';
import { YatraScraper }        from './yatra';
import { TripadvisorScraper }  from './tripadvisor';
import { TrivagoScraper }      from './trivago';
import { createOfficialScrapers } from './official';
import { BaseScraper }         from './base';
import prisma                  from '@/lib/db';
import { HOTELS_CONFIG, calcDeltaPercent } from '@/lib/utils';
import type { ScrapedRate, ScrapeResult } from '@/types';
import { verifyTodaysRates, applyVerifiedRates, detectStaleData } from '@/engine/verification';

// ── Constants ─────────────────────────────────────────────────
// Keep at 2 — each Chromium instance uses ~150 MB on Railway's ~512 MB container.
const MAX_CONCURRENT_BROWSERS = 2;

// ── Public types ──────────────────────────────────────────────

export interface SourceDiagnosticSummary {
  source: string;
  hotelName: string;
  pageTitle: string;
  htmlSize: number;
  bodyTextLength: number;
  hasPriceSymbol: boolean;
  botBlocked: boolean;
  blockReason: string | null;
  samplePrices: string[];
  sampleBodyText: string;
  navigationMs: number;
  ratesExtracted: number;
  screenshotPath: string | null;
}

/** Per-OTA health summary (aggregated across all hotels for that OTA). */
export interface SourceHealthReport {
  source: string;
  success: boolean;
  hotelCardsFound: number;
  pricesFound: number;
  captchaDetected: boolean;
  selectorHealth: 'healthy' | 'degraded' | 'failed';
  ratesSaved: number;
  avgResponseMs: number;
  errors: string[];
}

/** Top-level scrape result returned to the API route and cron handler. */
export interface ScrapeReport {
  // Flat metrics — used by route.ts for quick status checks
  success: boolean;
  totalRatesFound: number;
  mapRatesFound: number;
  ratesSavedToSupabase: number;
  verifiedHotels: number;
  sourcesFailed: number;
  zeroRateSources: number;
  duration: number;

  // Full result set — available for deep diagnostics
  results: ScrapeResult[];

  verification: {
    avgConfidence: number;
    verifiedHotels: number;
    anomalyCount: number;
    otaWinners: Record<string, string>;
  };

  staleStatus: {
    staleHotels: string[];
    degradedHotels: string[];
    freshHotels: string[];
  };

  scrapeWindow: string;

  dbWrites: {
    dailyRates: number;
    snapshots: number;
    otaAudits: number;
  };

  // Diagnostic arrays
  sourceDiagnostics: SourceDiagnosticSummary[];
  sourceHealth: SourceHealthReport[];
  healthReports: SourceHealthReport[]; // alias for route.ts compatibility
  blockSummary: Record<string, string>;
  warnings: string[];
}

// ── Scraper tier factory ──────────────────────────────────────
// Official hotel websites are disabled — all DNS-blocked from Railway datacenters.
// createOfficialScrapers() returns [] when all are disabled, so the tier is a no-op.
const SCRAPER_TIERS = {
  official: () => createOfficialScrapers(),
  tier1: () => [new BookingScraper(), new AgodaScraper(), new GoibiboScraper(), new MakeMyTripScraper()],
  tier2: () => [new ExpediaScraper(), new HotelsDotComScraper(), new CleartripScraper(), new EaseMyTripScraper()],
  tier3: () => [new IxigoScraper(), new YatraScraper(), new TripadvisorScraper(), new TrivagoScraper()],
};

// ─────────────────────────────────────────────────────────────
// CONCURRENCY LIMITER
// Runs `tasks` in parallel with at most `limit` active at once.
// Every task is wrapped in its own try/catch so one failure never
// prevents the remaining tasks from completing.
// ─────────────────────────────────────────────────────────────
async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<Array<{ ok: true; value: T } | { ok: false; error: Error }>> {
  const results: Array<{ ok: true; value: T } | { ok: false; error: Error }> = [];
  const queue = [...tasks];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;
      try {
        results.push({ ok: true, value: await task() });
      } catch (err) {
        results.push({ ok: false, error: err as Error });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  );
  return results;
}

// ─────────────────────────────────────────────────────────────
// MAIN PIPELINE
// ─────────────────────────────────────────────────────────────
export async function runFullScrape(): Promise<ScrapeReport> {
  const pipelineStart = Date.now();
  const allResults: ScrapeResult[] = [];
  const warnings: string[] = [];
  const scrapeWindow = getScrapeWindowLabel();

  console.log('\n' + '='.repeat(60));
  console.log(`[Orchestrator] FULL SCRAPE — ${scrapeWindow}`);
  console.log(`[Orchestrator] Concurrent browser slots: ${MAX_CONCURRENT_BROWSERS}`);
  console.log(`[Orchestrator] ${new Date().toISOString()}`);
  console.log('='.repeat(60) + '\n');

  const today    = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // ── Phase 1: Scrape all tiers ────────────────────────────────
  // Official tier always returns [] on Railway — included for completeness.
  await runTier('OFFICIAL', SCRAPER_TIERS.official(), today, tomorrow, allResults);
  await runTier('TIER1',    SCRAPER_TIERS.tier1(),    today, tomorrow, allResults);
  await runTier('TIER2',    SCRAPER_TIERS.tier2(),    today, tomorrow, allResults);
  await runTier('TIER3',    SCRAPER_TIERS.tier3(),    today, tomorrow, allResults);

  const totalRates = allResults.reduce((s, r) => s + r.rates.length, 0);
  if (totalRates === 0) {
    const msg = '⛔ CRITICAL: Zero rates from all OTAs — check sourceDiagnostics';
    console.error(`[Orchestrator] ${msg}`);
    warnings.push(msg);
  }

  // ── Phase 2: Cross-verify MAP rates → TRUE BAR ───────────────
  console.log('\n🔍 Cross-verifying MAP rates...');
  let verifySummary = await verifyTodaysRates();
  for (const r of verifySummary.results) {
    const badge = r.confidenceLabel === 'HIGH' ? '✅' : r.confidenceLabel === 'MEDIUM' ? '🟡' : '🔴';
    const rateStr = r.verifiedMapRate ? `₹${r.verifiedMapRate.toLocaleString('en-IN')}` : 'N/A';
    console.log(`  ${badge} ${r.hotelName}: ${rateStr} [${r.bestSource ?? '—'}] ${r.confidenceLabel} (${r.sourceCount}/${r.otasChecked} OTAs)`);
    if (r.anomalies.length) console.warn(`     ⚠ ${r.anomalies.join(' | ')}`);
  }

  // ── Phase 3: Write CompetitorSnapshot + OtaBarAudit ─────────
  console.log('\n💾 Writing verified BAR rows...');
  await applyVerifiedRates(verifySummary);

  const today0    = new Date(); today0.setHours(0, 0, 0, 0);
  const tomorrow0 = new Date(today0); tomorrow0.setDate(tomorrow0.getDate() + 1);

  const [dailyRatesWritten, snapshotsWritten, auditsWritten] = await Promise.all([
    prisma.dailyRate.count({ where: { date: { gte: today0, lt: tomorrow0 } } }),
    prisma.competitorSnapshot.count({ where: { date: { gte: today0, lt: tomorrow0 } } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).otaBarAudit.count({ where: { date: { gte: today0, lt: tomorrow0 } } }).catch(() => 0),
  ]);

  console.log(`  ✓ DailyRate rows today    : ${dailyRatesWritten}`);
  console.log(`  ✓ CompetitorSnapshot rows : ${snapshotsWritten}`);
  console.log(`  ✓ OtaBarAudit rows        : ${auditsWritten}`);

  if (dailyRatesWritten === 0) {
    const msg = 'No DailyRate rows written — scrape produced 0 usable rates';
    console.warn(`  ⚠ ${msg}`);
    warnings.push(msg);
  }

  // ── Phase 4: Rate history (deltas, moving averages) ──────────
  console.log('📈 Updating RateHistory...');
  await updateRateHistory();

  // ── Phase 5: Stale data detection ────────────────────────────
  console.log('🕐 Stale data check...');
  const staleStatus = await detectStaleData();
  if (staleStatus.staleHotels.length)    console.warn(`  ⚠ Stale: ${staleStatus.staleHotels.join(', ')}`);
  if (staleStatus.degradedHotels.length) console.warn(`  ⚠ Degraded: ${staleStatus.degradedHotels.join(', ')}`);

  // Re-read verification after all writes are committed
  verifySummary = await verifyTodaysRates();

  // ── Aggregate metrics ────────────────────────────────────────
  const successfulSources = allResults.filter(r => r.success).length;
  const failedSources     = allResults.filter(r => !r.success).length;
  const zeroRateSources   = allResults.filter(r => r.success && r.rates.length === 0).length;
  const mapRates          = allResults.reduce((s, r) => s + r.rates.filter(x => x.mapRate != null).length, 0);

  const otaWinners: Record<string, string> = {};
  for (const r of verifySummary.results) {
    if (r.bestSource) otaWinners[r.hotelName] = r.bestSource;
  }

  const duration = Date.now() - pipelineStart;

  console.log('\n' + '='.repeat(60));
  console.log('SCRAPE SUMMARY');
  console.log('='.repeat(60));
  console.log(`Successful scrapes  : ${successfulSources}`);
  console.log(`Failed scrapes      : ${failedSources}`);
  console.log(`Zero-rate scrapes   : ${zeroRateSources}`);
  console.log(`Total rates found   : ${totalRates} (${mapRates} MAP)`);
  console.log(`DailyRate rows saved: ${dailyRatesWritten}`);
  console.log(`Verified hotels     : ${verifySummary.verifiedHotels}/${verifySummary.totalHotels}`);
  console.log(`Duration            : ${(duration / 1000).toFixed(1)}s`);
  if (warnings.length) console.warn(`Warnings: ${warnings.join('; ')}`);
  console.log('='.repeat(60) + '\n');

  // ── Build diagnostic arrays ───────────────────────────────────
  const sourceDiagnostics: SourceDiagnosticSummary[] = allResults
    .filter(r => r.diagnostics)
    .map(r => ({
      source:        r.diagnostics!.source,
      hotelName:     r.diagnostics!.hotelName,
      pageTitle:     r.diagnostics!.pageTitle,
      htmlSize:      r.diagnostics!.htmlSize,
      bodyTextLength:r.diagnostics!.bodyTextLength,
      hasPriceSymbol:r.diagnostics!.hasPriceSymbol,
      botBlocked:    r.diagnostics!.botBlocked,
      blockReason:   r.diagnostics!.blockReason,
      samplePrices:  r.diagnostics!.samplePrices,
      sampleBodyText:r.diagnostics!.sampleBodyText,
      navigationMs:  r.diagnostics!.navigationMs,
      ratesExtracted:r.diagnostics!.ratesExtracted,
      screenshotPath:r.diagnostics!.screenshotPath,
    }));

  // Aggregate per-OTA health (one record per source string, across all hotels)
  const healthMap = new Map<string, SourceHealthReport>();
  for (const r of allResults) {
    const key = r.source;
    if (!healthMap.has(key)) {
      healthMap.set(key, {
        source: key, success: false, hotelCardsFound: 0, pricesFound: 0,
        captchaDetected: false, selectorHealth: 'failed', ratesSaved: 0,
        avgResponseMs: 0, errors: [],
      });
    }
    const h = healthMap.get(key)!;
    if (r.success) h.success = true;
    h.pricesFound += r.rates.length;
    h.avgResponseMs = Math.round((h.avgResponseMs + r.duration) / 2);
    if (r.diagnostics?.botBlocked) h.captchaDetected = true;
    if (r.error) h.errors.push(r.error.substring(0, 100));
  }
  for (const h of healthMap.values()) {
    h.selectorHealth = h.pricesFound > 0 ? 'healthy' : h.success ? 'degraded' : 'failed';
  }
  const sourceHealth = Array.from(healthMap.values());

  const blockSummary: Record<string, string> = {};
  for (const d of sourceDiagnostics) {
    if (d.botBlocked) blockSummary[`${d.source}/${d.hotelName}`] = d.blockReason ?? 'unknown';
  }
  if (Object.keys(blockSummary).length) {
    console.log(`[Orchestrator] Bot-blocked navigations: ${Object.keys(blockSummary).length}`);
  }

  return {
    // Flat metrics
    success: totalRates > 0 || dailyRatesWritten > 0,
    totalRatesFound: totalRates,
    mapRatesFound: mapRates,
    ratesSavedToSupabase: dailyRatesWritten,
    verifiedHotels: verifySummary.verifiedHotels,
    sourcesFailed: failedSources,
    zeroRateSources,
    duration,

    results: allResults,
    verification: {
      avgConfidence:  verifySummary.avgConfidence,
      verifiedHotels: verifySummary.verifiedHotels,
      anomalyCount:   verifySummary.anomalyCount,
      otaWinners,
    },
    staleStatus,
    scrapeWindow,
    dbWrites: { dailyRates: dailyRatesWritten, snapshots: snapshotsWritten, otaAudits: auditsWritten },
    sourceDiagnostics,
    sourceHealth,
    healthReports: sourceHealth, // alias so route.ts can use either name
    blockSummary,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────
// TIER RUNNER
// Runs all scrapers in `scrapers` for every hotel in HOTELS_CONFIG,
// with concurrency capped at MAX_CONCURRENT_BROWSERS.
// ─────────────────────────────────────────────────────────────
async function runTier(
  tierName: string,
  scrapers: BaseScraper[],
  checkIn: Date,
  checkOut: Date,
  allResults: ScrapeResult[],
): Promise<void> {
  if (scrapers.length === 0) {
    console.log(`\n📡 [${tierName}] — skipped (no scrapers)`);
    return;
  }

  console.log(`\n📡 [${tierName}] ${scrapers.length} scrapers × ${HOTELS_CONFIG.length} hotels`);

  for (const hotel of HOTELS_CONFIG) {
    const tasks = scrapers.map(sc => () => sc.execute(hotel.name, checkIn, checkOut));
    const outcomes = await withConcurrency(tasks, MAX_CONCURRENT_BROWSERS);

    for (let i = 0; i < outcomes.length; i++) {
      const outcome = outcomes[i];
      const sc      = scrapers[i];

      if (outcome.ok) {
        const result = outcome.value;
        allResults.push(result);

        // Fire-and-forget scrape log
        prisma.scrapeLog.create({
          data: {
            source:       result.source,
            hotelName:    hotel.name,
            status:       result.success ? 'success' : 'failed',
            duration:     result.duration,
            ratesFound:   result.rates.length,
            errorMessage: result.error,
            retryCount:   result.retryCount,
          },
        }).catch((e: Error) => console.warn(`[ScrapeLog] ${e.message}`));

        if (result.success && result.rates.length > 0) {
          try {
            const saved = await storeRates(hotel.name, result.rates);
            const mapCnt = result.rates.filter(r => r.mapRate != null).length;
            console.log(`  ✓ ${result.source}: ${result.rates.length} rates (${mapCnt} MAP) → ${saved} saved  [${result.duration}ms]`);
          } catch (e: any) {
            console.error(`  ✗ ${result.source}: storeRates failed — ${e.message}`);
          }
        } else if (result.success) {
          console.log(
            `  ○ ${result.source}: 0 rates  [${result.duration}ms]` +
            `  html=${result.diagnostics?.htmlSize ?? '?'}B` +
            `  bot=${result.diagnostics?.botBlocked ?? '?'}` +
            `  prices=${result.diagnostics?.samplePrices?.join(',') ?? ''}`
          );
        } else {
          console.log(`  ✗ ${result.source}: FAILED — ${result.error}`);
        }
      } else {
        // scraper threw an unhandled exception
        console.error(`  ✗ ${sc.source}: EXCEPTION — ${outcome.error.message}`);
        prisma.scrapeLog.create({
          data: {
            source: sc.source, hotelName: hotel.name,
            status: 'failed', duration: 0, ratesFound: 0,
            errorMessage: outcome.error.message,
          },
        }).catch(() => {});
        allResults.push({
          success: false, source: sc.source, hotelName: hotel.name,
          rates: [], duration: 0, error: outcome.error.message, retryCount: 0,
        });
      }
    }
  }

  // Release contexts/pages created by this tier's scrapers
  await Promise.allSettled(scrapers.map(s => s.cleanup()));
}

// ─────────────────────────────────────────────────────────────
// RATE STORAGE
// Uses plain `create` — DailyRate has no unique composite index,
// so multiple readings per day are allowed (each is a fresh row).
// P2002 (duplicate key) is silently swallowed.
// Invalid/NaN/zero rates are rejected before insertion.
// ─────────────────────────────────────────────────────────────
async function storeRates(hotelName: string, rates: ScrapedRate[]): Promise<number> {
  const hotelCfg = HOTELS_CONFIG.find(h => h.name === hotelName);
  if (!hotelCfg) return 0;

  let hotel = await prisma.hotel.findUnique({ where: { slug: hotelCfg.slug } });
  if (!hotel) {
    hotel = await prisma.hotel.create({
      data: {
        name:       hotelCfg.name,
        slug:       hotelCfg.slug,
        category:   hotelCfg.category,
        starRating: hotelCfg.starRating,
        role:       hotelCfg.role,
        website:    hotelCfg.website,
        isTarget:   'isTarget' in hotelCfg ? Boolean(hotelCfg.isTarget) : false,
      },
    });
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  let saved = 0;

  for (const rate of rates) {
    // Validate before touching the DB
    const rateValue = rate.mapRate ?? rate.cpRate ?? rate.epRate ?? rate.totalWithTax;
    if (!rateValue || isNaN(rateValue) || rateValue <= 0 || rateValue > 1_000_000) {
      console.warn(`[storeRates] skip invalid rate: value=${rateValue} source=${rate.source} hotel=${hotelName}`);
      continue;
    }

    let room = await prisma.room.findFirst({ where: { hotelId: hotel.id, name: rate.roomType } });
    if (!room) {
      room = await prisma.room.create({
        data: {
          hotelId:      hotel.id,
          name:         rate.roomType,
          type:         inferRoomType(rate.roomType),
          maxOccupancy: rate.occupancy,
        },
      });
    }

    try {
      await prisma.dailyRate.create({
        data: {
          hotelId:           hotel.id,
          roomId:            room.id,
          date:              today,
          mapRate:           rate.mapRate,
          cpRate:            rate.cpRate,
          epRate:            rate.epRate,
          taxPercent:        rate.taxPercent,
          taxInclusive:      rate.taxInclusive,
          totalWithTax:      rate.totalWithTax,
          singleOccRate:     rate.singleOccRate,
          doubleOccRate:     rate.doubleOccRate,
          extraAdultRate:    rate.extraAdultRate,
          extraChildRate:    rate.extraChildRate,
          source:            rate.source,
          sourceUrl:         rate.sourceUrl,
          isAvailable:       rate.isAvailable,
          roomsLeft:         rate.roomsLeft,
          breakfastIncluded: rate.breakfastIncluded,
          dinnerIncluded:    rate.dinnerIncluded,
          lunchIncluded:     rate.lunchIncluded,
          mealDetails:       rate.mealDetails,
          cancellationPolicy:rate.cancellationPolicy,
          freeCancellation:  rate.freeCancellation,
          hasDiscount:       rate.hasDiscount,
          discountPercent:   rate.discountPercent,
          offerDescription:  rate.offerDescription,
          confidence:        rate.confidence,
          scrapedAt:         rate.scrapedAt,
        },
      });
      saved++;
    } catch (err: any) {
      // P2002 = unique constraint already satisfied (duplicate) — silent skip
      if (!err.message?.includes('P2002') && !err.message?.includes('Unique constraint')) {
        console.warn(`[storeRates] insert failed: ${err.message} [${rate.source}/${hotelName}]`);
      }
    }
  }

  if (saved > 0) {
    console.log(`[storeRates] ${hotelName}: saved ${saved}/${rates.length}`);
  }
  return saved;
}

// ─────────────────────────────────────────────────────────────
// RATE HISTORY
// ─────────────────────────────────────────────────────────────
async function updateRateHistory(): Promise<void> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  const hotels = await prisma.hotel.findMany();
  for (const hotel of hotels) {
    const snap = await prisma.competitorSnapshot.findUnique({
      where: { hotelId_date: { hotelId: hotel.id, date: today } },
    });
    if (!snap?.bestMapRate) continue;

    const prevSnap = await prisma.competitorSnapshot.findUnique({
      where: { hotelId_date: { hotelId: hotel.id, date: yesterday } },
    });

    const deltaPercent = prevSnap?.bestMapRate
      ? calcDeltaPercent(snap.bestMapRate, prevSnap.bestMapRate)
      : null;

    const [last7, last30] = await Promise.all([
      prisma.competitorSnapshot.findMany({
        where: { hotelId: hotel.id, bestMapRate: { not: null }, date: { gte: new Date(today.getTime() - 7 * 86_400_000), lte: today } },
      }),
      prisma.competitorSnapshot.findMany({
        where: { hotelId: hotel.id, bestMapRate: { not: null }, date: { gte: new Date(today.getTime() - 30 * 86_400_000), lte: today } },
      }),
    ]);

    const movingAvg7  = last7.length  ? last7.reduce((s, x)  => s + (x.bestMapRate ?? 0), 0) / last7.length  : null;
    const movingAvg30 = last30.length ? last30.reduce((s, x) => s + (x.bestMapRate ?? 0), 0) / last30.length : null;

    let volatility: number | null = null;
    if (last30.length >= 3) {
      const vals = last30.map(s => s.bestMapRate!);
      const avg  = vals.reduce((a, b) => a + b, 0) / vals.length;
      volatility = Math.sqrt(vals.reduce((a, b) => a + (b - avg) ** 2, 0) / vals.length) / avg;
    }

    try {
      await prisma.rateHistory.upsert({
        where: { hotelId_date_source: { hotelId: hotel.id, date: today, source: snap.bestSource ?? 'aggregated' } },
        update: { mapRate: snap.bestMapRate, cpRate: snap.bestCpRate, epRate: snap.bestEpRate, deltaPercent, movingAvg7, movingAvg30, volatility },
        create: { hotelId: hotel.id, date: today, source: snap.bestSource ?? 'aggregated', mapRate: snap.bestMapRate, cpRate: snap.bestCpRate, epRate: snap.bestEpRate, deltaPercent, movingAvg7, movingAvg30, volatility },
      });
    } catch { /* non-fatal */ }
  }
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function inferRoomType(name: string): string {
  const l = name.toLowerCase();
  if (l.includes('suite'))                              return 'suite';
  if (l.includes('villa') || l.includes('cottage'))    return 'villa';
  if (l.includes('deluxe'))                            return 'deluxe';
  if (l.includes('premium') || l.includes('superior')) return 'premium';
  return 'standard';
}

function getScrapeWindowLabel(): string {
  const h = new Date().getHours();
  if (h < 9)  return 'MORNING (6 AM cycle)';
  if (h < 15) return 'MIDDAY (12 PM cycle)';
  return 'EVENING (6 PM cycle)';
}
