// ============================================================
// KodaiRateIQ — Pricing Recommendation Engine
// Core business logic for Hotel Kodai International pricing
// ============================================================

import prisma from '@/lib/db';
import { generatePricingRecommendation, generateMarketInsights } from '@/lib/gemini';
import { POSITIONING_WEIGHTS, HOTELS_CONFIG, getSeasonType, isWeekend, calcDeltaPercent } from '@/lib/utils';
import type { PricingRecommendation, CompetitorRateSummary } from '@/types';

/**
 * Generate complete pricing recommendation for Hotel Kodai International
 */
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

  // 4. Calculate algorithmic recommendation
  const algorithmicRate = calculateAlgorithmicRate(competitorRates, seasonType, weekend);

  // 5. Get AI-powered recommendation
  const aiRecommendation = await generatePricingRecommendation({
    competitorRates,
    seasonType,
    isWeekend: weekend,
    historicalAvgRate: historicalData.avgRate,
    historicalTrend: historicalData.trend,
    date: today.toISOString().split('T')[0],
  });

  // 6. Blend algorithmic and AI recommendations
  const blendedRate = blendRecommendations(algorithmicRate, aiRecommendation.recommended_map_rate);

  // 7. Generate insights
  const insights = await generateMarketInsights({
    competitorRates,
    recentTrends: historicalData.trends,
    seasonType,
    date: today.toISOString().split('T')[0],
  });

  // 8. Store insights
  for (const insight of insights) {
    await prisma.aiInsight.create({
      data: {
        date: today,
        type: insight.type,
        title: insight.title,
        summary: insight.summary,
        severity: insight.severity,
        actionable: insight.actionable,
        confidence: 0.8,
      },
    });
  }

  // 9. Build final recommendation
  const recommendation: PricingRecommendation = {
    recommendedMapRate: blendedRate,
    recommendedCpRate: Math.round(blendedRate * 0.82), // CP is ~82% of MAP
    recommendedEpRate: Math.round(blendedRate * 0.65), // EP is ~65% of MAP
    minRate: aiRecommendation.min_rate,
    maxRate: aiRecommendation.max_rate,
    optimalRate: blendedRate,
    strategy: aiRecommendation.pricing_strategy as PricingRecommendation['strategy'],
    confidenceScore: aiRecommendation.confidence_score,
    reasoning: aiRecommendation.reasoning,
    marketPosition: determineMarketPosition(blendedRate, competitorRates),
    seasonType,
    demandLevel: aiRecommendation.demand_level as PricingRecommendation['demandLevel'],
    weekendPremium: aiRecommendation.weekend_premium_percent,
    competitorRates,
  };

  // 10. Store recommendation in database
  const targetHotel = await prisma.hotel.findFirst({ where: { isTarget: true } });
  if (targetHotel) {
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
        avgCompetitorRate: competitorRates.reduce((sum, r) => sum + (r.bestMapRate || 0), 0) / competitorRates.filter(r => r.bestMapRate).length,
        marketPosition: recommendation.marketPosition,
        seasonType,
        demandLevel: recommendation.demandLevel,
        weekendPremium: recommendation.weekendPremium,
        rawAiResponse: JSON.stringify(aiRecommendation),
      },
    });
  }

  return recommendation;
}

/**
 * Fetch latest competitor rates from snapshots
 */
async function fetchCompetitorRates(date: Date): Promise<CompetitorRateSummary[]> {
  const hotels = await prisma.hotel.findMany({
    include: {
      competitorSnapshots: {
        where: { date },
        take: 1,
      },
    },
  });

  return hotels.map(hotel => {
    const snapshot = hotel.competitorSnapshots[0];
    return {
      hotelName: hotel.name,
      bestMapRate: snapshot?.bestMapRate ?? null,
      bestSource: snapshot?.bestSource ?? null,
      delta: null, // Will be calculated after recommendation
      position: hotel.role,
    };
  });
}

/**
 * Fetch historical data for trend analysis
 */
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

  // Get target hotel's historical rates
  const history = await prisma.rateHistory.findMany({
    where: {
      hotelId: targetHotel.id,
      date: { gte: thirtyDaysAgo, lte: today },
    },
    orderBy: { date: 'asc' },
  });

  const avgRate = history.length > 0
    ? history.reduce((sum, h) => sum + (h.mapRate || 0), 0) / history.length
    : null;

  // Determine trend
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

  // Get all hotels' trends
  const allHotels = await prisma.hotel.findMany();
  const trends = [];

  for (const hotel of allHotels) {
    const hotelHistory = await prisma.rateHistory.findMany({
      where: {
        hotelId: hotel.id,
        date: { gte: thirtyDaysAgo, lte: today },
        mapRate: { not: null },
      },
      orderBy: { date: 'asc' },
    });

    if (hotelHistory.length < 2) {
      trends.push({ hotel: hotel.name, delta7d: 0, delta30d: 0 });
      continue;
    }

    const latest = hotelHistory[hotelHistory.length - 1].mapRate!;
    const weekAgo = hotelHistory.find(h => {
      const diff = today.getTime() - new Date(h.date).getTime();
      return diff >= 6 * 86400000 && diff <= 8 * 86400000;
    });
    const monthAgo = hotelHistory[0];

    trends.push({
      hotel: hotel.name,
      delta7d: weekAgo?.mapRate ? calcDeltaPercent(latest, weekAgo.mapRate) : 0,
      delta30d: monthAgo?.mapRate ? calcDeltaPercent(latest, monthAgo.mapRate) : 0,
    });
  }

  return { avgRate, trend, trends };
}

/**
 * Algorithmic rate calculation based on competitor positioning
 */
function calculateAlgorithmicRate(
  competitors: CompetitorRateSummary[],
  seasonType: string,
  weekend: boolean
): number {
  const weights = POSITIONING_WEIGHTS;
  let weightedSum = 0;
  let totalWeight = 0;

  // Find competitor rates by name
  const findRate = (partialName: string) => 
    competitors.find(c => c.hotelName.toLowerCase().includes(partialName))?.bestMapRate;

  const carltonRate = findRate('carlton');
  const tamaraRate = findRate('tamara');
  const sterlingRate = findRate('sterling');
  const lePosheRate = findRate('poshe');

  // Apply positioning rules
  if (sterlingRate) {
    // Target: 5-15% below Sterling
    const target = sterlingRate * 0.90;
    weightedSum += target * weights['sterling-kodai-lake'].weight;
    totalWeight += weights['sterling-kodai-lake'].weight;
  }

  if (lePosheRate) {
    // Target: competitive with Le Poshe (±5%)
    const target = lePosheRate * 1.02; // Slightly above Le Poshe
    weightedSum += target * weights['le-poshe-by-sparsa'].weight;
    totalWeight += weights['le-poshe-by-sparsa'].weight;
  }

  if (carltonRate) {
    // Target: 40-60% below Carlton
    const target = carltonRate * 0.48;
    weightedSum += target * weights['the-carlton'].weight;
    totalWeight += weights['the-carlton'].weight;
  }

  if (tamaraRate) {
    // Target: 50-70% below Tamara
    const target = tamaraRate * 0.38;
    weightedSum += target * weights['the-tamara-kodai'].weight;
    totalWeight += weights['the-tamara-kodai'].weight;
  }

  let baseRate = totalWeight > 0 ? weightedSum / totalWeight : 8000;

  // Season adjustments
  const seasonMultipliers: Record<string, number> = {
    peak: 1.18,
    festival: 1.22,
    shoulder: 1.05,
    'off-peak': 0.88,
  };
  baseRate *= seasonMultipliers[seasonType] ?? 1.0;

  // Weekend premium
  if (weekend) baseRate *= 1.12;

  // Ensure bounds
  baseRate = Math.max(5000, Math.min(12000, Math.round(baseRate / 100) * 100));

  return baseRate;
}

/**
 * Blend algorithmic and AI recommendations
 */
function blendRecommendations(algorithmic: number, ai: number): number {
  // 60% AI weight, 40% algorithmic weight
  const blended = (ai * 0.6) + (algorithmic * 0.4);
  return Math.round(blended / 100) * 100; // Round to nearest 100
}

/**
 * Determine market position relative to competitors
 */
function determineMarketPosition(
  rate: number,
  competitors: CompetitorRateSummary[]
): 'below-market' | 'at-market' | 'above-market' {
  const validRates = competitors
    .filter(c => c.bestMapRate != null && c.position !== 'ultra-premium-anchor' && c.position !== 'premium-anchor')
    .map(c => c.bestMapRate!);

  if (validRates.length === 0) return 'at-market';

  const avgDirectCompetitor = validRates.reduce((a, b) => a + b, 0) / validRates.length;

  if (rate < avgDirectCompetitor * 0.95) return 'below-market';
  if (rate > avgDirectCompetitor * 1.05) return 'above-market';
  return 'at-market';
}

/**
 * Get the latest stored recommendation
 */
export async function getLatestRecommendation(): Promise<PricingRecommendation | null> {
  const targetHotel = await prisma.hotel.findFirst({ where: { isTarget: true } });
  if (!targetHotel) return null;

  const rec = await prisma.recommendation.findFirst({
    where: { hotelId: targetHotel.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!rec) return null;

  // Fetch competitor rates for context
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
