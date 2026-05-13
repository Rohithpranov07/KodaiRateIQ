// ============================================================
// KodaiRateIQ — Utility Functions
// ============================================================

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with conflict resolution
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in INR
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format percentage with sign
 */
export function formatDelta(percent: number | null | undefined): string {
  if (percent == null) return '—';
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent.toFixed(1)}%`;
}

/**
 * Get trend direction
 */
export function getTrend(delta: number | null): 'up' | 'down' | 'stable' {
  if (delta == null || Math.abs(delta) < 0.5) return 'stable';
  return delta > 0 ? 'up' : 'down';
}

/**
 * Calculate percentage change
 */
export function calcDeltaPercent(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Format relative time
 */
export function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Get today's date at midnight (IST)
 */
export function todayIST(): Date {
  const now = new Date();
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  ist.setUTCHours(0, 0, 0, 0);
  return ist;
}

/**
 * Sleep utility for rate limiting
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Random user agent rotation
 */
export function getRandomUserAgent(): string {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

/**
 * Determine season type for Kodaikanal
 */
export function getSeasonType(date: Date): 'peak' | 'off-peak' | 'shoulder' | 'festival' {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDay(); // 0 = Sunday

  // Peak: April-June (summer), October (Diwali season), December (Christmas/NY)
  if (month >= 4 && month <= 6) return 'peak';
  if (month === 10 || month === 12) return 'festival';

  // Shoulder: March, July, September, November
  if ([3, 7, 9, 11].includes(month)) return 'shoulder';

  // Off-peak: January, February, August
  return 'off-peak';
}

/**
 * Check if date is a weekend
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 5 || day === 6; // Friday, Saturday, Sunday
}

/**
 * Hotel slug to display name mapping
 */
export const HOTEL_NAMES: Record<string, string> = {
  'the-carlton': 'The Carlton',
  'the-tamara-kodai': 'The Tamara Kodai',
  'hotel-kodai-international': 'Hotel Kodai International',
  'sterling-kodai-lake': 'Sterling Kodai Lake',
  'le-poshe-by-sparsa': 'Le Poshe by Sparsa',
};

/**
 * Hotel configuration constants
 */
export const HOTELS_CONFIG = [
  {
    name: 'The Carlton',
    slug: 'the-carlton',
    category: 'premium' as const,
    starRating: 5,
    role: 'premium-anchor' as const,
    website: 'https://carlton-kodaikanal.com',
  },
  {
    name: 'The Tamara Kodai',
    slug: 'the-tamara-kodai',
    category: 'ultra-premium' as const,
    starRating: 5,
    role: 'ultra-premium-anchor' as const,
    website: 'https://www.thetamara.com/kodaikanal',
  },
  {
    name: 'Hotel Kodai International',
    slug: 'hotel-kodai-international',
    category: 'standard' as const,
    starRating: 3,
    role: 'target' as const,
    website: 'https://www.kodaiinternational.com',
    isTarget: true,
  },
  {
    name: 'Sterling Kodai Lake',
    slug: 'sterling-kodai-lake',
    category: 'mid-premium' as const,
    starRating: 4,
    role: 'direct-competitor' as const,
    website: 'https://www.sterlingholidays.com/kodaikanal',
  },
  {
    name: 'Le Poshe by Sparsa',
    slug: 'le-poshe-by-sparsa',
    category: 'standard' as const,
    starRating: 3,
    role: 'direct-competitor' as const,
    website: 'https://www.sparsahotels.com/le-poshe',
  },
] as const;

/**
 * Positioning weights for pricing strategy
 */
export const POSITIONING_WEIGHTS = {
  'the-carlton': { weight: 0.15, relation: 'below' as const, maxGapPercent: 60 },
  'the-tamara-kodai': { weight: 0.10, relation: 'below' as const, maxGapPercent: 70 },
  'sterling-kodai-lake': { weight: 0.40, relation: 'competitive' as const, maxGapPercent: 15 },
  'le-poshe-by-sparsa': { weight: 0.35, relation: 'competitive' as const, maxGapPercent: 10 },
};
