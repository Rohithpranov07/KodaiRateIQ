// ============================================================
// KodaiRateIQ — Yatra Scraper
// Returns HTTP 000 (connection refused) from Railway datacenter IPs.
// Scraper is kept but immediately returns [] to avoid wasting a
// browser slot on a guaranteed network failure.
// ============================================================

import { BaseScraper } from './base';
import type { ScrapedRate } from '@/types';

export class YatraScraper extends BaseScraper {
  get source(): string { return 'yatra'; }

  async scrapeHotel(hotelName: string): Promise<ScrapedRate[]> {
    console.log(`[yatra] SKIP ${hotelName} — connection refused from Railway (non-India IP)`);
    return [];
  }
}
