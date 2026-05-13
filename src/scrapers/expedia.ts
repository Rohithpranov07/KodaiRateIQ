// ============================================================
// KodaiRateIQ — Expedia Scraper
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

const EXPEDIA_IDS: Record<string, string> = {
  'The Carlton':           'the-carlton-hotel-kodaikanal',
  'The Tamara Kodai':      'the-tamara-kodaikanal',
  'Hotel Kodai International': 'hotel-kodai-international',
  'Sterling Kodai Lake':   'sterling-kodai-lake',
  'Le Poshe by Sparsa':    'le-poshe-by-sparsa',
};

const EXPEDIA_PROPERTY_IDS: Record<string, string> = {
  'The Carlton':               '6823654',
  'The Tamara Kodai':          '12507628',
  'Hotel Kodai International': '3296478',
  'Sterling Kodai Lake':       '6432118',
  'Le Poshe by Sparsa':        '14856234',
};

export class ExpediaScraper extends BaseScraper {
  get source(): string { return 'expedia'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const slug = EXPEDIA_IDS[hotelName];
    const propertyId = EXPEDIA_PROPERTY_IDS[hotelName];
    if (!slug && !propertyId) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      // Try direct property URL first
      const url = propertyId
        ? `https://www.expedia.co.in/h${propertyId}.Hotel-Information?chkin=${ci}&chkout=${co}&rm1=a2`
        : `https://www.expedia.co.in/hotels/${slug}?chkin=${ci}&chkout=${co}&rm1=a2`;

      await page.waitForTimeout(1000 + Math.random() * 2000);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

      // Dismiss popups
      try {
        const closeBtn = page.locator('[data-stid="modal-close"], button[aria-label="Close"]').first();
        if (await closeBtn.isVisible({ timeout: 2000 })) await closeBtn.click();
      } catch { /* no popup */ }

      // Room cards
      const rooms = await page.$$('[data-stid="section-room-list"] [data-stid="property-room-unit"]');

      for (const room of rooms) {
        try {
          const nameEl = await room.$('[data-stid="header-room-name"] h3, [class*="uitk-heading"]');
          const roomName = (await nameEl?.textContent())?.trim() || 'Standard Room';

          const priceEl = await room.$('[data-stid="rooms-room-price"] [class*="uitk-lockup-price"]');
          const priceText = await priceEl?.textContent();
          const price = this.extractPrice(priceText || '');

          const inclEl = await room.$('[data-stid="room-inclusion"], [class*="inclusion"]');
          const inclText = (await inclEl?.textContent())?.toLowerCase() || '';

          if (price && price > 1000) {
            const meal = classifyMealPlan(inclText, roomName);
            if (meal.shouldReject) continue;

            rates.push({
              hotelName,
              roomType: roomName,
              mapRate: meal.isMapEligible ? normalizeTaxInclusive(price, true) : null,
              cpRate: meal.plan === 'CP' ? normalizeTaxInclusive(price, true) : null,
              epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalizeTaxInclusive(price, true) : null,
              taxPercent: 18,
              taxInclusive: true,
              totalWithTax: price,
              source: this.source,
              sourceUrl: url,
              isAvailable: true,
              breakfastIncluded: meal.breakfastIncluded,
              dinnerIncluded: meal.dinnerIncluded,
              lunchIncluded: meal.lunchIncluded,
              mealDetails: inclText || undefined,
              freeCancellation: inclText.includes('free cancel') || inclText.includes('fully refundable'),
              hasDiscount: false,
              occupancy: 2,
              scrapedAt: new Date(),
              confidence: meal.confidence * 0.9,
            });
          }
        } catch { /* skip malformed card */ }
      }

      // Fallback: summary price
      if (rates.length === 0) {
        const mainPrice = await page.$('[data-stid="price-summary"] [class*="uitk-lockup-price"]');
        const priceText = await mainPrice?.textContent();
        const price = this.extractPrice(priceText || '');
        if (price && price > 1000) {
          rates.push(this.buildFallbackRate(hotelName, price, url));
        }
      }
    } catch (err) {
      console.error(`[expedia] Failed for ${hotelName}:`, err);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }

  private buildFallbackRate(hotelName: string, price: number, url: string): ScrapedRate {
    return {
      hotelName, roomType: 'Best Available',
      mapRate: null, cpRate: null, epRate: price,
      taxPercent: 18, taxInclusive: true, totalWithTax: price,
      source: this.source, sourceUrl: url, isAvailable: true,
      breakfastIncluded: false, dinnerIncluded: false, lunchIncluded: false,
      freeCancellation: false, hasDiscount: false,
      occupancy: 2, scrapedAt: new Date(), confidence: 0.60,
    };
  }
}
