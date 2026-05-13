// ============================================================
// KodaiRateIQ — Pricing Recommendation Engine
// Core business logic for Hotel Kodai International pricing
// AI Provider: Xiaomi MiMo AI (https://token-plan-sgp.xiaomimimo.com/v1)
// ============================================================

import prisma from '@/lib/db';
import { generatePricingRecommendation } from '@/services/ai/recommendation-engine';
import { generateMarketInsights } from '@/services/ai/insight-engine';
import { POSITIONING_WEIGHTS, getSeasonType, isWeekend, calcDeltaPercent } from '@/lib/utils';
import type { PricingRecommendation, CompetitorRateSummary } from '@/types';

const MIMO_MODEL = process.env.MIMO_MODEL || 'MiMo-7B-RL';

export async function generateRecommendation(): Promise<PricingRecommendation> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Fetch latest competitor snapshots
  const competitorRates = await fetchCompetitorRates(today);

  // 2. Determine market context
  const seasonType = getSeasonType(today);
  const weekend = isWeekend(today);

  // 3. Fetch historical data for trend analysis
  const historicalData = await fetchHistoricalData();

  // 4. Fetch OTA spread data (multi-source rates for same hotel)
  const otaSpread = await fetchOtaSpread(today);

  // 5. Fetch occupancy/availability signals
  const occupancySignals = await fetchOccupancySignals(today);

  // 6. Fetch recent recommendation history (last 7 days)
  const recentRecommendations = await fetchRecentRecommendations();

  // 7. Calculate algorithmic rate as grounding reference
  const algorithmicRate = calculateAlgorithmicRate(competitorRates, seasonType, weekend);

  // 8. Get MiMo AI-powered recommendation with full live data injection
  const aiRecommendation = await generatePricingRecommendation({
    competitorRates,
    seasonType,
    isWeekend: weekend,
    historicalAvgRate: historicalData.avgRate,
    historicalTrend: historicalData.trend,
    recentTrends: historicalData.trends,
    date: today.toISOString().split('T')[0],
    algorithmicRate,
    recentRecommendations,
    otaSpread,
    occupancySignals,
  });

  // 9. Blend algorithmic and AI recommendations (60% AI / 40% algorithmic)
  const blendedRate = blendRecommendations(algorithmicRate, aiRecommendation.recommended_map_rate);

  // 10. Get HKI current live rate for insight context
  const hkiCurrentRate = await fetchHkiCurrentRate(today);

  // 11. Generate MiMo AI market insights with full live data
  const insights = await generateMarketInsights({
    competitorRates,
    recentTrends: historicalData.trends,
    seasonType,
    isWeekend: weekend,
    date: today.toISOString().split('T')[0],
    currentHkiRate: hkiCurrentRate,
    recommendedHkiRate: blendedRate,
    occupancySignals,
    otaSpread,
  });

  // 12. Persist insights to DB
  for (const insight of insights) {
    await prisma.aiInsight.create({
      data: {
        date: today,
        type: insight.type,
        title: insight.title,
        summary: insight.summary,
        severity: insight.severity,
        actionable: insight.actionable,
        confidence: aiRecommendation.confidence_score,
      },
    });
  }

  // 13. Build final recommendation
  const recommendation: PricingRecommendation = {
    recommendedMapRate: blendedRate,
    recommendedCpRate: Math.round(blendedRate * 0.82),
    recommendedEpRate: Math.round(blendedRate * 0.65),
    minRate: aiRecommendation.min_rate,
    maxRate: aiRecommendation.max_rate,
    optimalRate: blendedRate,
    strategy: aiRecommendation.pricing_strategy as PricingRecommendation['strategy'],
    confidenceScore: aiRecommendation.confidence_score,
    reasoning: aiRecommendation.reasoning,
    marketPosition: determineMarketPosition(blendedRate, competitorRates),
    seasonType: seasonType as PricingRecommendation['seasonType'],
    demandLevel: aiRecommendation.demand_level as PricingRecommendation['demandLevel'],
    weekendPremium: aiRecommendation.weekend_premium_percent,
    competitorRates,
  };

  // 14. Store recommendation in database
  const targetHotel = await prisma.hotel.findFirst({ where: { isTarget: true } });
  if (targetHotel) {
    const validRates = competitorRates.filter(r => r.bestMapRate != null);
    const avgCompRate = validRates.length > 0
      ? validRates.reduce((sum, r) => sum + r.bestMapRate!, 0) / validRates.length
      : null;

    await prisma.recommendation.create({
      data: {
        hotelId: targetHotel.id,
        date: today,
        recommendedMapRate: recommendation.recommendedMapRate,
        recommendedCpRate: recommendation.recommendedCpRate,
        recommendedEpRate: recommendation.recommendedEpRate,
        minRate: recommendation.minRate,
        maxRate: recommendation.maxRate,
        optimalRate: recommendation.optimalRate,
        strategy: recommendation.strategy,
        confidenceScore: recommendation.confidenceScore,
        reasoning: recommendation.reasoning,
        avgCompetitorRate: avgCompRate,
        marketPosition: recommendation.marketPosition,
        aiModel: MIMO_MODEL,
        aiPromptVersion: '2.0',
        rawAiResponse: JSON.stringify(aiRecommendation),
        seasonType,
        demandLevel: recommendation.demandLevel,
        weekendPremium: recommendation.weekendPremium,
      },
    });
  }

  return recommendation;
}

// ============================================================
// DATA FETCHERS — All inject real DB data into AI prompts
// ============================================================

async function fetchCompetitorRates(date: Date): Promise<CompetitorRateSummary[]> {
  const hotels = await prisma.hotel.findMany({
    include: {
      competitorSnapshots: {
        where: { date },
        take: 1,
      },
    },
  });

  return hotels.map(hotel => ({
    hotelName: hotel.name,
    bestMapRate: hotel.competitorSnapshots[0]?.bestMapRate ?? null,
    bestSource: hotel.competitorSnapshots[0]?.bestSource ?? null,
    delta: null,
    position: hotel.role,
  }));
}

async function fetchHkiCurrentRate(date: Date): Promise<number | null> {
  const hki = await prisma.hotel.findFirst({ where: { isTarget: true } });
  if (!hki) return null;
  const snap = await prisma.competitorSnapshot.findFirst({
    where: { hotelId: hki.id, date },
  });
  return snap?.bestMapRate ?? null;
}

async function fetchHistoricalData(): Promise<{
  avgRate: number | null;
  trend: 'rising' | 'falling' | 'stable';
  trends: Array<{ hotel: string; delta7d: number; delta30d: number }>;
}> {
  const targetHotel = await prisma.hotel.findFirst({ where: { isTarget: true } });
  if (!targetHotel) return { avgRate: null, trend: 'stable', trends: [] };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

  const history = await prisma.rateHistory.findMany({
    where: { hotelId: targetHotel.id, date: { gte: thirtyDaysAgo, lte: today } },
    orderBy: { date: 'asc' },
  });

  const avgRate = history.length > 0
    ? history.reduce((sum, h) => sum + (h.mapRate || 0), 0) / history.length
    : null;

  let trend: 'rising' | 'falling' | 'stable' = 'stable';
  if (history.length >= 7) {
    const recent = history.slice(-7);
    const older = history.slice(-14, -7);
    if (recent.length > 0 && older.length > 0) {
      const recentAvg = recent.reduce((s, h) => s + (h.mapRate || 0), 0) / recent.length;
      const olderAvg = older.reduce((s, h) => s + (h.mapRate || 0), 0) / older.length;
      const change = calcDeltaPercent(recentAvg, olderAvg);
      trend = change > 3 ? 'rising' : change < -3 ? 'falling' : 'stable';
    }
  }

  const allHotels = await prisma.hotel.findMany();
  const trends = await Promise.all(
    allHotels.map(async hotel => {
      const hotelHistory = await prisma.rateHistory.findMany({
        where: { hotelId: hotel.id, date: { gte: thirtyDaysAgo, lte: today }, mapRate: { not: null } },
        orderBy: { date: 'asc' },
      });

      if (hotelHistory.length < 2) return { hotel: hotel.name, delta7d: 0, delta30d: 0 };

      const latest = hotelHistory[hotelHistory.length - 1].mapRate!;
      const weekAgo = hotelHistory.find(h => {
        const diff = today.getTime() - new Date(h.date).getTime();
        return diff >= 6 * 86400000 && diff <= 8 * 86400000;
      });
      const monthAgo = hotelHistory[0];

      return {
        hotel: hotel.name,
        delta7d: weekAgo?.mapRate ? calcDeltaPercent(latest, weekAgo.mapRate) : 0,
        delta30d: monthAgo?.mapRate ? calcDeltaPercent(latest, monthAgo.mapRate) : 0,
      };
    })
  );

  return { avgRate, trend, trends };
}

async function fetchOtaSpread(date: Date): Promise<Array<{ hotel: string; source: string; mapRate: number }>> {
  const rates = await prisma.dailyRate.findMany({
    where: { date, isAvailable: true, mapRate: { not: null } },
    include: { hotel: { select: { name: true } } },
    orderBy: { mapRate: 'asc' },
  });

  return rates
    .filter(r => r.mapRate != null)
    .map(r => ({
      hotel: r.hotel.name,
      source: r.source,
      mapRate: r.mapRate!,
    }))
    .slice(0, 20);
}

async function fetchOccupancySignals(date: Date): Promise<Array<{ hotel: string; availability: string }>> {
  const snapshots = await prisma.competitorSnapshot.findMany({
    where: { date },
    include: { hotel: { select: { name: true } } },
  });

  return snapshots
    .filter(s => s.availability != null)
    .map(s => ({
      hotel: s.hotel.name,
      availability: s.availability!,
    }));
}

async function fetchRecentRecommendations(): Promise<Array<{ date: string; rate: number; strategy: string; confidence: number }>> {
  const targetHotel = await prisma.hotel.findFirst({ where: { isTarget: true } });
  if (!targetHotel) return [];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recs = await prisma.recommendation.findMany({
    where: { hotelId: targetHotel.id, date: { gte: sevenDaysAgo } },
    orderBy: { date: 'desc' },
    take: 7,
  });

  return recs.map(r => ({
    date: r.date.toISOString().split('T')[0],
    rate: r.recommendedMapRate,
    strategy: r.strategy,
    confidence: r.confidenceScore,
  }));
}

// ============================================================
// ALGORITHMIC ENGINE — Real data, no hardcoded values
// ============================================================

function calculateAlgorithmicRate(
  competitors: CompetitorRateSummary[],
  seasonType: string,
  weekend: boolean
): number {
  const weights = POSITIONING_WEIGHTS;
  let weightedSum = 0;
  let totalWeight = 0;

  const findRate = (partialName: string) =>
    competitors.find(c => c.hotelName.toLowerCase().includes(partialName))?.bestMapRate;

  const carltonRate = findRate('carlton');
  const tamaraRate = findRate('tamara');
  const sterlingRate = findRate('sterling');
  const lePosheRate = findRate('poshe');

  if (sterlingRate) {
    weightedSum += sterlingRate * 0.90 * weights['sterling-kodai-lake'].weight;
    totalWeight += weights['sterling-kodai-lake'].weight;
  }
  if (lePosheRate) {
    weightedSum += lePosheRate * 1.02 * weights['le-poshe-by-sparsa'].weight;
    totalWeight += weights['le-poshe-by-sparsa'].weight;
  }
  if (carltonRate) {
    weightedSum += carltonRate * 0.48 * weights['the-carlton'].weight;
    totalWeight += weights['the-carlton'].weight;
  }
  if (tamaraRate) {
    weightedSum += tamaraRate * 0.38 * weights['the-tamara-kodai'].weight;
    totalWeight += weights['the-tamara-kodai'].weight;
  }

  let baseRate = totalWeight > 0 ? weightedSum / totalWeight : 8000;

  const seasonMultipliers: Record<string, number> = {
    peak: 1.18, festival: 1.22, shoulder: 1.05, 'off-peak': 0.88,
  };
  baseRate *= seasonMultipliers[seasonType] ?? 1.0;
  if (weekend) baseRate *= 1.12;

  return Math.max(5000, Math.min(12000, Math.round(baseRate / 100) * 100));
}

function blendRecommendations(algorithmic: number, ai: number): number {
  return Math.round(((ai * 0.6) + (algorithmic * 0.4)) / 100) * 100;
}

function determineMarketPosition(
  rate: number,
  competitors: CompetitorRateSummary[]
): 'below-market' | 'at-market' | 'above-market' {
  const validRates = competitors
    .filter(c => c.bestMapRate != null && c.position !== 'ultra-premium-anchor' && c.position !== 'premium-anchor')
    .map(c => c.bestMapRate!);

  if (validRates.length === 0) return 'at-market';
  const avg = validRates.reduce((a, b) => a + b, 0) / validRates.length;
  if (rate < avg * 0.95) return 'below-market';
  if (rate > avg * 1.05) return 'above-market';
  return 'at-market';
}

// ============================================================
// READ PATH — Latest stored recommendation
// ============================================================

export async function getLatestRecommendation(): Promise<PricingRecommendation | null> {
  const targetHotel = await prisma.hotel.findFirst({ where: { isTarget: true } });
  if (!targetHotel) return null;

  const rec = await prisma.recommendation.findFirst({
    where: { hotelId: targetHotel.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!rec) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const competitorRates = await fetchCompetitorRates(rec.date);

  return {
    recommendedMapRate: rec.recommendedMapRate,
    recommendedCpRate: rec.recommendedCpRate ?? undefined,
    recommendedEpRate: rec.recommendedEpRate ?? undefined,
    minRate: rec.minRate,
    maxRate: rec.maxRate,
    optimalRate: rec.optimalRate,
    strategy: rec.strategy as PricingRecommendation['strategy'],
    confidenceScore: rec.confidenceScore,
    reasoning: rec.reasoning,
    marketPosition: (rec.marketPosition ?? 'at-market') as PricingRecommendation['marketPosition'],
    seasonType: rec.seasonType as PricingRecommendation['seasonType'],
    demandLevel: rec.demandLevel as PricingRecommendation['demandLevel'],
    weekendPremium: rec.weekendPremium ?? 0,
    competitorRates,
  };
}
