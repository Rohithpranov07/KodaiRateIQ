// ============================================================
// KodaiRateIQ — Agoda Scraper (v2 — MAP Classifier)
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';
import { sleep } from '@/lib/utils';

const AGODA_SLUGS: Record<string, string> = {
  'The Carlton':               'the-carlton-kodaikanal',
  'The Tamara Kodai':          'the-tamara-kodaikanal',
  'Hotel Kodai International': 'hotel-kodai-international',
  'Sterling Kodai Lake':       'sterling-kodai-lake',
  'Le Poshe by Sparsa':        'le-poshe-by-sparsa-kodaikanal',
};

export class AgodaScraper extends BaseScraper {
  get source(): string { return 'agoda'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const slug = AGODA_SLUGS[hotelName];
    if (!slug) {
      console.warn(`[agoda] No slug for: ${hotelName}`);
      return [];
    }

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);
      const url = `https://www.agoda.com/en-in/${slug}/hotel/kodaikanal-india.html?checkIn=${ci}&checkOut=${co}&rooms=1&adults=2&children=0`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      await sleep(5000);

      // Cookie consent
      try {
        const cookieBtn = page.locator('[data-selenium="cookie-consent-accept-btn"], #consent-btn');
        if (await cookieBtn.isVisible({ timeout: 3000 })) {
          await cookieBtn.click();
          await sleep(1000);
        }
      } catch { /* no cookie banner */ }

      const roomCards = await page.$$('[data-selenium="RoomCard"], [class*="RoomCard"], [class*="room-card"]');

      for (const card of roomCards) {
        try {
          const nameEl = await card.$('[data-selenium="RoomName"], [class*="RoomName"], h3');
          const roomName = (await nameEl?.textContent())?.trim() || 'Standard Room';

          const priceEl = await card.$('[data-selenium="PriceDisplay"], [class*="price"], [class*="Price"]');
          const priceText = await priceEl?.textContent();
          const price = this.extractPrice(priceText || '');

          const inclEl = await card.$('[class*="inclusion"], [class*="benefit"], [class*="meal"]');
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
              freeCancellation: inclText.includes('free cancel'),
              hasDiscount: false,
              occupancy: 2,
              scrapedAt: new Date(),
              confidence: meal.confidence * 0.90,
            });
          }
        } catch { /* skip malformed */ }
      }

      if (rates.length === 0) {
        const priceEl = await page.$('[data-selenium="PriceDisplay"], [class*="PropertyCard__Price"]');
        const price = this.extractPrice((await priceEl?.textContent()) || '');
        if (price && price > 2000 && price < 100000) {
          rates.push({
            hotelName, roomType: 'Best Available',
            mapRate: null, cpRate: null, epRate: price,
            taxPercent: 18, taxInclusive: true, totalWithTax: price,
            source: this.source, sourceUrl: url, isAvailable: true,
            breakfastIncluded: false, dinnerIncluded: false, lunchIncluded: false,
            freeCancellation: false, hasDiscount: false,
            occupancy: 2, scrapedAt: new Date(), confidence: 0.60,
          });
        }
      }
    } catch (err) {
      console.error(`[agoda] Failed for ${hotelName}:`, err);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
