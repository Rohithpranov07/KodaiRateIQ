// ============================================================
// KodaiRateIQ — Scraping Orchestrator v3
//
// FULL 13-SOURCE OTA AGGREGATION PIPELINE
//
// Sources:
//   Official:  Carlton, Tamara, HKI, Sterling, Le Poshe
//   OTA Tier1: Booking.com, Agoda, Goibibo, MakeMyTrip
//   OTA Tier2: Expedia, Hotels.com, Cleartrip, EaseMyTrip
//   OTA Tier3: ixigo, Yatra, Tripadvisor, Trivago
//
// Pipeline:
//   1. Scrape all OTAs in parallel batches
//   2. Store raw MAP-classified rates in DailyRate
//   3. Cross-verify across sources → select TRUE BAR
//   4. Apply verified BAR to CompetitorSnapshot + OtaBarAudit
//   5. Update RateHistory with day-over-day delta
//   6. Detect stale data
//   7. Trigger AI recommendation regeneration
// ============================================================

import { BookingScraper } from './booking';
import { GoibiboScraper } from './goibibo';
import { MakeMyTripScraper } from './makemytrip';
import { AgodaScraper } from './agoda';
import { ExpediaScraper } from './expedia';
import { HotelsDotComScraper } from './hotelsdotcom';
import { CleartripScraper } from './cleartrip';
import { EaseMyTripScraper } from './easemytrip';
import { IxigoScraper } from './ixigo';
import { YatraScraper } from './yatra';
import { TripadvisorScraper } from './tripadvisor';
import { TrivagoScraper } from './trivago';
import { createOfficialScrapers } from './official';
import { BaseScraper } from './base';
import prisma from '@/lib/db';
import { HOTELS_CONFIG, calcDeltaPercent } from '@/lib/utils';
import type { ScrapedRate, ScrapeResult } from '@/types';
import { verifyTodaysRates, applyVerifiedRates, detectStaleData } from '@/engine/verification';

// ── Scrape Report ─────────────────────────────────────────────

export interface ScrapeReport {
  totalRates: number;
  mapRates: number;          // MAP-classified rates only
  successfulSources: number;
  failedSources: number;
  duration: number;
  results: ScrapeResult[];
  verification: {
    avgConfidence: number;
    verifiedHotels: number;
    anomalyCount: number;
    otaWinners: Record<string, string>; // hotel → winning OTA
  };
  staleStatus: {
    staleHotels: string[];
    degradedHotels: string[];
    freshHotels: string[];
  };
  scrapeWindow: string;
}

// ── Scraper tiers for batched parallel execution ──────────────
// Official sites run first (highest trust), then OTA tiers
const SCRAPER_TIERS = {
  official: () => createOfficialScrapers(),
  tier1: () => [
    new BookingScraper(),
    new AgodaScraper(),
    new GoibiboScraper(),
    new MakeMyTripScraper(),
  ],
  tier2: () => [
    new ExpediaScraper(),
    new HotelsDotComScraper(),
    new CleartripScraper(),
    new EaseMyTripScraper(),
  ],
  tier3: () => [
    new IxigoScraper(),
    new YatraScraper(),
    new TripadvisorScraper(),
    new TrivagoScraper(),
  ],
};

// ─────────────────────────────────────────────────────────────
// FULL SCRAPE PIPELINE
// ─────────────────────────────────────────────────────────────

export async function runFullScrape(): Promise<ScrapeReport> {
  const startTime = Date.now();
  const allResults: ScrapeResult[] = [];
  const scrapeWindow = getScrapeWindowLabel();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Orchestrator] Starting FULL 13-source scrape — ${scrapeWindow}`);
  console.log(`[Orchestrator] Timestamp: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // ── PHASE 1: SCRAPE — batched by tier ─────────────────────
  // Official sites first (highest reliability baseline)
  await runTier('OFFICIAL', SCRAPER_TIERS.official(), today, tomorrow, allResults);

  // Tier 1 OTAs (highest coverage, most reliable)
  await runTier('TIER1', SCRAPER_TIERS.tier1(), today, tomorrow, allResults);

  // Tier 2 OTAs
  await runTier('TIER2', SCRAPER_TIERS.tier2(), today, tomorrow, allResults);

  // Tier 3 OTAs (meta-search aggregators)
  await runTier('TIER3', SCRAPER_TIERS.tier3(), today, tomorrow, allResults);

  // ── PHASE 2: VERIFY ────────────────────────────────────────
  console.log('\n🔍 Running OTA cross-verification...');
  let verificationSummary = await verifyTodaysRates();

  for (const r of verificationSummary.results) {
    const badge = r.confidenceLabel === 'HIGH' ? '✅' : r.confidenceLabel === 'MEDIUM' ? '🟡' : '🔴';
    const rate = r.verifiedMapRate ? `₹${r.verifiedMapRate.toLocaleString('en-IN')}` : 'N/A';
    const otaStr = r.bestSource ? `[${r.bestSource}]` : '';
    const anomStr = r.anomalies.length > 0 ? ` ⚠ ${r.anomalies.length} anomaly(ies)` : '';
    console.log(`  ${badge} ${r.hotelName}: ${rate} MAP ${otaStr} [${r.confidenceLabel}] (${r.sourceCount}/${r.otasChecked} sources)${anomStr}`);
  }

  // ── PHASE 3: APPLY VERIFIED RATES ─────────────────────────
  console.log('\n💾 Applying verified BAR rates to database...');
  await applyVerifiedRates(verificationSummary);

  // ── PHASE 4: UPDATE RATE HISTORY ──────────────────────────
  console.log('📈 Updating rate history...');
  await updateRateHistory();

  // ── PHASE 5: STALE DETECTION ──────────────────────────────
  console.log('🕐 Running stale data detection...');
  const staleStatus = await detectStaleData();

  if (staleStatus.staleHotels.length > 0) {
    console.warn(`⚠️  STALE: ${staleStatus.staleHotels.join(', ')}`);
  }
  if (staleStatus.degradedHotels.length > 0) {
    console.warn(`⚠️  DEGRADED: ${staleStatus.degradedHotels.join(', ')}`);
  }

  // Re-fetch for final report
  verificationSummary = await verifyTodaysRates();

  const successfulSources = allResults.filter(r => r.success).length;
  const failedSources = allResults.filter(r => !r.success).length;
  const totalRates = allResults.reduce((sum, r) => sum + r.rates.length, 0);
  const mapRates = allResults.reduce((sum, r) => sum + r.rates.filter(rate => rate.mapRate != null).length, 0);

  // Build OTA winner map
  const otaWinners: Record<string, string> = {};
  for (const r of verificationSummary.results) {
    if (r.bestSource) otaWinners[r.hotelName] = r.bestSource;
  }

  const report: ScrapeReport = {
    totalRates,
    mapRates,
    successfulSources,
    failedSources,
    duration: Date.now() - startTime,
    results: allResults,
    verification: {
      avgConfidence: verificationSummary.avgConfidence,
      verifiedHotels: verificationSummary.verifiedHotels,
      anomalyCount: verificationSummary.anomalyCount,
      otaWinners,
    },
    staleStatus,
    scrapeWindow,
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Orchestrator] Scrape COMPLETE — ${scrapeWindow}`);
  console.log(`  Total rates: ${totalRates} (${mapRates} MAP) | Sources: ${successfulSources} ok / ${failedSources} failed`);
  console.log(`  Verification: ${report.verification.verifiedHotels}/${verificationSummary.totalHotels} verified`);
  console.log(`  Avg confidence: ${(report.verification.avgConfidence * 100).toFixed(0)}%`);
  console.log(`  Duration: ${(report.duration / 1000).toFixed(1)}s`);
  console.log(`${'='.repeat(60)}\n`);

  return report;
}

// ─────────────────────────────────────────────────────────────
// TIER EXECUTION — Run a set of scrapers for all hotels
// ─────────────────────────────────────────────────────────────

async function runTier(
  tierName: string,
  scrapers: BaseScraper[],
  checkIn: Date,
  checkOut: Date,
  allResults: ScrapeResult[],
): Promise<void> {
  console.log(`\n📡 [${tierName}] Running ${scrapers.length} scrapers...`);

  for (const hotel of HOTELS_CONFIG) {
    // Run all scrapers for this hotel in parallel within tier
    const tierResults = await Promise.allSettled(
      scrapers.map(scraper => scraper.execute(hotel.name, checkIn, checkOut))
    );

    for (let i = 0; i < tierResults.length; i++) {
      const settled = tierResults[i];
      const scraper = scrapers[i];

      if (settled.status === 'fulfilled') {
        const result = settled.value;
        allResults.push(result);

        await prisma.scrapeLog.create({
          data: {
            source: result.source,
            hotelName: hotel.name,
            status: result.success ? 'success' : 'failed',
            duration: result.duration,
            ratesFound: result.rates.length,
            errorMessage: result.error,
            retryCount: result.retryCount,
          },
        });

        if (result.success && result.rates.length > 0) {
          await storeRates(hotel.name, result.rates);
          const mapCount = result.rates.filter(r => r.mapRate != null).length;
          console.log(`  ✓ ${result.source}: ${result.rates.length} rates (${mapCount} MAP) ${result.duration}ms`);
        } else if (result.success) {
          console.log(`  ○ ${result.source}: no rates (${result.duration}ms)`);
        } else {
          console.log(`  ✗ ${result.source}: FAILED — ${result.error}`);
        }
      } else {
        const err = settled.reason as Error;
        console.error(`  ✗ ${scraper.source}: EXCEPTION — ${err.message}`);

        await prisma.scrapeLog.create({
          data: {
            source: scraper.source,
            hotelName: hotel.name,
            status: 'failed',
            duration: 0,
            ratesFound: 0,
            errorMessage: err.message,
          },
        });

        allResults.push({
          success: false,
          source: scraper.source,
          hotelName: hotel.name,
          rates: [],
          duration: 0,
          error: err.message,
          retryCount: 0,
        });
      }
    }
  }

  // Cleanup browsers for this tier
  await Promise.allSettled(scrapers.map(s => s.cleanup()));
}

// ─────────────────────────────────────────────────────────────
// RATE STORAGE — Raw scraped data into DailyRate
// ─────────────────────────────────────────────────────────────

async function storeRates(hotelName: string, rates: ScrapedRate[]): Promise<void> {
  const hotelConfig = HOTELS_CONFIG.find(h => h.name === hotelName);
  if (!hotelConfig) return;

  let hotel = await prisma.hotel.findUnique({ where: { slug: hotelConfig.slug } });

  if (!hotel) {
    hotel = await prisma.hotel.create({
      data: {
        name: hotelConfig.name,
        slug: hotelConfig.slug,
        category: hotelConfig.category,
        starRating: hotelConfig.starRating,
        role: hotelConfig.role,
        website: hotelConfig.website,
        isTarget: 'isTarget' in hotelConfig ? Boolean(hotelConfig.isTarget) : false,
      },
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const rate of rates) {
    let room = await prisma.room.findFirst({
      where: { hotelId: hotel.id, name: rate.roomType },
    });

    if (!room) {
      room = await prisma.room.create({
        data: {
          hotelId: hotel.id,
          name: rate.roomType,
          type: inferRoomType(rate.roomType),
          maxOccupancy: rate.occupancy,
        },
      });
    }

    await prisma.dailyRate.create({
      data: {
        hotelId: hotel.id,
        roomId: room.id,
        date: today,
        mapRate: rate.mapRate,
        cpRate: rate.cpRate,
        epRate: rate.epRate,
        taxPercent: rate.taxPercent,
        taxInclusive: rate.taxInclusive,
        totalWithTax: rate.totalWithTax,
        singleOccRate: rate.singleOccRate,
        doubleOccRate: rate.doubleOccRate,
        extraAdultRate: rate.extraAdultRate,
        extraChildRate: rate.extraChildRate,
        source: rate.source,
        sourceUrl: rate.sourceUrl,
        isAvailable: rate.isAvailable,
        roomsLeft: rate.roomsLeft,
        breakfastIncluded: rate.breakfastIncluded,
        dinnerIncluded: rate.dinnerIncluded,
        lunchIncluded: rate.lunchIncluded,
        mealDetails: rate.mealDetails,
        cancellationPolicy: rate.cancellationPolicy,
        freeCancellation: rate.freeCancellation,
        hasDiscount: rate.hasDiscount,
        discountPercent: rate.discountPercent,
        offerDescription: rate.offerDescription,
        confidence: rate.confidence,
        scrapedAt: rate.scrapedAt,
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────
// RATE HISTORY — Day-over-day tracking with moving averages
// ─────────────────────────────────────────────────────────────

async function updateRateHistory(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const hotels = await prisma.hotel.findMany();

  for (const hotel of hotels) {
    const todaySnapshot = await prisma.competitorSnapshot.findUnique({
      where: { hotelId_date: { hotelId: hotel.id, date: today } },
    });

    if (!todaySnapshot?.bestMapRate) continue;

    const yesterdaySnapshot = await prisma.competitorSnapshot.findUnique({
      where: { hotelId_date: { hotelId: hotel.id, date: yesterday } },
    });

    const deltaPercent = yesterdaySnapshot?.bestMapRate
      ? calcDeltaPercent(todaySnapshot.bestMapRate, yesterdaySnapshot.bestMapRate)
      : null;

    // Calculate moving averages from real snapshots
    const last7 = await prisma.competitorSnapshot.findMany({
      where: {
        hotelId: hotel.id,
        date: { gte: new Date(today.getTime() - 7 * 86400000), lte: today },
        bestMapRate: { not: null },
      },
    });

    const last30 = await prisma.competitorSnapshot.findMany({
      where: {
        hotelId: hotel.id,
        date: { gte: new Date(today.getTime() - 30 * 86400000), lte: today },
        bestMapRate: { not: null },
      },
    });

    const movingAvg7 = last7.length > 0
      ? last7.reduce((sum, s) => sum + (s.bestMapRate || 0), 0) / last7.length
      : null;

    const movingAvg30 = last30.length > 0
      ? last30.reduce((sum, s) => sum + (s.bestMapRate || 0), 0) / last30.length
      : null;

    // Volatility: std dev of last 30 days
    let volatility: number | null = null;
    if (last30.length >= 3) {
      const rates30 = last30.map(s => s.bestMapRate!);
      const avg30 = rates30.reduce((a, b) => a + b, 0) / rates30.length;
      const variance = rates30.reduce((a, b) => a + Math.pow(b - avg30, 2), 0) / rates30.length;
      volatility = Math.sqrt(variance) / avg30; // Coefficient of variation
    }

    await prisma.rateHistory.upsert({
      where: {
        hotelId_date_source: {
          hotelId: hotel.id,
          date: today,
          source: todaySnapshot.bestSource || 'aggregated',
        },
      },
      update: {
        mapRate: todaySnapshot.bestMapRate,
        cpRate: todaySnapshot.bestCpRate,
        epRate: todaySnapshot.bestEpRate,
        deltaPercent,
        movingAvg7,
        movingAvg30,
        volatility,
      },
      create: {
        hotelId: hotel.id,
        date: today,
        mapRate: todaySnapshot.bestMapRate,
        cpRate: todaySnapshot.bestCpRate,
        epRate: todaySnapshot.bestEpRate,
        source: todaySnapshot.bestSource || 'aggregated',
        deltaPercent,
        movingAvg7,
        movingAvg30,
        volatility,
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function inferRoomType(roomName: string): string {
  const lower = roomName.toLowerCase();
  if (lower.includes('suite')) return 'suite';
  if (lower.includes('villa') || lower.includes('cottage')) return 'villa';
  if (lower.includes('deluxe')) return 'deluxe';
  if (lower.includes('premium') || lower.includes('superior')) return 'premium';
  return 'standard';
}

function getScrapeWindowLabel(): string {
  const hour = new Date().getHours();
  if (hour < 9) return 'MORNING (6 AM cycle)';
  if (hour < 15) return 'MIDDAY (12 PM cycle)';
  return 'EVENING (6 PM cycle)';
}
