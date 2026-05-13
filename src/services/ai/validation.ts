// ============================================================
// KodaiRateIQ — AI Output Validation Engine
// Ensures all MiMo AI outputs are grounded in real data
// and contain no hallucinations or impossible values
// ============================================================

import type { AiRecommendation, AiInsight, CompetitorRateSummary } from '@/types';

const VALID_STRATEGIES = ['aggressive', 'conservative', 'balanced', 'premium'] as const;
const VALID_DEMAND_LEVELS = ['high', 'medium', 'low'] as const;
const VALID_OCCUPANCY_EXPECTATIONS = ['high', 'medium', 'low'] as const;
const VALID_INSIGHT_TYPES = [
  'pricing-pressure',
  'demand-surge',
  'premium-opportunity',
  'competitor-undercut',
  'weekend-uplift',
] as const;
const VALID_SEVERITIES = ['info', 'warning', 'critical', 'opportunity'] as const;

const KNOWN_HOTELS = [
  'The Carlton',
  'The Tamara Kodai',
  'Hotel Kodai International',
  'Sterling Kodai Lake',
  'Le Poshe by Sparsa',
];

const MAP_RATE_MIN = 4000;
const MAP_RATE_MAX = 30000;
const HKI_RATE_MIN = 5000;
const HKI_RATE_MAX = 12000;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateRecommendation(
  raw: unknown,
  competitorRates: CompetitorRateSummary[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['AI response is not a JSON object'], warnings };
  }

  const r = raw as Record<string, unknown>;

  // required_map_rate
  if (typeof r.recommended_map_rate !== 'number') {
    errors.push('missing or non-numeric recommended_map_rate');
  } else {
    if (r.recommended_map_rate < HKI_RATE_MIN) {
      errors.push(`recommended_map_rate ${r.recommended_map_rate} is below minimum ${HKI_RATE_MIN}`);
    }
    if (r.recommended_map_rate > HKI_RATE_MAX) {
      errors.push(`recommended_map_rate ${r.recommended_map_rate} exceeds maximum ${HKI_RATE_MAX}`);
    }
  }

  // confidence_score
  if (typeof r.confidence_score !== 'number') {
    errors.push('missing or non-numeric confidence_score');
  } else {
    if (r.confidence_score < 0 || r.confidence_score > 1) {
      errors.push(`confidence_score ${r.confidence_score} is outside [0, 1] range`);
    }
  }

  // pricing_strategy
  if (!VALID_STRATEGIES.includes(r.pricing_strategy as typeof VALID_STRATEGIES[number])) {
    errors.push(`invalid pricing_strategy "${r.pricing_strategy}". Must be one of: ${VALID_STRATEGIES.join(', ')}`);
  }

  // demand_level
  if (!VALID_DEMAND_LEVELS.includes(r.demand_level as typeof VALID_DEMAND_LEVELS[number])) {
    errors.push(`invalid demand_level "${r.demand_level}". Must be one of: ${VALID_DEMAND_LEVELS.join(', ')}`);
  }

  // occupancy_expectation
  if (!VALID_OCCUPANCY_EXPECTATIONS.includes(r.occupancy_expectation as typeof VALID_OCCUPANCY_EXPECTATIONS[number])) {
    warnings.push(`non-standard occupancy_expectation "${r.occupancy_expectation}" — defaulting to "medium"`);
  }

  // reasoning must be non-trivial
  if (typeof r.reasoning !== 'string' || r.reasoning.trim().length < 30) {
    errors.push('reasoning is too short or missing (must be at least 30 characters)');
  }

  // min_rate / max_rate
  if (typeof r.min_rate !== 'number') {
    errors.push('missing or non-numeric min_rate');
  } else if (r.min_rate < MAP_RATE_MIN || r.min_rate > MAP_RATE_MAX) {
    errors.push(`min_rate ${r.min_rate} is outside valid range [${MAP_RATE_MIN}, ${MAP_RATE_MAX}]`);
  }

  if (typeof r.max_rate !== 'number') {
    errors.push('missing or non-numeric max_rate');
  } else if (r.max_rate < MAP_RATE_MIN || r.max_rate > MAP_RATE_MAX) {
    errors.push(`max_rate ${r.max_rate} is outside valid range [${MAP_RATE_MIN}, ${MAP_RATE_MAX}]`);
  }

  if (typeof r.min_rate === 'number' && typeof r.max_rate === 'number' && r.min_rate > r.max_rate) {
    errors.push(`min_rate (${r.min_rate}) must be less than or equal to max_rate (${r.max_rate})`);
  }

  // weekend_premium_percent
  if (typeof r.weekend_premium_percent === 'number') {
    if (r.weekend_premium_percent < 0 || r.weekend_premium_percent > 50) {
      warnings.push(`weekend_premium_percent ${r.weekend_premium_percent} is outside typical range [0, 50]`);
    }
  }

  // Cross-validate against real competitor data
  const validRates = competitorRates.filter(c => c.bestMapRate != null).map(c => c.bestMapRate!);
  if (validRates.length > 0 && typeof r.recommended_map_rate === 'number') {
    const avgCompRate = validRates.reduce((a, b) => a + b, 0) / validRates.length;
    const maxCompRate = Math.max(...validRates);

    if (r.recommended_map_rate > maxCompRate * 1.1) {
      warnings.push(
        `recommended_map_rate (₹${r.recommended_map_rate}) exceeds highest competitor rate ₹${maxCompRate} by >10% — verify positioning logic`
      );
    }
  }

  // Validate insights array if present
  if (r.insights !== undefined) {
    if (!Array.isArray(r.insights)) {
      warnings.push('insights field is not an array — ignoring');
    } else {
      r.insights.forEach((ins: unknown, idx: number) => {
        const insErrors = validateSingleInsight(ins);
        insErrors.forEach(e => warnings.push(`insight[${idx}]: ${e}`));
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateInsights(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['AI insights response is not a JSON object'], warnings };
  }

  const r = raw as Record<string, unknown>;

  if (!Array.isArray(r.insights)) {
    return { valid: false, errors: ['insights field is missing or not an array'], warnings };
  }

  if (r.insights.length === 0) {
    warnings.push('AI returned zero insights — may indicate insufficient market data');
  }

  r.insights.forEach((ins: unknown, idx: number) => {
    const insErrors = validateSingleInsight(ins);
    if (insErrors.length > 0) {
      errors.push(...insErrors.map(e => `insights[${idx}]: ${e}`));
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

function validateSingleInsight(ins: unknown): string[] {
  const errors: string[] = [];
  if (!ins || typeof ins !== 'object') {
    return ['insight is not an object'];
  }
  const i = ins as Record<string, unknown>;

  if (!VALID_INSIGHT_TYPES.includes(i.type as typeof VALID_INSIGHT_TYPES[number])) {
    errors.push(`invalid type "${i.type}". Must be one of: ${VALID_INSIGHT_TYPES.join(', ')}`);
  }
  if (!VALID_SEVERITIES.includes(i.severity as typeof VALID_SEVERITIES[number])) {
    errors.push(`invalid severity "${i.severity}". Must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }
  if (typeof i.title !== 'string' || i.title.trim().length === 0) {
    errors.push('title is missing or empty');
  }
  if (typeof i.summary !== 'string' || i.summary.trim().length < 10) {
    errors.push('summary is too short or missing (must be at least 10 characters)');
  }

  // Hallucination check: ensure no unknown hotel names are referenced in insight text
  const text = `${i.title ?? ''} ${i.summary ?? ''}`;
  const hallucinated = detectHallucinatedHotels(text);
  if (hallucinated.length > 0) {
    errors.push(`possible hallucinated hotel name(s) in insight: ${hallucinated.join(', ')}`);
  }

  return errors;
}

function detectHallucinatedHotels(text: string): string[] {
  // Detect potential hallucinated hotel names by pattern (e.g., "Hotel X" patterns not in our list)
  const hotelPattern = /\b(?:Hotel|The|Resort|Spa|Inn)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  const matches = text.match(hotelPattern) ?? [];
  return matches.filter(match => {
    const lower = match.toLowerCase();
    return !KNOWN_HOTELS.some(known => lower.includes(known.toLowerCase().split(' ')[1] ?? ''));
  });
}

export function sanitizeRecommendation(
  raw: Partial<AiRecommendation>,
  competitorRates: CompetitorRateSummary[],
  algorithmicRate: number
): AiRecommendation {
  const rate = clampRate(raw.recommended_map_rate ?? algorithmicRate, HKI_RATE_MIN, HKI_RATE_MAX);
  const confidence = clamp(raw.confidence_score ?? 0.65, 0, 1);
  const strategy = VALID_STRATEGIES.includes(raw.pricing_strategy as typeof VALID_STRATEGIES[number])
    ? (raw.pricing_strategy as typeof VALID_STRATEGIES[number])
    : 'balanced';
  const demandLevel = VALID_DEMAND_LEVELS.includes(raw.demand_level as typeof VALID_DEMAND_LEVELS[number])
    ? (raw.demand_level as typeof VALID_DEMAND_LEVELS[number])
    : 'medium';
  const occupancyExpectation = VALID_OCCUPANCY_EXPECTATIONS.includes(
    raw.occupancy_expectation as typeof VALID_OCCUPANCY_EXPECTATIONS[number]
  )
    ? (raw.occupancy_expectation as typeof VALID_OCCUPANCY_EXPECTATIONS[number])
    : 'medium';

  const minRate = clampRate(
    raw.min_rate ?? Math.round(rate * 0.9),
    HKI_RATE_MIN,
    rate
  );
  const maxRate = clampRate(
    raw.max_rate ?? Math.round(rate * 1.1),
    rate,
    HKI_RATE_MAX
  );

  const weekendPremium = clamp(raw.weekend_premium_percent ?? 0, 0, 30);
  const reasoning = raw.reasoning?.trim() || `Rate of ₹${rate} based on competitor positioning and ${demandLevel} market demand.`;
  const premiumDiscountSuggestion = raw.premium_discount_suggestion?.trim() || 'Standard competitive positioning applied.';
  const seasonType = raw.season_type || 'shoulder';

  const insights: AiInsight[] = (Array.isArray(raw.insights) ? raw.insights : []).filter(i => {
    return VALID_INSIGHT_TYPES.includes(i.type as typeof VALID_INSIGHT_TYPES[number]) &&
      VALID_SEVERITIES.includes(i.severity as typeof VALID_SEVERITIES[number]);
  });

  return {
    recommended_map_rate: rate,
    confidence_score: confidence,
    reasoning,
    pricing_strategy: strategy,
    occupancy_expectation: occupancyExpectation,
    premium_discount_suggestion: premiumDiscountSuggestion,
    min_rate: minRate,
    max_rate: maxRate,
    season_type: seasonType,
    demand_level: demandLevel,
    weekend_premium_percent: weekendPremium,
    insights,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampRate(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max) / 100) * 100;
}
