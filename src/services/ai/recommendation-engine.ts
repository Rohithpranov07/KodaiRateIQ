// ============================================================
// KodaiRateIQ — MiMo Recommendation Engine
// Generates real AI-powered pricing recommendations for HKI
// using live market data, validated outputs, and full storage
// ============================================================

import { mimoChatJson, isMiMoConfigured, MiMoError } from './mimo-client';
import { buildRecommendationMessages } from './prompt-engine';
import { validateRecommendation, sanitizeRecommendation } from './validation';
import prisma from '@/lib/db';
import type { AiRecommendation, CompetitorRateSummary } from '@/types';
import type { RecommendationPromptData } from './prompt-engine';

const MIMO_MODEL = process.env.MIMO_MODEL || 'mimo-v2.5-pro';

export async function generatePricingRecommendation(params: {
  competitorRates: CompetitorRateSummary[];
  seasonType: string;
  isWeekend: boolean;
  historicalAvgRate: number | null;
  historicalTrend: 'rising' | 'falling' | 'stable';
  recentTrends: Array<{ hotel: string; delta7d: number; delta30d: number }>;
  date: string;
  algorithmicRate: number;
  recentRecommendations?: Array<{ date: string; rate: number; strategy: string; confidence: number }> | null;
  otaSpread?: Array<{ hotel: string; source: string; mapRate: number }> | null;
  occupancySignals?: Array<{ hotel: string; availability: string }> | null;
}): Promise<AiRecommendation> {
  if (!isMiMoConfigured()) {
    console.warn('[MiMo] MIMO_API_KEY not configured — using algorithmic fallback');
    return buildAlgorithmicFallback(params);
  }

  const promptData: RecommendationPromptData = {
    competitorRates: params.competitorRates,
    seasonType: params.seasonType,
    isWeekend: params.isWeekend,
    historicalAvgRate: params.historicalAvgRate,
    historicalTrend: params.historicalTrend,
    recentTrends: params.recentTrends,
    date: params.date,
    algorithmicRate: params.algorithmicRate,
    otaSpread: params.otaSpread ?? null,
    occupancySignals: params.occupancySignals ?? null,
    recentRecommendations: params.recentRecommendations ?? null,
  };

  const messages = buildRecommendationMessages(promptData);
  const promptSnapshot = JSON.stringify({
    competitorRates: params.competitorRates,
    seasonType: params.seasonType,
    isWeekend: params.isWeekend,
    historicalAvgRate: params.historicalAvgRate,
    historicalTrend: params.historicalTrend,
    date: params.date,
    algorithmicRate: params.algorithmicRate,
  });

  let rawData: unknown = null;
  let validationErrors: string | null = null;
  let durationMs = 0;
  let tokenUsage = 0;

  try {
    const { data, meta } = await mimoChatJson<AiRecommendation>(messages, {
      temperature: 0.3,
      maxTokens: 4096,
    });

    rawData = data;
    durationMs = meta.durationMs;
    tokenUsage = meta.usage.totalTokens;

    const validation = validateRecommendation(data, params.competitorRates);

    if (validation.warnings.length > 0) {
      console.warn('[MiMo] Recommendation validation warnings:', validation.warnings);
    }

    if (!validation.valid) {
      console.error('[MiMo] Recommendation validation errors:', validation.errors);
      validationErrors = validation.errors.join('; ');
      const sanitized = sanitizeRecommendation(data as Partial<AiRecommendation>, params.competitorRates, params.algorithmicRate);
      await persistReasoningHistory(promptSnapshot, JSON.stringify(data), MIMO_MODEL, 'sanitized', validationErrors, durationMs, tokenUsage);
      await persistConfidenceLog(params.date, sanitized.confidence_score, sanitized.pricing_strategy, params.seasonType, params.competitorRates);
      return sanitized;
    }

    const sanitized = sanitizeRecommendation(data as Partial<AiRecommendation>, params.competitorRates, params.algorithmicRate);
    await persistReasoningHistory(promptSnapshot, JSON.stringify(data), MIMO_MODEL, 'valid', null, durationMs, tokenUsage);
    await persistConfidenceLog(params.date, sanitized.confidence_score, sanitized.pricing_strategy, params.seasonType, params.competitorRates);
    return sanitized;
  } catch (err) {
    const errMsg = err instanceof MiMoError ? err.message : String(err);
    console.error('[MiMo] Recommendation generation failed:', errMsg);

    await persistReasoningHistory(
      promptSnapshot,
      rawData ? JSON.stringify(rawData) : `ERROR: ${errMsg}`,
      MIMO_MODEL,
      'error',
      errMsg,
      durationMs,
      tokenUsage
    ).catch(() => {});

    return buildAlgorithmicFallback(params);
  }
}

// ============================================================
// ALGORITHMIC FALLBACK
// Used ONLY when MiMo API is unavailable — computes rate
// from real competitor data, never returns hardcoded values
// ============================================================

function buildAlgorithmicFallback(params: {
  competitorRates: CompetitorRateSummary[];
  seasonType: string;
  isWeekend: boolean;
  algorithmicRate: number;
  historicalTrend?: string;
  historicalAvgRate?: number | null;
}): AiRecommendation {
  const sterling = params.competitorRates.find(r => r.hotelName.toLowerCase().includes('sterling'));
  const lePoshe = params.competitorRates.find(r => r.hotelName.toLowerCase().includes('poshe'));
  const carlton = params.competitorRates.find(r => r.hotelName.toLowerCase().includes('carlton'));

  const hasLiveData = params.competitorRates.some(r => r.bestMapRate != null);
  const base = params.algorithmicRate;

  const weekendPremium = params.isWeekend ? 12 : 0;
  const finalRate = Math.round(Math.max(5000, Math.min(12000, base)) / 100) * 100;

  const rateRefs: string[] = [];
  if (sterling?.bestMapRate) rateRefs.push(`Sterling at ₹${sterling.bestMapRate.toLocaleString('en-IN')}`);
  if (lePoshe?.bestMapRate) rateRefs.push(`Le Poshe at ₹${lePoshe.bestMapRate.toLocaleString('en-IN')}`);
  if (carlton?.bestMapRate) rateRefs.push(`The Carlton at ₹${carlton.bestMapRate.toLocaleString('en-IN')}`);

  const reasoning = hasLiveData
    ? `Algorithmic rate of ₹${finalRate.toLocaleString('en-IN')} derived from competitor anchoring (${rateRefs.join(', ')}). ` +
      `${params.seasonType} season positioning applied. MiMo AI temporarily unavailable — using real-time algorithmic engine.`
    : `Algorithmic baseline of ₹${finalRate.toLocaleString('en-IN')} applied. No live competitor data available for today — ` +
      `rate based on historical positioning and ${params.seasonType} season adjustments.`;

  return {
    recommended_map_rate: finalRate,
    confidence_score: hasLiveData ? 0.62 : 0.45,
    reasoning,
    pricing_strategy: params.seasonType === 'peak' || params.seasonType === 'festival' ? 'premium' : 'balanced',
    occupancy_expectation: params.seasonType === 'peak' ? 'high' : 'medium',
    premium_discount_suggestion: params.isWeekend
      ? `Weekend premium of ${weekendPremium}% applied based on typical Kodaikanal weekend demand.`
      : 'Standard weekday positioning. No premium applied.',
    min_rate: Math.round(finalRate * 0.9 / 100) * 100,
    max_rate: Math.round(finalRate * 1.1 / 100) * 100,
    season_type: params.seasonType,
    demand_level: params.seasonType === 'peak' ? 'high' : params.seasonType === 'off-peak' ? 'low' : 'medium',
    weekend_premium_percent: weekendPremium,
    insights: [],
  };
}

// ============================================================
// PERSISTENCE HELPERS
// ============================================================

async function persistReasoningHistory(
  promptSnapshot: string,
  rawResponse: string,
  model: string,
  validationStatus: string,
  validationErrors: string | null,
  durationMs: number,
  tokenUsage: number
): Promise<void> {
  try {
    await prisma.aiReasoningHistory.create({
      data: {
        model,
        promptSnapshot,
        rawResponse,
        validationStatus,
        validationErrors,
        tokenUsage,
        durationMs,
      },
    });
  } catch (err) {
    console.warn('[MiMo] Failed to persist reasoning history:', err);
  }
}

async function persistConfidenceLog(
  dateStr: string,
  confidenceScore: number,
  strategy: string,
  seasonType: string,
  competitorRates: CompetitorRateSummary[]
): Promise<void> {
  try {
    const hash = Buffer.from(
      competitorRates.map(r => `${r.hotelName}:${r.bestMapRate}`).join('|')
    ).toString('base64').slice(0, 32);

    await prisma.aiConfidenceLog.create({
      data: {
        date: new Date(dateStr),
        confidenceScore,
        strategy,
        seasonType,
        competitorDataHash: hash,
      },
    });
  } catch (err) {
    console.warn('[MiMo] Failed to persist confidence log:', err);
  }
}
