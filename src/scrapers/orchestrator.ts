// ============================================================
// KodaiRateIQ — Scraping Orchestrator
// Coordinates all scrapers and stores results in the database
// ============================================================

import { BookingScraper } from './booking';
import { GoibiboScraper } from './goibibo';
import { MakeMyTripScraper } from './makemytrip';
import { BaseScraper } from './base';
import prisma from '@/lib/db';
import { HOTELS_CONFIG, calcDeltaPercent } from '@/lib/utils';
import type { ScrapedRate, ScrapeResult } from '@/types';

/**
 * Orchestrate scraping across all sources for all hotels
 */
export async function runFullScrape(): Promise<{
  totalRates: number;
  successfulSources: number;
  failedSources: number;
  duration: number;
  results: ScrapeResult[];
}> {
  const startTime = Date.now();
  const allResults: ScrapeResult[] = [];

  // Initialize scrapers
  const scrapers: BaseScraper[] = [
    new BookingScraper(),
    new GoibiboScraper(),
    new MakeMyTripScraper(),
  ];

  // Set check-in/check-out dates (today/tomorrow)
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    // Scrape each hotel from each source
    for (const hotel of HOTELS_CONFIG) {
      for (const scraper of scrapers) {
        try {
          const result = await scraper.execute(hotel.name, today, tomorrow);
          allResults.push(result);

          // Log the scrape attempt
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

          // Store scraped rates
          if (result.success && result.rates.length > 0) {
            await storeRates(hotel.name, result.rates);
          }
        } catch (err) {
          console.error(`Orchestrator error for ${hotel.name} on ${scraper.source}:`, err);
          
          await prisma.scrapeLog.create({
            data: {
              source: scraper.source,
              hotelName: hotel.name,
              status: 'failed',
              duration: 0,
              ratesFound: 0,
              errorMessage: (err as Error).message,
            },
          });
        }
      }
    }

    // Update competitor snapshots
    await updateCompetitorSnapshots();

    // Update rate history
    await updateRateHistory();
  } finally {
    // Cleanup all browsers
    for (const scraper of scrapers) {
      await scraper.cleanup();
    }
  }

  const successfulSources = allResults.filter(r => r.success).length;
  const failedSources = allResults.filter(r => !r.success).length;
  const totalRates = allResults.reduce((sum, r) => sum + r.rates.length, 0);

  return {
    totalRates,
    successfulSources,
    failedSources,
    duration: Date.now() - startTime,
    results: allResults,
  };
}

/**
 * Store scraped rates in the database
 */
async function storeRates(hotelName: string, rates: ScrapedRate[]): Promise<void> {
  // Find or create hotel
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
    // Find or create room
    let room = await prisma.room.findFirst({
      where: { hotelId: hotel.id, name: rate.roomType },
    });

    if (!room) {
      room = await prisma.room.create({
        data: {
          hotelId: hotel.id,
          name: rate.roomType,
          type: rate.roomType.toLowerCase().includes('deluxe') ? 'deluxe'
            : rate.roomType.toLowerCase().includes('suite') ? 'suite'
            : rate.roomType.toLowerCase().includes('premium') ? 'premium'
            : 'standard',
          maxOccupancy: rate.occupancy,
        },
      });
    }

    // Upsert daily rate
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

/**
 * Update competitor snapshots with best rates
 */
async function updateCompetitorSnapshots(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hotels = await prisma.hotel.findMany();

  for (const hotel of hotels) {
    const todayRates = await prisma.dailyRate.findMany({
      where: {
        hotelId: hotel.id,
        date: today,
        isValid: true,
      },
      orderBy: { mapRate: 'asc' },
    });

    if (todayRates.length === 0) continue;

    // Calculate best MAP rate (prefer MAP, fall back to CP, then EP)
    const mapRates = todayRates.filter(r => r.mapRate != null).map(r => r.mapRate!);
    const cpRates = todayRates.filter(r => r.cpRate != null).map(r => r.cpRate!);
    const epRates = todayRates.filter(r => r.epRate != null).map(r => r.epRate!);

    const bestMap = mapRates.length > 0 ? Math.min(...mapRates) : null;
    const bestCp = cpRates.length > 0 ? Math.min(...cpRates) : null;
    const bestEp = epRates.length > 0 ? Math.min(...epRates) : null;

    const bestRate = todayRates.find(r => r.mapRate === bestMap) || todayRates[0];

    await prisma.competitorSnapshot.upsert({
      where: {
        hotelId_date: { hotelId: hotel.id, date: today },
      },
      update: {
        bestMapRate: bestMap,
        bestCpRate: bestCp,
        bestEpRate: bestEp,
        bestSource: bestRate.source,
        worstMapRate: mapRates.length > 0 ? Math.max(...mapRates) : null,
        avgMapRate: mapRates.length > 0 ? mapRates.reduce((a, b) => a + b, 0) / mapRates.length : null,
      },
      create: {
        hotelId: hotel.id,
        date: today,
        bestMapRate: bestMap,
        bestCpRate: bestCp,
        bestEpRate: bestEp,
        bestSource: bestRate.source,
        worstMapRate: mapRates.length > 0 ? Math.max(...mapRates) : null,
        avgMapRate: mapRates.length > 0 ? mapRates.reduce((a, b) => a + b, 0) / mapRates.length : null,
      },
    });
  }
}

/**
 * Update rate history with day-over-day changes
 */
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

    // Calculate 7-day and 30-day moving averages
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
      },
    });
  }
}
