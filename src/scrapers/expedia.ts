// ============================================================
// KodaiRateIQ — Expedia Scraper
// Returns HTTP 429 (rate-limited/blocked) from Railway IPs.
// Scraper immediately returns [] to avoid wasting a browser slot.
// ============================================================

import { BaseScraper } from './base';
import type { ScrapedRate } from '@/types';

export class ExpediaScraper extends BaseScraper {
  get source(): string { return 'expedia'; }

  async scrapeHotel(hotelName: string): Promise<ScrapedRate[]> {
    console.log(`[expedia] SKIP ${hotelName} — HTTP 429 rate-limited from Railway IP`);
    return [];
  }
}
