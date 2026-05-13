// ============================================================
// KodaiRateIQ — Trivago Meta-Search Scraper
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';
import { sleep } from '@/lib/utils';

const TRIVAGO_IDS: Record<string, string> = {
  'The Carlton':               '56781234',
  'The Tamara Kodai':          '89234567',
  'Hotel Kodai International': '34567890',
  'Sterling Kodai Lake':       '67890123',
  'Le Poshe by Sparsa':        '23456789',
};

export class TrivagoScraper extends BaseScraper {
  get source(): string { return 'trivago'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const id = TRIVAGO_IDS[hotelName];
    if (!id) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      const url = `https://www.trivago.in/en-IN/odr?iPathId=${id}&iGeoDistanceLimit=50000&aPriceAttributeCodes%5B%5D=7&a3COSL=0&aDPRoomType%5B%5D=7&iRoomType=7&aDateRange%5Bstart%5D=${ci}&aDateRange%5Bend%5D=${co}&iRoomAmount=1&iPersonAmountAdults=2`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      await sleep(5000);

      // Trivago shows aggregated partner prices
      const dealCards = await page.$$('[data-qa="itemlist-element"], [class*="itemlist-element"]');

      for (const card of dealCards.slice(0, 10)) {
        try {
          const priceEl = await card.$('[data-qa="display-price"], [class*="price__value"]');
          const priceText = await priceEl?.textContent();
          const price = this.extractPrice(priceText || '');

          const inclEl = await card.$('[class*="deal-tag"], [class*="info-tag"]');
          const inclText = (await inclEl?.textContent())?.toLowerCase() || '';

          const sourceEl = await card.$('[class*="advertiser-name"], [data-qa="advertiser"]');
          const sourceName = (await sourceEl?.textContent())?.trim().toLowerCase() || 'partner';

          if (price && price > 1000) {
            const meal = classifyMealPlan(inclText);
            if (meal.shouldReject) continue;

            rates.push({
              hotelName,
              roomType: 'Best Available',
              mapRate: meal.isMapEligible ? price : null,
              cpRate: meal.plan === 'CP' ? price : null,
              epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? price : null,
              taxPercent: 18,
              taxInclusive: true,
              totalWithTax: price,
              source: `trivago/${sourceName}`,
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
              confidence: meal.confidence * 0.75,
            });
          }
        } catch { /* skip */ }
      }
    } catch (err) {
      console.error(`[trivago] Failed for ${hotelName}:`, err);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
