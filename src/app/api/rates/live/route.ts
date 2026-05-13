// ============================================================
// KodaiRateIQ — API: Live Rates v2
// GET /api/rates/live
//
// Returns the TRUE VERIFIED BAR for every hotel with full
// enterprise trust metadata:
//   - Lowest verified MAP rate across all OTA sources
//   - OTA winner (which source had the lowest MAP)
//   - OTA count (how many sources confirmed MAP rates)
//   - OTA breakdown (per-source MAP rate map)
//   - Confidence score + label
//   - Freshness indicator
//   - Day-over-day delta (real, not synthetic)
//   - Stale data flag
//
// NEVER returns fabricated or synthetic data.
// ============================================================

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { calcDeltaPercent, getTrend } from '@/lib/utils';
import type { ApiResponse } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ── Freshness thresholds ──────────────────────────────────────
function getDataFreshness(scrapeDate: Date | null): 'fresh' | 'recent' | 'aging' | 'stale' | 'no-data' {
  if (!scrapeDate) return 'no-data';
  const hoursAgo = (Date.now() - new Date(scrapeDate).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 6) return 'fresh';
  if (hoursAgo < 24) return 'recent';
  if (hoursAgo < 72) return 'aging';
  return 'stale';
}

function freshnessToScore(f: string): number {
  const map: Record<string, number> = { fresh: 1.0, recent: 0.85, aging: 0.65, stale: 0.4, 'no-data': 0 };
  return map[f] ?? 0.5;
}

export interface EnhancedLiveRateRow {
  hotelId: string;
  hotelName: string;
  slug: string;
  category: string;
  luxuryTier: string | null;
  facilityScore: string | null;
  starRating: number;
  role: string;
  isTarget: boolean;
  // Verified BAR
  currentMapRate: number | null;
  currentCpRate: number | null;
  currentEpRate: number | null;
  // Delta
  yesterdayMapRate: number | null;
  deltaPercent: number | null;
  trend: 'up' | 'down' | 'stable';
  // OTA intelligence
  cheapestOta: string | null;
  otaCount: number;              // How many OTAs verified this BAR
  otasChecked: number;           // Total OTAs attempted
  otaBreakdown: Record<string, number> | null; // source → MAP rate
  // Trust indicators
  confidence: number;
  confidenceLabel: 'HIGH' | 'MEDIUM' | 'LOW';
  freshness: 'fresh' | 'recent' | 'aging' | 'stale' | 'no-data';
  lastVerifiedAt: string | null;
  isStale: boolean;
  anomalyFlags: string[];
  // Availability
  availability: string;
  // Recommended rate (target hotel only)
  recommendedRate?: number;
}

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const hotels = await prisma.hotel.findMany({ orderBy: { starRating: 'desc' } });

    // Latest AI recommendation for target hotel
    const latestRec = await prisma.recommendation.findFirst({
      where: { hotel: { isTarget: true } },
      orderBy: { createdAt: 'desc' },
    });

    const liveRates: EnhancedLiveRateRow[] = [];

    for (const hotel of hotels) {
      // Today's verified snapshot (prioritise today, fallback to yesterday if fresh enough)
      const todaySnap = await prisma.competitorSnapshot.findFirst({
        where: {
          hotelId: hotel.id,
          date: { gte: yesterdayStart, lt: todayEnd },
        },
        orderBy: { date: 'desc' },
      });

      // True yesterday snapshot (strictly before today)
      const yesterdaySnap = await prisma.competitorSnapshot.findFirst({
        where: {
          hotelId: hotel.id,
          date: { lt: yesterdayStart },
        },
        orderBy: { date: 'desc' },
      });

      const currentRate = todaySnap?.bestMapRate ?? null;
      const yesterdayRate = yesterdaySnap?.bestMapRate ?? null;

      // Delta only when BOTH verified rates exist — no synthetic percentages
      const deltaPercent = currentRate && yesterdayRate
        ? Math.round(calcDeltaPercent(currentRate, yesterdayRate) * 10) / 10
        : null;

      // Last scrape timestamp for freshness
      const lastScrape = await prisma.dailyRate.findFirst({
        where: { hotelId: hotel.id, isValid: true },
        orderBy: { scrapedAt: 'desc' },
        select: { scrapedAt: true },
      });

      const freshness = getDataFreshness(lastScrape?.scrapedAt ?? null);

      // Build final confidence — trust snapshot's stored score, degrade for staleness
      let confidence = todaySnap?.confidenceScore ?? 0.5;
      confidence *= freshnessToScore(freshness);
      confidence = Math.round(Math.min(1, confidence) * 100) / 100;

      const confidenceLabel: 'HIGH' | 'MEDIUM' | 'LOW' =
        confidence >= 0.80 ? 'HIGH' : confidence >= 0.60 ? 'MEDIUM' : 'LOW';

      // OTA breakdown from stored JSON
      let otaBreakdown: Record<string, number> | null = null;
      try {
        if (todaySnap?.otaBreakdown) {
          otaBreakdown = JSON.parse(todaySnap.otaBreakdown as string);
        }
      } catch { /* malformed JSON — skip */ }

      // Anomaly flags from stored JSON
      let anomalyFlags: string[] = [];
      try {
        if (todaySnap?.anomalyFlags) {
          anomalyFlags = JSON.parse(todaySnap.anomalyFlags as string);
        }
      } catch { /* skip */ }

      // Availability
      let availability = todaySnap?.availability ?? 'no-data';
      if (!availability || availability === 'unknown') {
        availability = currentRate ? 'unverified' : 'no-data';
      }

      liveRates.push({
        hotelId: hotel.id,
        hotelName: hotel.name,
        slug: hotel.slug,
        category: hotel.category,
        luxuryTier: hotel.luxuryTier,
        facilityScore: hotel.facilityScore,
        starRating: hotel.starRating,
        role: hotel.role,
        isTarget: hotel.isTarget,
        // Verified BAR
        currentMapRate: currentRate,
        currentCpRate: todaySnap?.bestCpRate ?? null,
        currentEpRate: todaySnap?.bestEpRate ?? null,
        // Delta
        yesterdayMapRate: yesterdayRate,
        deltaPercent,
        trend: getTrend(deltaPercent),
        // OTA intelligence
        cheapestOta: todaySnap?.bestSource ?? null,
        otaCount: todaySnap?.otaCount ?? 0,
        otasChecked: todaySnap?.otasChecked ?? 0,
        otaBreakdown,
        // Trust
        confidence,
        confidenceLabel,
        freshness,
        lastVerifiedAt: todaySnap?.verifiedAt?.toISOString() ?? lastScrape?.scrapedAt?.toISOString() ?? null,
        isStale: todaySnap?.isStale ?? (freshness === 'stale'),
        anomalyFlags,
        availability,
        recommendedRate: hotel.isTarget && latestRec ? latestRec.recommendedMapRate : undefined,
      });
    }

    const avgConf = liveRates.length > 0
      ? liveRates.reduce((s, r) => s + r.confidence, 0) / liveRates.length
      : 0;

    const dataQuality =
      avgConf >= 0.85 ? 'enterprise-verified' :
      avgConf >= 0.70 ? 'production-ready' :
      avgConf >= 0.50 ? 'baseline' :
      'insufficient';

    const response: ApiResponse<{
      rates: EnhancedLiveRateRow[];
      lastUpdated: string;
      dataQuality: string;
      avgConfidence: number;
    }> = {
      success: true,
      data: {
        rates: liveRates,
        lastUpdated: new Date().toISOString(),
        dataQuality,
        avgConfidence: Math.round(avgConf * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Live rates API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch live rates', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
