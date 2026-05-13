// ============================================================
// KodaiRateIQ — Cleartrip Scraper
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';
import { sleep } from '@/lib/utils';

const CLEARTRIP_IDS: Record<string, string> = {
  'The Carlton':               'the-carlton-kodaikanal',
  'The Tamara Kodai':          'the-tamara-kodaikanal',
  'Hotel Kodai International': 'hotel-kodai-international',
  'Sterling Kodai Lake':       'sterling-kodai-lake',
  'Le Poshe by Sparsa':        'le-poshe-by-sparsa',
};

export class CleartripScraper extends BaseScraper {
  get source(): string { return 'cleartrip'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const slug = CLEARTRIP_IDS[hotelName];
    if (!slug) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      const url = `https://www.cleartrip.com/hotels/${slug}/details?checkin=${ci}&checkout=${co}&adults=2&rooms=1`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      await sleep(4000);

      // Dismiss cookie/login prompts
      try {
        const skipBtn = page.locator('[data-testid="skip-login"], button:has-text("Skip")').first();
        if (await skipBtn.isVisible({ timeout: 2000 })) await skipBtn.click();
      } catch { /* no prompt */ }

      // Room listings
      const roomCards = await page.$$('[class*="roomCard"], [data-testid*="room"], [class*="RoomCard"]');

      for (const card of roomCards) {
        try {
          const nameEl = await card.$('[class*="roomName"], [class*="RoomName"], h3, h4');
          const roomName = (await nameEl?.textContent())?.trim() || 'Standard Room';

          const priceEl = await card.$('[class*="price"], [class*="Price"], [class*="amount"]');
          const priceText = await priceEl?.textContent();
          const price = this.extractPrice(priceText || '');

          const inclEl = await card.$('[class*="inclusion"], [class*="meal"], [class*="amenity"]');
          const inclText = (await inclEl?.textContent())?.toLowerCase() || '';

          if (price && price > 1000) {
            const meal = classifyMealPlan(inclText, roomName);
            if (meal.shouldReject) continue;

            const taxIncl = priceText?.includes('incl') || priceText?.includes('taxes') ? true : false;
            const normalized = normalizeTaxInclusive(price, taxIncl);

            rates.push({
              hotelName,
              roomType: roomName,
              mapRate: meal.isMapEligible ? normalized : null,
              cpRate: meal.plan === 'CP' ? normalized : null,
              epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalized : null,
              taxPercent: 18,
              taxInclusive: taxIncl,
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
              confidence: meal.confidence * 0.85,
            });
          }
        } catch { /* skip */ }
      }

      if (rates.length === 0) {
        const priceEl = await page.$('[class*="finalPrice"], [class*="totalPrice"]');
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
      console.error(`[cleartrip] Failed for ${hotelName}:`, err);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
