// ============================================================
// KodaiRateIQ — Google Gemini AI Client
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GeminiRecommendation, GeminiInsight, CompetitorRateSummary } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: {
    temperature: 0.3, // Lower temperature for more consistent pricing outputs
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 4096,
    responseMimeType: 'application/json',
  },
});

/**
 * Generate pricing recommendation using Gemini AI
 */
export async function generatePricingRecommendation(params: {
  competitorRates: CompetitorRateSummary[];
  seasonType: string;
  isWeekend: boolean;
  historicalAvgRate: number | null;
  historicalTrend: 'rising' | 'falling' | 'stable';
  date: string;
}): Promise<GeminiRecommendation> {
  const prompt = buildPricingPrompt(params);
  
  let lastError: Error | null = null;
  
  // Retry logic for API calls
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      const parsed = JSON.parse(text) as GeminiRecommendation;
      
      // Validate the response
      if (!parsed.recommended_map_rate || parsed.recommended_map_rate < 1000) {
        throw new Error('Invalid recommended rate from AI');
      }
      
      return parsed;
    } catch (error) {
      lastError = error as Error;
      console.error(`Gemini API attempt ${attempt + 1} failed:`, error);
      
      // Wait before retry (exponential backoff)
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000));
      }
    }
  }
  
  // Return a fallback recommendation if AI fails
  return generateFallbackRecommendation(params);
}

/**
 * Generate market insights using Gemini AI
 */
export async function generateMarketInsights(params: {
  competitorRates: CompetitorRateSummary[];
  recentTrends: Array<{ hotel: string; delta7d: number; delta30d: number }>;
  seasonType: string;
  date: string;
}): Promise<GeminiInsight[]> {
  const prompt = buildInsightsPrompt(params);
  
  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const parsed = JSON.parse(text);
    
    return parsed.insights || [];
  } catch (error) {
    console.error('Gemini insights generation failed:', error);
    return getDefaultInsights(params);
  }
}

/**
 * Build the pricing recommendation prompt
 */
function buildPricingPrompt(params: {
  competitorRates: CompetitorRateSummary[];
  seasonType: string;
  isWeekend: boolean;
  historicalAvgRate: number | null;
  historicalTrend: string;
  date: string;
}): string {
  const competitorData = params.competitorRates
    .map(r => `- ${r.hotelName}: ₹${r.bestMapRate ?? 'N/A'} MAP (${r.position})`)
    .join('\n');

  return `You are an expert hotel revenue management consultant specializing in Indian hill station properties.

CONTEXT:
You are generating a pricing recommendation for "Hotel Kodai International", a well-established 3-star hotel in Kodaikanal, Tamil Nadu, India.

DATE: ${params.date}
SEASON: ${params.seasonType}
DAY TYPE: ${params.isWeekend ? 'Weekend/Holiday' : 'Weekday'}
HISTORICAL AVG RATE: ${params.historicalAvgRate ? `₹${params.historicalAvgRate}` : 'N/A'}
HISTORICAL TREND: ${params.historicalTrend}

COMPETITOR RATES (MAP - Modified American Plan):
${competitorData}

POSITIONING STRATEGY (CRITICAL):
1. Hotel Kodai International MUST be priced CHEAPER than The Carlton (5-star premium anchor)
2. Hotel Kodai International MUST be priced CHEAPER than The Tamara Kodai (ultra-premium anchor)
3. Hotel Kodai International should be COMPETITIVE with Sterling Kodai Lake (similar or slightly below)
4. Hotel Kodai International should be COMPETITIVE with Le Poshe by Sparsa (similar pricing band)
5. Maintain 3-star value perception — avoid underpricing below ₹5,000 MAP
6. Maximize occupancy while maintaining rate integrity
7. Weekend/holiday premium of 10-20% is acceptable
8. Festival season premium of 15-30% is acceptable

MAP PLAN DEFINITION:
MAP = Room + Breakfast + Dinner (taxes extra at 12% GST for rooms ₹1,000-₹7,500, 18% above ₹7,500)

PRICING RULES:
- Minimum MAP rate: ₹5,000
- Maximum MAP rate: ₹12,000
- Typical range: ₹7,000-₹9,500
- Must be 5-15% below Sterling Kodai Lake
- Must be within ±5% of Le Poshe
- Must be 40-60% below The Carlton
- Must be 50-70% below The Tamara

OUTPUT FORMAT (respond in valid JSON only):
{
  "recommended_map_rate": <number>,
  "confidence_score": <number between 0 and 1>,
  "reasoning": "<detailed reasoning string>",
  "pricing_strategy": "<one of: aggressive, conservative, balanced, premium>",
  "occupancy_expectation": "<one of: high, medium, low>",
  "premium_discount_suggestion": "<explanation of any premium or discount>",
  "min_rate": <number - lower bound of acceptable range>,
  "max_rate": <number - upper bound of acceptable range>,
  "season_type": "${params.seasonType}",
  "demand_level": "<one of: high, medium, low>",
  "weekend_premium_percent": <number>,
  "insights": [
    {
      "type": "<one of: pricing-pressure, demand-surge, premium-opportunity, competitor-undercut, weekend-uplift>",
      "title": "<short title>",
      "summary": "<1-2 sentence summary>",
      "severity": "<one of: info, warning, critical, opportunity>",
      "actionable": <boolean>
    }
  ]
}`;
}

/**
 * Build the market insights prompt
 */
function buildInsightsPrompt(params: {
  competitorRates: CompetitorRateSummary[];
  recentTrends: Array<{ hotel: string; delta7d: number; delta30d: number }>;
  seasonType: string;
  date: string;
}): string {
  const rateData = params.competitorRates
    .map(r => `${r.hotelName}: ₹${r.bestMapRate ?? 'N/A'}`)
    .join(', ');
    
  const trendData = params.recentTrends
    .map(t => `${t.hotel}: 7d ${t.delta7d > 0 ? '+' : ''}${t.delta7d.toFixed(1)}%, 30d ${t.delta30d > 0 ? '+' : ''}${t.delta30d.toFixed(1)}%`)
    .join('\n');

  return `You are an expert hotel market analyst for Kodaikanal, India.

DATE: ${params.date}
SEASON: ${params.seasonType}

CURRENT RATES: ${rateData}

PRICE TRENDS:
${trendData}

Generate 3-5 market insights for a hotel revenue manager. Focus on:
1. Pricing pressure from competitors
2. Demand surges or drops
3. Premium opportunities
4. Competitor undercutting
5. Weekend/seasonal uplift opportunities

OUTPUT FORMAT (respond in valid JSON only):
{
  "insights": [
    {
      "type": "<pricing-pressure|demand-surge|premium-opportunity|competitor-undercut|weekend-uplift>",
      "title": "<concise title>",
      "summary": "<2-3 sentence actionable insight>",
      "severity": "<info|warning|critical|opportunity>",
      "actionable": true
    }
  ]
}`;
}

/**
 * Fallback recommendation when AI fails
 */
function generateFallbackRecommendation(params: {
  competitorRates: CompetitorRateSummary[];
  seasonType: string;
  isWeekend: boolean;
}): GeminiRecommendation {
  // Find competitor rates
  const sterling = params.competitorRates.find(r => r.hotelName.includes('Sterling'));
  const lePoshe = params.competitorRates.find(r => r.hotelName.includes('Poshe'));
  
  const sterlingRate = sterling?.bestMapRate ?? 9000;
  const lePosheRate = lePoshe?.bestMapRate ?? 8500;
  
  // Calculate base rate: slightly below Sterling, competitive with Le Poshe
  let baseRate = Math.min(sterlingRate * 0.92, (sterlingRate + lePosheRate) / 2);
  
  // Season adjustments
  const seasonMultiplier: Record<string, number> = {
    'peak': 1.15,
    'festival': 1.20,
    'shoulder': 1.05,
    'off-peak': 0.90,
  };
  
  baseRate *= seasonMultiplier[params.seasonType] ?? 1.0;
  
  // Weekend premium
  if (params.isWeekend) {
    baseRate *= 1.12;
  }
  
  // Ensure within bounds
  baseRate = Math.max(5000, Math.min(12000, Math.round(baseRate / 100) * 100));
  
  return {
    recommended_map_rate: baseRate,
    confidence_score: 0.6,
    reasoning: `Fallback calculation: Based on Sterling (₹${sterlingRate}) and Le Poshe (₹${lePosheRate}), ` +
      `with ${params.seasonType} season adjustment and ${params.isWeekend ? 'weekend' : 'weekday'} pricing.`,
    pricing_strategy: 'balanced',
    occupancy_expectation: params.seasonType === 'peak' ? 'high' : 'medium',
    premium_discount_suggestion: 'Standard competitive positioning',
    min_rate: Math.round(baseRate * 0.9),
    max_rate: Math.round(baseRate * 1.1),
    season_type: params.seasonType,
    demand_level: params.seasonType === 'peak' ? 'high' : 'medium',
    weekend_premium_percent: params.isWeekend ? 12 : 0,
    insights: [],
  };
}

/**
 * Default insights when AI fails
 */
function getDefaultInsights(params: {
  seasonType: string;
}): GeminiInsight[] {
  return [
    {
      type: 'pricing-pressure',
      title: 'Market Rate Analysis Pending',
      summary: 'AI analysis temporarily unavailable. Using algorithmic pricing based on competitor rates and seasonal factors.',
      severity: 'info',
      actionable: false,
    },
    {
      type: params.seasonType === 'peak' ? 'demand-surge' : 'pricing-pressure',
      title: params.seasonType === 'peak' ? 'Peak Season Demand Expected' : 'Standard Demand Period',
      summary: params.seasonType === 'peak' 
        ? 'Peak season pricing in effect. Consider premium positioning for high-demand dates.'
        : 'Normal demand period. Focus on competitive pricing to maintain occupancy.',
      severity: params.seasonType === 'peak' ? 'opportunity' : 'info',
      actionable: true,
    },
  ];
}
