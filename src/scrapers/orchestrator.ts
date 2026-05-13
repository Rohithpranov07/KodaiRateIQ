// ============================================================
// KodaiRateIQ — Scraping Orchestrator v4
//
// FULL 13-SOURCE OTA AGGREGATION PIPELINE
// Max concurrent browsers: 2 (Railway memory constraint)
//
// Pipeline:
//   1. Scrape OTAs in tiers, 2 browsers at a time per hotel
//   2. Cross-verify MAP rates → select TRUE BAR
//   3. Write DailyRate + CompetitorSnapshot + OtaBarAudit
//   4. Update RateHistory
//   5. Stale detection
// ============================================================

import { BookingScraper }     from './booking';
import { GoibiboScraper }     from './goibibo';
import { MakeMyTripScraper }  from './makemytrip';
import { AgodaScraper }       from './agoda';
import { ExpediaScraper }     from './expedia';
import { HotelsDotComScraper } from './hotelsdotcom';
import { CleartripScraper }   from './cleartrip';
import { EaseMyTripScraper }  from './easemytrip';
import { IxigoScraper }       from './ixigo';
import { YatraScraper }       from './yatra';
import { TripadvisorScraper } from './tripadvisor';
import { TrivagoScraper }     from './trivago';
import { createOfficialScrapers } from './official';
import { BaseScraper }        from './base';
import prisma                 from '@/lib/db';
import { HOTELS_CONFIG, calcDeltaPercent } from '@/lib/utils';
import type { ScrapedRate, ScrapeResult } from '@/types';
import { verifyTodaysRates, applyVerifiedRates, detectStaleData } from '@/engine/verification';

// Maximum simultaneous Chromium instances.
// Railway containers ~512 MB RAM; each Chromium ~150 MB.
const MAX_CONCURRENT_BROWSERS = 2;

// ── Scrape Report ─────────────────────────────────────────────

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

export interface ScrapeReport {
  totalRates: number;
  mapRates: number;
  successfulSources: number;
  failedSources: number;
  zeroRateSources: number;
  duration: number;
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
  sourceDiagnostics: SourceDiagnosticSummary[];
  sourceHealth: SourceHealthReport[];
  blockSummary: Record<string, string>;
  warnings: string[];
}

// ── Scraper tiers ─────────────────────────────────────────────
const SCRAPER_TIERS = {
  official: () => createOfficialScrapers(),
  tier1: () => [new BookingScraper(), new AgodaScraper(), new GoibiboScraper(), new MakeMyTripScraper()],
  tier2: () => [new ExpediaScraper(), new HotelsDotComScraper(), new CleartripScraper(), new EaseMyTripScraper()],
  tier3: () => [new IxigoScraper(), new YatraScraper(), new TripadvisorScraper(), new TrivagoScraper()],
};

// ─────────────────────────────────────────────────────────────
// CONCURRENCY LIMITER
// ─────────────────────────────────────────────────────────────

async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<Array<{ ok: true; value: T } | { ok: false; error: Error }>> {
  const results: Array<{ ok: true; value: T } | { ok: false; error: Error }> = [];
  const queue = [...tasks];

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;
      try {
        const value = await task();
        results.push({ ok: true, value });
      } catch (error) {
        results.push({ ok: false, error: error as Error });
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ─────────────────────────────────────────────────────────────
// FULL SCRAPE PIPELINE
// ─────────────────────────────────────────────────────────────

export async function runFullScrape(): Promise<ScrapeReport> {
  const startTime = Date.now();
  const allResults: ScrapeResult[] = [];
  const warnings: string[] = [];
  const scrapeWindow = getScrapeWindowLabel();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Orchestrator] Starting FULL scrape — ${scrapeWindow}`);
  console.log(`[Orchestrator] Max concurrent browsers: ${MAX_CONCURRENT_BROWSERS}`);
  console.log(`[Orchestrator] Timestamp: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  const today    = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // ── Phase 1: Scrape all tiers ─────────────────────────────
  await runTier('OFFICIAL', SCRAPER_TIERS.official(), today, tomorrow, allResults);
  await runTier('TIER1',    SCRAPER_TIERS.tier1(),    today, tomorrow, allResults);
  await runTier('TIER2',    SCRAPER_TIERS.tier2(),    today, tomorrow, allResults);
  await runTier('TIER3',    SCRAPER_TIERS.tier3(),    today, tomorrow, allResults);

  const totalRates = allResults.reduce((s, r) => s + r.rates.length, 0);

  if (totalRates === 0) {
    const msg = 'CRITICAL: Zero rates extracted from ALL sources. Check source diagnostics.';
    console.error(`[Orchestrator] ⛔ ${msg}`);
    warnings.push(msg);
  }

  // ── Phase 2: Verify ───────────────────────────────────────
  console.log('\n🔍 Running OTA cross-verification...');
  let verificationSummary = await verifyTodaysRates();

  for (const r of verificationSummary.results) {
    const badge  = r.confidenceLabel === 'HIGH' ? '✅' : r.confidenceLabel === 'MEDIUM' ? '🟡' : '🔴';
    const rate   = r.verifiedMapRate ? `₹${r.verifiedMapRate.toLocaleString('en-IN')}` : 'N/A';
    console.log(`  ${badge} ${r.hotelName}: ${rate} MAP [${r.bestSource ?? '—'}] ${r.confidenceLabel} (${r.sourceCount}/${r.otasChecked} OTAs)`);
    if (r.anomalies.length > 0) console.warn(`     ⚠ ${r.anomalies.join(' | ')}`);
  }

  // ── Phase 3: Apply verified rates ────────────────────────
  console.log('\n💾 Writing verified BAR to Supabase...');
  await applyVerifiedRates(verificationSummary);

  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  const tomorrow0 = new Date(today0);
  tomorrow0.setDate(tomorrow0.getDate() + 1);

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
    const msg = 'WARNING: No DailyRate rows written — dashboard will be empty!';
    console.warn(`  ⚠ ${msg}`);
    warnings.push(msg);
  }

  // ── Phase 4: Rate history ─────────────────────────────────
  console.log('📈 Updating RateHistory...');
  await updateRateHistory();

  // ── Phase 5: Stale detection ──────────────────────────────
  console.log('🕐 Stale data check...');
  const staleStatus = await detectStaleData();
  if (staleStatus.staleHotels.length > 0)    console.warn(`  ⚠ Stale: ${staleStatus.staleHotels.join(', ')}`);
  if (staleStatus.degradedHotels.length > 0) console.warn(`  ⚠ Degraded: ${staleStatus.degradedHotels.join(', ')}`);

  verificationSummary = await verifyTodaysRates();

  const successfulSources = allResults.filter(r => r.success).length;
  const failedSources     = allResults.filter(r => !r.success).length;
  const zeroRateSources   = allResults.filter(r => r.success && r.rates.length === 0).length;
  const mapRates          = allResults.reduce((s, r) => s + r.rates.filter(rate => rate.mapRate != null).length, 0);

  const otaWinners: Record<string, string> = {};
  for (const r of verificationSummary.results) {
    if (r.bestSource) otaWinners[r.hotelName] = r.bestSource;
  }

  const duration = Date.now() - startTime;

  console.log(`\n${'='.repeat(60)}`);
  console.log('SCRAPE SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Hotels processed    : ${HOTELS_CONFIG.length}`);
  console.log(`OTAs attempted      : ${[...new Set(allResults.map(r => r.source))].length}`);
  console.log(`Successful scrapes  : ${successfulSources}`);
  console.log(`Failed scrapes      : ${failedSources}`);
  console.log(`Zero-rate scrapes   : ${zeroRateSources} (succeeded but empty)`);
  console.log(`Total rates found   : ${totalRates} (${mapRates} MAP)`);
  console.log(`Rows inserted (DR)  : ${dailyRatesWritten}`);
  console.log(`Rows inserted (Snap): ${snapshotsWritten}`);
  console.log(`Verified hotels     : ${verificationSummary.verifiedHotels}/${verificationSummary.totalHotels}`);
  console.log(`Avg confidence      : ${(verificationSummary.avgConfidence * 100).toFixed(0)}%`);
  console.log(`Duration            : ${(duration / 1000).toFixed(1)}s`);
  if (warnings.length > 0) console.warn(`Warnings: ${warnings.join('; ')}`);
  console.log(`${'='.repeat(60)}\n`);

  // Build per-source diagnostics
  const sourceDiagnostics: SourceDiagnosticSummary[] = allResults
    .filter(r => r.diagnostics)
    .map(r => {
      const d = r.diagnostics!;
      return {
        source: d.source, hotelName: d.hotelName, pageTitle: d.pageTitle,
        htmlSize: d.htmlSize, bodyTextLength: d.bodyTextLength,
        hasPriceSymbol: d.hasPriceSymbol, botBlocked: d.botBlocked,
        blockReason: d.blockReason, samplePrices: d.samplePrices,
        sampleBodyText: d.sampleBodyText, navigationMs: d.navigationMs,
        ratesExtracted: d.ratesExtracted, screenshotPath: d.screenshotPath,
      };
    });

  // Build per-source health reports (aggregate across hotels)
  const sourceHealthMap = new Map<string, SourceHealthReport>();
  for (const r of allResults) {
    const key = r.source;
    if (!sourceHealthMap.has(key)) {
      sourceHealthMap.set(key, {
        source: key, success: false, hotelCardsFound: 0, pricesFound: 0,
        captchaDetected: false, selectorHealth: 'failed', ratesSaved: 0,
        avgResponseMs: 0, errors: [],
      });
    }
    const h = sourceHealthMap.get(key)!;
    if (r.success) h.success = true;
    h.pricesFound += r.rates.length;
    h.avgResponseMs = Math.round((h.avgResponseMs + r.duration) / 2);
    if (r.diagnostics?.botBlocked) h.captchaDetected = true;
    if (r.error) h.errors.push(r.error.substring(0, 100));
  }
  for (const h of sourceHealthMap.values()) {
    h.selectorHealth = h.pricesFound > 0 ? 'healthy' : h.success ? 'degraded' : 'failed';
  }
  const sourceHealth = Array.from(sourceHealthMap.values());

  const blockSummary: Record<string, string> = {};
  for (const d of sourceDiagnostics) {
    if (d.botBlocked) blockSummary[`${d.source}/${d.hotelName}`] = d.blockReason ?? 'unknown';
  }

  if (Object.keys(blockSummary).length > 0) {
    console.log(`[Orchestrator] Bot-blocked navigations: ${Object.keys(blockSummary).length}`);
  }

  return {
    totalRates, mapRates, successfulSources, failedSources, zeroRateSources,
    duration, results: allResults,
    verification: {
      avgConfidence: verificationSummary.avgConfidence,
      verifiedHotels: verificationSummary.verifiedHotels,
      anomalyCount: verificationSummary.anomalyCount,
      otaWinners,
    },
    staleStatus, scrapeWindow,
    dbWrites: { dailyRates: dailyRatesWritten, snapshots: snapshotsWritten, otaAudits: auditsWritten },
    sourceDiagnostics, sourceHealth, blockSummary, warnings,
  };
}

// ─────────────────────────────────────────────────────────────
// TIER EXECUTION
// ─────────────────────────────────────────────────────────────

async function runTier(
  tierName: string,
  scrapers: BaseScraper[],
  checkIn: Date,
  checkOut: Date,
  allResults: ScrapeResult[],
): Promise<void> {
  if (scrapers.length === 0) {
    console.log(`\n📡 [${tierName}] No scrapers — skipped`);
    return;
  }

  console.log(`\n📡 [${tierName}] ${scrapers.length} scrapers × ${HOTELS_CONFIG.length} hotels (max ${MAX_CONCURRENT_BROWSERS} concurrent)`);

  for (const hotel of HOTELS_CONFIG) {
    const tasks = scrapers.map(scraper => () => scraper.execute(hotel.name, checkIn, checkOut));
    const outcomes = await withConcurrency(tasks, MAX_CONCURRENT_BROWSERS);

    for (let i = 0; i < outcomes.length; i++) {
      const outcome = outcomes[i];
      const scraper = scrapers[i];

      if (outcome.ok) {
        const result = outcome.value;
        allResults.push(result);

        prisma.scrapeLog.create({
          data: {
            source: result.source, hotelName: hotel.name,
            status: result.success ? 'success' : 'failed',
            duration: result.duration, ratesFound: result.rates.length,
            errorMessage: result.error, retryCount: result.retryCount,
          },
        }).catch((e: Error) => console.warn(`[ScrapeLog] Write failed: ${e.message}`));

        if (result.success && result.rates.length > 0) {
          try {
            const saved = await storeRates(hotel.name, result.rates);
            const mapCount = result.rates.filter(r => r.mapRate != null).length;
            console.log(`  ✓ ${result.source}: ${result.rates.length} rates (${mapCount} MAP) → ${saved} saved ${result.duration}ms`);
          } catch (storeErr: any) {
            console.error(`  ✗ ${result.source}: store failed — ${storeErr.message}`);
          }
        } else if (result.success) {
          console.log(`  ○ ${result.source}: 0 rates ${result.duration}ms [diag: html=${result.diagnostics?.htmlSize}B bot=${result.diagnostics?.botBlocked}]`);
        } else {
          console.log(`  ✗ ${result.source}: FAILED — ${result.error}`);
        }
      } else {
        const err = outcome.error;
        console.error(`  ✗ ${scraper.source}: EXCEPTION — ${err.message}`);

        prisma.scrapeLog.create({
          data: {
            source: scraper.source, hotelName: hotel.name,
            status: 'failed', duration: 0, ratesFound: 0,
            errorMessage: err.message,
          },
        }).catch(() => {});

        allResults.push({
          success: false, source: scraper.source, hotelName: hotel.name,
          rates: [], duration: 0, error: err.message, retryCount: 0,
        });
      }
    }
  }

  await Promise.allSettled(scrapers.map(s => s.cleanup()));
}

// ─────────────────────────────────────────────────────────────
// RATE STORAGE — uses createMany + skipDuplicates for idempotency
// ─────────────────────────────────────────────────────────────

async function storeRates(hotelName: string, rates: ScrapedRate[]): Promise<number> {
  const hotelConfig = HOTELS_CONFIG.find(h => h.name === hotelName);
  if (!hotelConfig) return 0;

  let hotel = await prisma.hotel.findUnique({ where: { slug: hotelConfig.slug } });
  if (!hotel) {
    hotel = await prisma.hotel.create({
      data: {
        name: hotelConfig.name, slug: hotelConfig.slug,
        category: hotelConfig.category, starRating: hotelConfig.starRating,
        role: hotelConfig.role, website: hotelConfig.website,
        isTarget: 'isTarget' in hotelConfig ? Boolean(hotelConfig.isTarget) : false,
      },
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let saved = 0;
  for (const rate of rates) {
    // Validate rate before inserting
    const rateValue = rate.mapRate ?? rate.cpRate ?? rate.epRate ?? rate.totalWithTax;
    if (!rateValue || isNaN(rateValue) || rateValue <= 0 || rateValue > 1000000) {
      console.warn(`[storeRates] Rejecting invalid rate: ${JSON.stringify({ hotel: hotelName, rate: rateValue, source: rate.source })}`);
      continue;
    }

    let room = await prisma.room.findFirst({ where: { hotelId: hotel.id, name: rate.roomType } });
    if (!room) {
      room = await prisma.room.create({
        data: {
          hotelId: hotel.id, name: rate.roomType,
          type: inferRoomType(rate.roomType), maxOccupancy: rate.occupancy,
        },
      });
    }

    try {
      // DailyRate has no unique composite key — always create, skip P2002 duplicates.
      // On repeated scrapes within the same day, we simply append the new reading.
      await prisma.dailyRate.create({
        data: {
          hotelId: hotel.id, roomId: room.id, date: today,
          mapRate: rate.mapRate, cpRate: rate.cpRate, epRate: rate.epRate,
          taxPercent: rate.taxPercent, taxInclusive: rate.taxInclusive,
          totalWithTax: rate.totalWithTax, singleOccRate: rate.singleOccRate,
          doubleOccRate: rate.doubleOccRate, extraAdultRate: rate.extraAdultRate,
          extraChildRate: rate.extraChildRate, source: rate.source,
          sourceUrl: rate.sourceUrl, isAvailable: rate.isAvailable,
          roomsLeft: rate.roomsLeft, breakfastIncluded: rate.breakfastIncluded,
          dinnerIncluded: rate.dinnerIncluded, lunchIncluded: rate.lunchIncluded,
          mealDetails: rate.mealDetails, cancellationPolicy: rate.cancellationPolicy,
          freeCancellation: rate.freeCancellation, hasDiscount: rate.hasDiscount,
          discountPercent: rate.discountPercent, offerDescription: rate.offerDescription,
          confidence: rate.confidence, scrapedAt: rate.scrapedAt,
        },
      });
      saved++;
    } catch (err: any) {
      if (!err.message?.includes('Unique constraint') && !err.message?.includes('P2002')) {
        console.warn(`[storeRates] create failed for ${rate.source}/${hotelName}: ${err.message}`);
      }
    }
  }

  if (saved > 0) {
    console.log(`[storeRates] ${hotelName}: ${saved}/${rates.length} rates saved to Supabase`);
  }
  return saved;
}

// ─────────────────────────────────────────────────────────────
// RATE HISTORY
// ─────────────────────────────────────────────────────────────

async function updateRateHistory(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const hotels = await prisma.hotel.findMany();
  for (const hotel of hotels) {
    const todaySnap = await prisma.competitorSnapshot.findUnique({
      where: { hotelId_date: { hotelId: hotel.id, date: today } },
    });
    if (!todaySnap?.bestMapRate) continue;

    const yesterdaySnap = await prisma.competitorSnapshot.findUnique({
      where: { hotelId_date: { hotelId: hotel.id, date: yesterday } },
    });

    const deltaPercent = yesterdaySnap?.bestMapRate
      ? calcDeltaPercent(todaySnap.bestMapRate, yesterdaySnap.bestMapRate)
      : null;

    const last7 = await prisma.competitorSnapshot.findMany({
      where: { hotelId: hotel.id, date: { gte: new Date(today.getTime() - 7 * 86400000), lte: today }, bestMapRate: { not: null } },
    });
    const last30 = await prisma.competitorSnapshot.findMany({
      where: { hotelId: hotel.id, date: { gte: new Date(today.getTime() - 30 * 86400000), lte: today }, bestMapRate: { not: null } },
    });

    const movingAvg7  = last7.length  > 0 ? last7.reduce((s, x)  => s + (x.bestMapRate ?? 0), 0) / last7.length  : null;
    const movingAvg30 = last30.length > 0 ? last30.reduce((s, x) => s + (x.bestMapRate ?? 0), 0) / last30.length : null;

    let volatility: number | null = null;
    if (last30.length >= 3) {
      const r = last30.map(s => s.bestMapRate!);
      const avg = r.reduce((a, b) => a + b, 0) / r.length;
      const variance = r.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / r.length;
      volatility = Math.sqrt(variance) / avg;
    }

    try {
      await prisma.rateHistory.upsert({
        where: { hotelId_date_source: { hotelId: hotel.id, date: today, source: todaySnap.bestSource ?? 'aggregated' } },
        update:  { mapRate: todaySnap.bestMapRate, cpRate: todaySnap.bestCpRate, epRate: todaySnap.bestEpRate, deltaPercent, movingAvg7, movingAvg30, volatility },
        create:  { hotelId: hotel.id, date: today, mapRate: todaySnap.bestMapRate, cpRate: todaySnap.bestCpRate, epRate: todaySnap.bestEpRate, source: todaySnap.bestSource ?? 'aggregated', deltaPercent, movingAvg7, movingAvg30, volatility },
      });
    } catch { /* non-fatal */ }
  }
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function inferRoomType(roomName: string): string {
  const lower = roomName.toLowerCase();
  if (lower.includes('suite'))                               return 'suite';
  if (lower.includes('villa') || lower.includes('cottage'))  return 'villa';
  if (lower.includes('deluxe'))                              return 'deluxe';
  if (lower.includes('premium') || lower.includes('superior')) return 'premium';
  return 'standard';
}

function getScrapeWindowLabel(): string {
  const h = new Date().getHours();
  if (h < 9)  return 'MORNING (6 AM cycle)';
  if (h < 15) return 'MIDDAY (12 PM cycle)';
  return 'EVENING (6 PM cycle)';
}
