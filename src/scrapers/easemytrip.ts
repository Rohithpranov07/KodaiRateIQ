// ============================================================
// KodaiRateIQ — EaseMyTrip Scraper
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

const EMT_IDS: Record<string, string> = {
  'The Carlton':               'the-carlton-kodaikanal',
  'The Tamara Kodai':          'the-tamara-kodaikanal',
  'Hotel Kodai International': 'hotel-kodai-international',
  'Sterling Kodai Lake':       'sterling-kodai-lake-kodaikanal',
  'Le Poshe by Sparsa':        'le-poshe-by-sparsa-kodaikanal',
};

export class EaseMyTripScraper extends BaseScraper {
  get source(): string { return 'easemytrip'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const slug = EMT_IDS[hotelName];
    if (!slug) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      const url = `https://hotels.easemytrip.com/${slug}?checkin=${ci}&checkout=${co}&adults=2&rooms=1`;

      await this.navigate(page, url);

      // Close modals
      try {
        const closeBtn = page.locator('[class*="close-btn"], [class*="closeBtn"]').first();
        if (await closeBtn.isVisible({ timeout: 2000 })) await closeBtn.click();
      } catch { /* none */ }

      const roomCards = await page.$$('[class*="roomBox"], [class*="room-box"], [class*="room_row"]');

      for (const card of roomCards) {
        try {
          const nameEl = await card.$('[class*="roomName"], [class*="room-name"], h3, h4');
          const roomName = (await nameEl?.textContent())?.trim() || 'Standard Room';

          const priceEl = await card.$('[class*="price"], [class*="amount"], [class*="rate"]');
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
              confidence: meal.confidence * 0.82,
            });
          }
        } catch { /* skip */ }
      }

      if (rates.length === 0) {
        const allPrices = await page.$$('[class*="price"], [class*="Price"]');
        for (const el of allPrices.slice(0, 3)) {
          const price = this.extractPrice((await el.textContent()) || '');
          if (price && price > 2000 && price < 100000) {
            rates.push({
              hotelName, roomType: 'Best Available',
              mapRate: null, cpRate: null, epRate: normalizeTaxInclusive(price, false),
              taxPercent: 18, taxInclusive: false, totalWithTax: normalizeTaxInclusive(price, false),
              source: this.source, sourceUrl: url, isAvailable: true,
              breakfastIncluded: false, dinnerIncluded: false, lunchIncluded: false,
              freeCancellation: false, hasDiscount: false,
              occupancy: 2, scrapedAt: new Date(), confidence: 0.55,
            });
            break;
          }
        }
      }
      if (rates.length === 0) {
        const evalPrices = await this.evaluatePrices(page);
        if (evalPrices.length > 0) {
          rates.push({
            hotelName, roomType: 'Best Available',
            mapRate: null, cpRate: null, epRate: evalPrices[0],
            taxPercent: 18, taxInclusive: false, totalWithTax: evalPrices[0],
            source: this.source, sourceUrl: url, isAvailable: true,
            breakfastIncluded: false, dinnerIncluded: false, lunchIncluded: false,
            freeCancellation: false, hasDiscount: false,
            occupancy: 2, scrapedAt: new Date(), confidence: 0.45,
          });
        }
      }
    } catch (err) {
      console.error(`[easemytrip] Failed for ${hotelName}:`, err);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
