// ============================================================
// KodaiRateIQ — MiMo Insight Engine
// Generates real AI-powered market insights from live data
// All insights are grounded in actual competitor rates and trends
// ============================================================

import { mimoChatJson, isMiMoConfigured, MiMoError } from './mimo-client';
import { buildInsightsMessages } from './prompt-engine';
import { validateInsights } from './validation';
import type { AiInsight, CompetitorRateSummary } from '@/types';
import type { InsightsPromptData } from './prompt-engine';

export async function generateMarketInsights(params: {
  competitorRates: CompetitorRateSummary[];
  recentTrends: Array<{ hotel: string; delta7d: number; delta30d: number }>;
  seasonType: string;
  isWeekend?: boolean;
  date: string;
  currentHkiRate?: number | null;
  recommendedHkiRate: number;
  occupancySignals?: Array<{ hotel: string; availability: string }> | null;
  otaSpread?: Array<{ hotel: string; source: string; mapRate: number }> | null;
}): Promise<AiInsight[]> {
  if (!isMiMoConfigured()) {
    console.warn('[MiMo] MIMO_API_KEY not configured — using data-driven fallback insights');
    return buildDataDrivenFallbackInsights(params);
  }

  const promptData: InsightsPromptData = {
    competitorRates: params.competitorRates,
    recentTrends: params.recentTrends,
    seasonType: params.seasonType,
    isWeekend: params.isWeekend ?? false,
    date: params.date,
    currentHkiRate: params.currentHkiRate ?? null,
    recommendedHkiRate: params.recommendedHkiRate,
    occupancySignals: params.occupancySignals ?? null,
    otaSpread: params.otaSpread ?? null,
  };

  const messages = buildInsightsMessages(promptData);

  try {
    const { data } = await mimoChatJson<{ insights: AiInsight[] }>(messages, {
      temperature: 0.4,
      maxTokens: 2048,
    });

    const validation = validateInsights(data);

    if (validation.warnings.length > 0) {
      console.warn('[MiMo] Insight validation warnings:', validation.warnings);
    }

    if (!validation.valid) {
      console.error('[MiMo] Insight validation failed:', validation.errors);
      // Filter to only valid insights rather than discarding all
      const filtered = filterValidInsights(data?.insights ?? []);
      if (filtered.length > 0) return filtered;
      return buildDataDrivenFallbackInsights(params);
    }

    return filterValidInsights(data.insights);
  } catch (err) {
    const errMsg = err instanceof MiMoError ? err.message : String(err);
    console.error('[MiMo] Insights generation failed:', errMsg);
    return buildDataDrivenFallbackInsights(params);
  }
}

const VALID_TYPES = ['pricing-pressure', 'demand-surge', 'premium-opportunity', 'competitor-undercut', 'weekend-uplift'];
const VALID_SEVERITIES = ['info', 'warning', 'critical', 'opportunity'];

function filterValidInsights(raw: unknown[]): AiInsight[] {
  return (raw ?? []).filter((i): i is AiInsight => {
    if (!i || typeof i !== 'object') return false;
    const insight = i as Record<string, unknown>;
    return (
      VALID_TYPES.includes(insight.type as string) &&
      VALID_SEVERITIES.includes(insight.severity as string) &&
      typeof insight.title === 'string' && insight.title.trim().length > 0 &&
      typeof insight.summary === 'string' && insight.summary.trim().length >= 10
    );
  });
}

// ============================================================
// DATA-DRIVEN FALLBACK INSIGHTS
// Used ONLY when MiMo API is unavailable.
// Computed from real live data — never hardcoded.
// ============================================================

function buildDataDrivenFallbackInsights(params: {
  competitorRates: CompetitorRateSummary[];
  recentTrends: Array<{ hotel: string; delta7d: number; delta30d: number }>;
  seasonType: string;
  isWeekend?: boolean;
  currentHkiRate?: number | null;
  recommendedHkiRate: number;
}): AiInsight[] {
  const insights: AiInsight[] = [];
  const sterling = params.competitorRates.find(r => r.hotelName.toLowerCase().includes('sterling'));
  const lePoshe = params.competitorRates.find(r => r.hotelName.toLowerCase().includes('poshe'));
  const carlton = params.competitorRates.find(r => r.hotelName.toLowerCase().includes('carlton'));
  const tamara = params.competitorRates.find(r => r.hotelName.toLowerCase().includes('tamara'));

  // Underpricing detection
  if (params.currentHkiRate && params.recommendedHkiRate) {
    const gap = params.recommendedHkiRate - params.currentHkiRate;
    if (gap > 200) {
      insights.push({
        type: 'premium-opportunity',
        title: `HKI Underpriced by ₹${gap.toLocaleString('en-IN')} vs Optimal`,
        summary: `Hotel Kodai International's current rate of ₹${params.currentHkiRate.toLocaleString('en-IN')} is ₹${gap.toLocaleString('en-IN')} below the AI-recommended rate of ₹${params.recommendedHkiRate.toLocaleString('en-IN')}. Increasing to the recommended rate would improve revenue without compromising competitive positioning.`,
        severity: gap > 500 ? 'critical' : 'warning',
        actionable: true,
      });
    }
  }

  // Sterling pricing pressure check
  if (sterling?.bestMapRate) {
    const sterlingTrend = params.recentTrends.find(t => t.hotel.toLowerCase().includes('sterling'));
    if (sterlingTrend && Math.abs(sterlingTrend.delta7d) > 3) {
      const direction = sterlingTrend.delta7d > 0 ? 'increased' : 'decreased';
      insights.push({
        type: sterlingTrend.delta7d > 0 ? 'pricing-pressure' : 'competitor-undercut',
        title: `Sterling Rates ${sterlingTrend.delta7d > 0 ? 'Up' : 'Down'} ${Math.abs(sterlingTrend.delta7d).toFixed(1)}% in 7 Days`,
        summary: `Sterling Kodai Lake has ${direction} its MAP rate by ${Math.abs(sterlingTrend.delta7d).toFixed(1)}% over the past 7 days, currently at ₹${sterling.bestMapRate.toLocaleString('en-IN')}. ${sterlingTrend.delta7d > 0 ? 'This creates room for HKI to increase rates while maintaining competitive positioning.' : 'HKI should review its rate to avoid being overpriced relative to this key competitor.'}`,
        severity: sterlingTrend.delta7d > 5 ? 'opportunity' : 'warning',
        actionable: true,
      });
    }
  }

  // Weekend uplift signal
  if (params.isWeekend) {
    insights.push({
      type: 'weekend-uplift',
      title: 'Weekend Demand Window Active — Premium Viable',
      summary: `Current ${params.seasonType} season weekend conditions support a 10–15% rate premium over weekday rates. ${sterling?.bestMapRate ? `Sterling is at ₹${sterling.bestMapRate.toLocaleString('en-IN')} MAP` : 'Competitor weekend rates should be reviewed'} — HKI has room to capture weekend RevPAR uplift.`,
      severity: 'opportunity',
      actionable: true,
    });
  }

  // Peak/festival season demand surge
  if (params.seasonType === 'peak' || params.seasonType === 'festival') {
    const relevantCompRate = sterling?.bestMapRate || lePoshe?.bestMapRate;
    insights.push({
      type: 'demand-surge',
      title: `${params.seasonType === 'festival' ? 'Festival' : 'Peak'} Season Demand Surge Detected`,
      summary: `${params.seasonType === 'festival' ? 'Festival' : 'Peak'} season demand in Kodaikanal justifies premium pricing. ${relevantCompRate ? `Direct competitors are averaging ₹${relevantCompRate.toLocaleString('en-IN')} MAP` : 'Competitor data unavailable'}. HKI should maintain aggressive yield strategy to maximise RevPAR during this high-demand window.`,
      severity: 'opportunity',
      actionable: true,
    });
  }

  // Carlton anchor positioning
  if (carlton?.bestMapRate && params.recommendedHkiRate) {
    const hkiVsCarlton = ((carlton.bestMapRate - params.recommendedHkiRate) / carlton.bestMapRate) * 100;
    if (hkiVsCarlton < 40) {
      insights.push({
        type: 'pricing-pressure',
        title: `HKI Nearing Carlton Rate Threshold (${hkiVsCarlton.toFixed(0)}% Gap)`,
        summary: `The Carlton is at ₹${carlton.bestMapRate.toLocaleString('en-IN')} MAP while HKI is recommended at ₹${params.recommendedHkiRate.toLocaleString('en-IN')} — only ${hkiVsCarlton.toFixed(0)}% below Carlton. Positioning rules require HKI to remain 40–60% below the Carlton anchor. Consider reducing to maintain clear value-tier differentiation.`,
        severity: 'warning',
        actionable: true,
      });
    }
  }

  return insights.slice(0, 5);
}
