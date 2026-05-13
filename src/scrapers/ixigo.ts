// ============================================================
// KodaiRateIQ — ixigo Hotels Scraper
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';
import { sleep } from '@/lib/utils';

const IXIGO_IDS: Record<string, string> = {
  'The Carlton':               'the-carlton-kodaikanal-hotel',
  'The Tamara Kodai':          'the-tamara-kodaikanal-hotel',
  'Hotel Kodai International': 'hotel-kodai-international-kodaikanal',
  'Sterling Kodai Lake':       'sterling-kodai-lake-kodaikanal',
  'Le Poshe by Sparsa':        'le-poshe-by-sparsa-kodaikanal',
};

export class IxigoScraper extends BaseScraper {
  get source(): string { return 'ixigo'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const slug = IXIGO_IDS[hotelName];
    if (!slug) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      const url = `https://www.ixigo.com/hotels/${slug}?checkin=${ci}&checkout=${co}&adults=2&rooms=1`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      await sleep(4500);

      const roomCards = await page.$$('[class*="room-card"], [class*="roomCard"], [data-testid*="room"]');

      for (const card of roomCards) {
        try {
          const nameEl = await card.$('h3, h4, [class*="room-name"], [class*="roomName"]');
          const roomName = (await nameEl?.textContent())?.trim() || 'Standard Room';

          const priceEl = await card.$('[class*="price"], [class*="rate"], [class*="amount"]');
          const priceText = await priceEl?.textContent();
          const price = this.extractPrice(priceText || '');

          const inclEl = await card.$('[class*="meal"], [class*="inclusion"], [class*="plan"]');
          const inclText = (await inclEl?.textContent())?.toLowerCase() || '';

          if (price && price > 1000) {
            const meal = classifyMealPlan(inclText, roomName);
            if (meal.shouldReject) continue;

            const normalized = normalizeTaxInclusive(price, false);

            rates.push({
              hotelName,
              roomType: roomName,
              mapRate: meal.isMapEligible ? normalized : null,
              cpRate: meal.plan === 'CP' ? normalized : null,
              epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalized : null,
              taxPercent: 18,
              taxInclusive: false,
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
        const priceEl = await page.$('[class*="hotel-price"], [class*="hotelPrice"]');
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
      console.error(`[ixigo] Failed for ${hotelName}:`, err);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
