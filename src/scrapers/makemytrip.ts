// ============================================================
// KodaiRateIQ — MakeMyTrip Scraper
// Returns HTTP 403 (hard-blocked) from Railway datacenter IPs.
// Scraper is kept but immediately returns [] to avoid wasting a
// browser slot on a guaranteed failure.
// ============================================================

import { BaseScraper } from './base';
import type { ScrapedRate } from '@/types';

export class MakeMyTripScraper extends BaseScraper {
  get source(): string { return 'makemytrip'; }

  async scrapeHotel(hotelName: string): Promise<ScrapedRate[]> {
    console.log(`[makemytrip] SKIP ${hotelName} — HTTP 403 hard-blocked from Railway (non-India IP)`);
    return [];
  }
}
