// ============================================================
// KodaiRateIQ — Hotels.com Scraper
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

// Hotels.com uses same Expedia property IDs under the hood
const HOTELSDOTCOM_IDS: Record<string, string> = {
  'The Carlton':               '6823654',
  'The Tamara Kodai':          '12507628',
  'Hotel Kodai International': '3296478',
  'Sterling Kodai Lake':       '6432118',
  'Le Poshe by Sparsa':        '14856234',
};

export class HotelsDotComScraper extends BaseScraper {
  get source(): string { return 'hotels.com'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const propertyId = HOTELSDOTCOM_IDS[hotelName];
    if (!propertyId) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      const url = `https://www.hotels.com/ho${propertyId}?chkin=${ci}&chkout=${co}&rm1=a2&x_pwa=1`;

      await page.waitForTimeout(1000 + Math.random() * 2000);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

      try {
        const closeBtn = page.locator('[data-stid="modal-close"], [aria-label="Close"]').first();
        if (await closeBtn.isVisible({ timeout: 2000 })) await closeBtn.click();
      } catch { /* no popup */ }

      const rooms = await page.$$('[data-stid="property-room-unit"]');

      for (const room of rooms) {
        try {
          const nameEl = await room.$('h3, [class*="uitk-heading"]');
          const roomName = (await nameEl?.textContent())?.trim() || 'Standard Room';

          const priceEl = await room.$('[class*="uitk-lockup-price"]');
          const priceText = await priceEl?.textContent();
          const price = this.extractPrice(priceText || '');

          const inclEl = await room.$('[class*="inclusion"], [class*="amenity"]');
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
              confidence: meal.confidence * 0.88,
            });
          }
        } catch { /* skip */ }
      }

      if (rates.length === 0) {
        const priceEl = await page.$('[class*="uitk-lockup-price"]');
        const price = this.extractPrice((await priceEl?.textContent()) || '');
        if (price && price > 1000) {
          rates.push({
            hotelName, roomType: 'Best Available',
            mapRate: null, cpRate: null, epRate: price,
            taxPercent: 18, taxInclusive: true, totalWithTax: price,
            source: this.source, sourceUrl: url, isAvailable: true,
            breakfastIncluded: false, dinnerIncluded: false, lunchIncluded: false,
            freeCancellation: false, hasDiscount: false,
            occupancy: 2, scrapedAt: new Date(), confidence: 0.58,
          });
        }
      }
    } catch (err) {
      console.error(`[hotels.com] Failed for ${hotelName}:`, err);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
