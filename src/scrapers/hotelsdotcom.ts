// ============================================================
// KodaiRateIQ — Hotels.com Scraper
// Returns HTTP 429 (rate-limited/blocked) from Railway IPs.
// Scraper immediately returns [] to avoid wasting a browser slot.
// ============================================================

import { BaseScraper } from './base';
import type { ScrapedRate } from '@/types';

export class HotelsDotComScraper extends BaseScraper {
  get source(): string { return 'hotels.com'; }

  async scrapeHotel(hotelName: string): Promise<ScrapedRate[]> {
    console.log(`[hotels.com] SKIP ${hotelName} — HTTP 429 rate-limited from Railway IP`);
    return [];
  }
}
