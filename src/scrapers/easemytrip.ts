// ============================================================
// KodaiRateIQ — EaseMyTrip Scraper
// All tested hotel/search endpoints return 404 from non-India IPs.
// Scraper is kept in the codebase but immediately returns []
// to avoid wasting a browser slot on a guaranteed failure.
// ============================================================

import { BaseScraper } from './base';
import type { ScrapedRate } from '@/types';

export class EaseMyTripScraper extends BaseScraper {
  get source(): string { return 'easemytrip'; }

  async scrapeHotel(hotelName: string): Promise<ScrapedRate[]> {
    console.log(`[easemytrip] SKIP ${hotelName} — all endpoints return 404 from Railway IP`);
    return [];
  }
}
