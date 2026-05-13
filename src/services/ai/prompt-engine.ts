// ============================================================
// KodaiRateIQ — AI Prompt Engine
// All prompts are 100% dynamically constructed from live data.
// NO static values. NO hardcoded rates. NO fake context.
// ============================================================

import type { CompetitorRateSummary } from '@/types';
import type { MiMoMessage } from './mimo-client';

// ============================================================
// RECOMMENDATION PROMPT
// ============================================================

export interface RecommendationPromptData {
  competitorRates: CompetitorRateSummary[];
  seasonType: string;
  isWeekend: boolean;
  historicalAvgRate: number | null;
  historicalTrend: 'rising' | 'falling' | 'stable';
  recentTrends: Array<{ hotel: string; delta7d: number; delta30d: number }>;
  otaSpread: Array<{ hotel: string; source: string; mapRate: number }> | null;
  occupancySignals: Array<{ hotel: string; availability: string }> | null;
  date: string;
  algorithmicRate: number;
  recentRecommendations: Array<{ date: string; rate: number; strategy: string; confidence: number }> | null;
}

export function buildRecommendationMessages(data: RecommendationPromptData): MiMoMessage[] {
  const systemPrompt = buildRecommendationSystemPrompt();
  const userPrompt = buildRecommendationUserPrompt(data);

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

function buildRecommendationSystemPrompt(): string {
  return `You are a principal hotel revenue management AI specializing in Indian hill station properties. You generate precise, grounded pricing recommendations for Hotel Kodai International (HKI), a 3-star property in Kodaikanal, Tamil Nadu.

CORE MANDATE:
- All pricing recommendations must be grounded EXCLUSIVELY in the data provided in the user prompt
- Never invent rates, occupancy figures, or competitive intelligence not present in the data
- Apply rigorous revenue management principles: competitor anchoring, demand sensing, yield optimization
- Every insight must reference specific numbers from the provided data

POSITIONING HIERARCHY (MUST BE RESPECTED):
1. The Carlton (5★ ultra-premium) — HKI must price 40–60% BELOW Carlton's MAP
2. The Tamara Kodai (5★ ultra-luxury) — HKI must price 50–70% BELOW Tamara's MAP
3. Sterling Kodai Lake (4★ mid-premium) — HKI must price 5–15% BELOW Sterling
4. Le Poshe by Sparsa (3★ direct comp) — HKI must price within ±5% of Le Poshe

HARD PRICING BOUNDARIES FOR HKI:
- Minimum MAP: ₹5,000 (floor — never go below regardless of conditions)
- Maximum MAP: ₹12,000 (ceiling — ultra-peak festival maximum)
- Typical operative range: ₹6,500–₹9,500
- MAP plan definition: Room + Breakfast + Dinner (GST extra: 12% for ₹1,000–₹7,500, 18% above)

OUTPUT: Respond ONLY with a single valid JSON object matching this exact structure — no markdown, no prose, no explanation outside the JSON:
{
  "recommended_map_rate": <integer, rounded to nearest 100>,
  "confidence_score": <float 0.0–1.0, use 2 decimal places>,
  "reasoning": "<3–5 sentences explaining the specific rate chosen, citing actual competitor rates from the data>",
  "pricing_strategy": "<exactly one of: aggressive | conservative | balanced | premium>",
  "occupancy_expectation": "<exactly one of: high | medium | low>",
  "premium_discount_suggestion": "<1–2 sentences on any premium or discount applied and why>",
  "min_rate": <integer — lower bound of defensible range, must be >= 5000>,
  "max_rate": <integer — upper bound of defensible range, must be <= 12000>,
  "season_type": "<from input data>",
  "demand_level": "<exactly one of: high | medium | low>",
  "weekend_premium_percent": <integer 0–25>,
  "insights": [
    {
      "type": "<one of: pricing-pressure | demand-surge | premium-opportunity | competitor-undercut | weekend-uplift>",
      "title": "<5–8 word title citing a specific hotel or data point>",
      "summary": "<2–3 sentences grounded in the provided data, citing specific rates or percentages>",
      "severity": "<one of: info | warning | critical | opportunity>",
      "actionable": <boolean>
    }
  ]
}`;
}

function buildRecommendationUserPrompt(data: RecommendationPromptData): string {
  const lines: string[] = [];

  lines.push('=== LIVE MARKET DATA FOR HKI PRICING ANALYSIS ===');
  lines.push('');
  lines.push(`DATE: ${data.date}`);
  lines.push(`SEASON TYPE: ${data.seasonType.toUpperCase()}`);
  lines.push(`DAY TYPE: ${data.isWeekend ? 'WEEKEND / HOLIDAY (apply 10–20% premium if demand supports)' : 'WEEKDAY (standard positioning)'}`);
  lines.push('');

  lines.push('--- COMPETITOR MAP RATES (LIVE) ---');
  if (data.competitorRates.length === 0) {
    lines.push('No competitor rate data available for today. Use historical averages if available.');
  } else {
    data.competitorRates.forEach(r => {
      const rate = r.bestMapRate != null ? `₹${r.bestMapRate.toLocaleString('en-IN')}` : 'NOT AVAILABLE';
      const source = r.bestSource ? ` (cheapest via ${r.bestSource})` : '';
      const role = formatRole(r.position);
      lines.push(`  ${r.hotelName} [${role}]: MAP ${rate}${source}`);
    });
  }
  lines.push('');

  lines.push('--- ALGORITHMIC BASELINE ---');
  lines.push(`  Internal pricing engine rate: ₹${data.algorithmicRate.toLocaleString('en-IN')}`);
  lines.push('  (Weighted by competitor anchoring — use as reference point, not a constraint)');
  lines.push('');

  lines.push('--- HISTORICAL RATE DATA ---');
  if (data.historicalAvgRate) {
    lines.push(`  HKI 30-day average MAP: ₹${Math.round(data.historicalAvgRate).toLocaleString('en-IN')}`);
    lines.push(`  HKI rate trend (last 30 days): ${data.historicalTrend.toUpperCase()}`);
  } else {
    lines.push('  HKI historical data: NOT AVAILABLE (first run or insufficient history)');
  }
  lines.push('');

  lines.push('--- PRICE MOVEMENT TRENDS ---');
  if (data.recentTrends.length === 0) {
    lines.push('  No trend data available.');
  } else {
    data.recentTrends.forEach(t => {
      const d7 = formatDelta(t.delta7d);
      const d30 = formatDelta(t.delta30d);
      lines.push(`  ${t.hotel}: 7-day change ${d7}, 30-day change ${d30}`);
    });
  }
  lines.push('');

  if (data.otaSpread && data.otaSpread.length > 0) {
    lines.push('--- OTA PRICING SPREAD ---');
    data.otaSpread.forEach(o => {
      lines.push(`  ${o.hotel} on ${o.source}: ₹${o.mapRate.toLocaleString('en-IN')} MAP`);
    });
    lines.push('');
  }

  if (data.occupancySignals && data.occupancySignals.length > 0) {
    lines.push('--- OCCUPANCY / AVAILABILITY SIGNALS ---');
    data.occupancySignals.forEach(s => {
      lines.push(`  ${s.hotel}: availability status = ${s.availability}`);
    });
    lines.push('');
  }

  if (data.recentRecommendations && data.recentRecommendations.length > 0) {
    lines.push('--- RECENT HKI RECOMMENDATION HISTORY (last 7 days) ---');
    data.recentRecommendations.forEach(r => {
      lines.push(`  ${r.date}: ₹${r.rate.toLocaleString('en-IN')} MAP | strategy=${r.strategy} | confidence=${(r.confidence * 100).toFixed(0)}%`);
    });
    lines.push('');
  }

  lines.push('=== TASK ===');
  lines.push('Based on ALL the above live market data, generate the optimal MAP pricing recommendation for Hotel Kodai International today.');
  lines.push('Your reasoning MUST cite specific competitor rates and percentage relationships from the data above.');
  lines.push('DO NOT invent any rates, occupancy figures, or market conditions not present in the data above.');

  return lines.join('\n');
}

// ============================================================
// INSIGHTS PROMPT
// ============================================================

export interface InsightsPromptData {
  competitorRates: CompetitorRateSummary[];
  recentTrends: Array<{ hotel: string; delta7d: number; delta30d: number }>;
  seasonType: string;
  isWeekend: boolean;
  occupancySignals: Array<{ hotel: string; availability: string }> | null;
  otaSpread: Array<{ hotel: string; source: string; mapRate: number }> | null;
  currentHkiRate: number | null;
  recommendedHkiRate: number;
  date: string;
}

export function buildInsightsMessages(data: InsightsPromptData): MiMoMessage[] {
  return [
    { role: 'system', content: buildInsightsSystemPrompt() },
    { role: 'user', content: buildInsightsUserPrompt(data) },
  ];
}

function buildInsightsSystemPrompt(): string {
  return `You are a hotel market intelligence analyst specializing in Kodaikanal, India hospitality market. You generate specific, data-grounded insights for the revenue manager of Hotel Kodai International (HKI).

MANDATE:
- Every insight MUST be grounded in the specific data provided
- Cite actual numbers: rates, percentages, hotel names from the input data
- Do NOT generate generic hospitality insights (e.g., "consider adjusting rates for the season")
- Each insight must be specific enough that the revenue manager can act on it today
- Reference the exact hotels tracked: The Carlton, The Tamara Kodai, Hotel Kodai International, Sterling Kodai Lake, Le Poshe by Sparsa

INSIGHT TYPES TO DETECT:
- pricing-pressure: Competitor pricing is squeezing HKI's positioning (cite specific rates)
- demand-surge: Strong demand signals suggest premium pricing is achievable (cite availability data)
- premium-opportunity: Market conditions allow HKI to price higher than current (cite gap)
- competitor-undercut: A competitor is pricing aggressively below HKI (cite their rate vs HKI)
- weekend-uplift: Weekend demand justifies rate premium (only when isWeekend=true or upcoming)

OUTPUT: Respond ONLY with valid JSON, no prose outside it:
{
  "insights": [
    {
      "type": "<pricing-pressure | demand-surge | premium-opportunity | competitor-undercut | weekend-uplift>",
      "title": "<concise 5–10 word title that names a specific hotel or data point>",
      "summary": "<2–3 sentences of specific, actionable intelligence citing real numbers from the data. Must name specific hotels and rates.>",
      "severity": "<info | warning | critical | opportunity>",
      "actionable": <true | false>
    }
  ]
}

Generate 3–5 insights. All insights must be grounded in the data below.`;
}

function buildInsightsUserPrompt(data: InsightsPromptData): string {
  const lines: string[] = [];

  lines.push('=== LIVE KODAIKANAL MARKET INTELLIGENCE ===');
  lines.push('');
  lines.push(`DATE: ${data.date}`);
  lines.push(`SEASON: ${data.seasonType.toUpperCase()} | DAY: ${data.isWeekend ? 'WEEKEND' : 'WEEKDAY'}`);
  lines.push('');

  lines.push('--- CURRENT COMPETITOR MAP RATES ---');
  if (data.competitorRates.length === 0) {
    lines.push('  No live competitor rate data available.');
  } else {
    data.competitorRates.forEach(r => {
      const rate = r.bestMapRate != null ? `₹${r.bestMapRate.toLocaleString('en-IN')}` : 'N/A';
      lines.push(`  ${r.hotelName}: ${rate} MAP`);
    });
  }
  lines.push('');

  lines.push('--- HKI RATE STATUS ---');
  lines.push(`  Current HKI live MAP rate: ${data.currentHkiRate ? `₹${data.currentHkiRate.toLocaleString('en-IN')}` : 'No live rate stored'}`);
  lines.push(`  AI-recommended HKI rate: ₹${data.recommendedHkiRate.toLocaleString('en-IN')}`);
  if (data.currentHkiRate && data.recommendedHkiRate) {
    const gap = data.recommendedHkiRate - data.currentHkiRate;
    const gapPct = ((gap / data.currentHkiRate) * 100).toFixed(1);
    lines.push(`  Gap: ${gap > 0 ? '+' : ''}₹${gap.toLocaleString('en-IN')} (${gap > 0 ? '+' : ''}${gapPct}%)`);
  }
  lines.push('');

  lines.push('--- RATE MOVEMENT TRENDS ---');
  if (data.recentTrends.length === 0) {
    lines.push('  No trend data available.');
  } else {
    data.recentTrends.forEach(t => {
      lines.push(`  ${t.hotel}: 7d ${formatDelta(t.delta7d)}, 30d ${formatDelta(t.delta30d)}`);
    });
  }
  lines.push('');

  if (data.occupancySignals && data.occupancySignals.length > 0) {
    lines.push('--- OCCUPANCY & AVAILABILITY SIGNALS ---');
    data.occupancySignals.forEach(s => {
      lines.push(`  ${s.hotel}: ${s.availability}`);
    });
    lines.push('');
  }

  if (data.otaSpread && data.otaSpread.length > 0) {
    lines.push('--- OTA PLATFORM RATES ---');
    data.otaSpread.forEach(o => {
      lines.push(`  ${o.hotel} on ${o.source}: ₹${o.mapRate.toLocaleString('en-IN')}`);
    });
    lines.push('');
  }

  lines.push('=== TASK ===');
  lines.push('Generate 3–5 specific, actionable market insights for the HKI revenue manager based on the data above.');
  lines.push('Every insight must cite specific hotel names and rates from the data. No generic insights.');

  return lines.join('\n');
}

// ============================================================
// HELPERS
// ============================================================

function formatRole(role: string): string {
  const map: Record<string, string> = {
    'ultra-premium-anchor': '5★ ultra-luxury anchor',
    'premium-anchor': '5★ premium anchor',
    'direct-competitor': '3–4★ direct competitor',
    'target': 'HKI target',
    'competitor': 'competitor',
  };
  return map[role] || role;
}

function formatDelta(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}
