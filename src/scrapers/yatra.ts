// ============================================================
// KodaiRateIQ — Yatra Hotels Scraper
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';
import { sleep } from '@/lib/utils';

const YATRA_IDS: Record<string, string> = {
  'The Carlton':               'hotels/india/kodaikanal/the-carlton',
  'The Tamara Kodai':          'hotels/india/kodaikanal/the-tamara-kodaikanal',
  'Hotel Kodai International': 'hotels/india/kodaikanal/hotel-kodai-international',
  'Sterling Kodai Lake':       'hotels/india/kodaikanal/sterling-kodai-lake',
  'Le Poshe by Sparsa':        'hotels/india/kodaikanal/le-poshe-by-sparsa',
};

export class YatraScraper extends BaseScraper {
  get source(): string { return 'yatra'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const path = YATRA_IDS[hotelName];
    if (!path) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn).replace(/-/g, '');
      const co = this.formatDate(checkOut).replace(/-/g, '');

      const url = `https://www.yatra.com/${path}?checkin=${ci}&checkout=${co}&rooms=1&adults=2`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      await sleep(4000);

      // Dismiss login nags
      try {
        const skipBtn = page.locator('[class*="skip"], button:has-text("Continue")').first();
        if (await skipBtn.isVisible({ timeout: 2000 })) await skipBtn.click();
      } catch { /* none */ }

      const roomCards = await page.$$('[class*="room-option"], [class*="roomOption"], [id*="room"]');

      for (const card of roomCards) {
        try {
          const nameEl = await card.$('[class*="room-type"], [class*="roomType"], h3, h4');
          const roomName = (await nameEl?.textContent())?.trim() || 'Standard Room';

          const priceEl = await card.$('[class*="price"], [class*="amount"]');
          const priceText = await priceEl?.textContent();
          const price = this.extractPrice(priceText || '');

          const inclEl = await card.$('[class*="meal"], [class*="inclusion"], [class*="plan-type"]');
          const inclText = (await inclEl?.textContent())?.toLowerCase() || '';

          if (price && price > 1000) {
            const meal = classifyMealPlan(inclText, roomName);
            if (meal.shouldReject) continue;

            const taxInclusive = priceText?.toLowerCase().includes('incl') || false;
            const normalized = normalizeTaxInclusive(price, taxInclusive);

            rates.push({
              hotelName,
              roomType: roomName,
              mapRate: meal.isMapEligible ? normalized : null,
              cpRate: meal.plan === 'CP' ? normalized : null,
              epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalized : null,
              taxPercent: 18,
              taxInclusive: taxInclusive,
              totalWithTax: normalized,
              source: this.source,
              sourceUrl: url,
              isAvailable: true,
              breakfastIncluded: meal.breakfastIncluded,
              dinnerIncluded: meal.dinnerIncluded,
              lunchIncluded: meal.lunchIncluded,
              mealDetails: inclText || undefined,
              freeCancellation: inclText.includes('free cancel'),
              hasDiscount: false,
              occupancy: 2,
              scrapedAt: new Date(),
              confidence: meal.confidence * 0.80,
            });
          }
        } catch { /* skip */ }
      }

      if (rates.length === 0) {
        const priceEl = await page.$('[class*="hotel-price"], [class*="total-price"]');
        const price = this.extractPrice((await priceEl?.textContent()) || '');
        if (price && price > 1000) {
          rates.push({
            hotelName, roomType: 'Best Available',
            mapRate: null, cpRate: null, epRate: normalizeTaxInclusive(price, false),
            taxPercent: 18, taxInclusive: false, totalWithTax: normalizeTaxInclusive(price, false),
            source: this.source, sourceUrl: url, isAvailable: true,
            breakfastIncluded: false, dinnerIncluded: false, lunchIncluded: false,
            freeCancellation: false, hasDiscount: false,
            occupancy: 2, scrapedAt: new Date(), confidence: 0.55,
          });
        }
      }
    } catch (err) {
      console.error(`[yatra] Failed for ${hotelName}:`, err);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
