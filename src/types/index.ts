// ============================================================
// KodaiRateIQ — Core Type Definitions
// ============================================================

// Hotel types
export interface HotelConfig {
  name: string;
  slug: string;
  category: 'ultra-premium' | 'premium' | 'mid-premium' | 'standard';
  starRating: number;
  role: 'target' | 'premium-anchor' | 'ultra-premium-anchor' | 'direct-competitor';
  website?: string;
  otaUrls?: Record<string, string>;
}

// Scraped rate data
export interface ScrapedRate {
  hotelName: string;
  roomType: string;
  mapRate: number | null;
  cpRate: number | null;
  epRate: number | null;
  taxPercent: number;
  taxInclusive: boolean;
  totalWithTax: number | null;
  source: string;
  sourceUrl?: string;
  isAvailable: boolean;
  roomsLeft?: number;
  breakfastIncluded: boolean;
  dinnerIncluded: boolean;
  lunchIncluded: boolean;
  mealDetails?: string;
  cancellationPolicy?: string;
  freeCancellation: boolean;
  hasDiscount: boolean;
  discountPercent?: number;
  offerDescription?: string;
  occupancy: number;
  singleOccRate?: number;
  doubleOccRate?: number;
  extraAdultRate?: number;
  extraChildRate?: number;
  scrapedAt: Date;
  confidence: number;
}

// Scraper result
export interface ScrapeResult {
  success: boolean;
  source: string;
  hotelName: string;
  rates: ScrapedRate[];
  duration: number;
  error?: string;
  retryCount: number;
}

// Recommendation output
export interface PricingRecommendation {
  recommendedMapRate: number;
  recommendedCpRate?: number;
  recommendedEpRate?: number;
  minRate: number;
  maxRate: number;
  optimalRate: number;
  strategy: 'aggressive' | 'conservative' | 'balanced' | 'premium';
  confidenceScore: number;
  reasoning: string;
  marketPosition: 'below-market' | 'at-market' | 'above-market';
  seasonType?: 'peak' | 'off-peak' | 'shoulder' | 'festival';
  demandLevel?: 'high' | 'medium' | 'low';
  weekendPremium: number;
  competitorRates: CompetitorRateSummary[];
}

export interface CompetitorRateSummary {
  hotelName: string;
  bestMapRate: number | null;
  bestSource: string | null;
  delta: number | null; // percentage diff from recommended
  position: string;
}

// AI Gemini response
export interface GeminiRecommendation {
  recommended_map_rate: number;
  confidence_score: number;
  reasoning: string;
  pricing_strategy: string;
  occupancy_expectation: string;
  premium_discount_suggestion: string;
  min_rate: number;
  max_rate: number;
  season_type: string;
  demand_level: string;
  weekend_premium_percent: number;
  insights: GeminiInsight[];
}

export interface GeminiInsight {
  type: string;
  title: string;
  summary: string;
  severity: 'info' | 'warning' | 'critical' | 'opportunity';
  actionable: boolean;
}

// Dashboard data
export interface DashboardData {
  currentRecommendation: PricingRecommendation | null;
  liveRates: LiveRateRow[];
  priceHistory: PriceHistoryPoint[];
  facilities: FacilityComparison[];
  insights: InsightItem[];
  lastUpdated: string;
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
}

export interface LiveRateRow {
  hotelId: string;
  hotelName: string;
  slug: string;
  category: string;
  starRating: number;
  role: string;
  currentMapRate: number | null;
  currentCpRate: number | null;
  currentEpRate: number | null;
  yesterdayMapRate: number | null;
  deltaPercent: number | null;
  trend: 'up' | 'down' | 'stable';
  cheapestOta: string | null;
  availability: string;
  isTarget: boolean;
  recommendedRate?: number;
}

export interface PriceHistoryPoint {
  date: string;
  [hotelSlug: string]: number | string | null;
}

export interface FacilityComparison {
  facility: string;
  category: string;
  hotels: Record<string, { available: boolean; quality: number }>;
}

export interface InsightItem {
  id: string;
  type: string;
  title: string;
  summary: string;
  severity: 'info' | 'warning' | 'critical' | 'opportunity';
  actionable: boolean;
  confidence: number;
  date: string;
}

// Chart types
export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
  timestamp: string;
}

// Scraper configuration
export interface ScraperConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  headless: boolean;
  userAgents: string[];
  rateLimit: number; // requests per minute
}

// Hotel positioning weights
export interface PositioningWeights {
  carlton: { weight: number; relation: 'below'; maxGapPercent: number };
  tamara: { weight: number; relation: 'below'; maxGapPercent: number };
  sterling: { weight: number; relation: 'competitive'; maxGapPercent: number };
  lePoshe: { weight: number; relation: 'competitive'; maxGapPercent: number };
}
