// ============================================================
// KodaiRateIQ — MakeMyTrip Scraper (v2 — MAP Classifier)
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

const MMT_SLUGS: Record<string, string> = {
  'The Carlton':               'the-carlton-kodaikanal',
  'The Tamara Kodai':          'the-tamara-kodaikanal',
  'Hotel Kodai International': 'hotel-kodai-international-kodaikanal',
  'Sterling Kodai Lake':       'sterling-kodai-lake-kodaikanal',
  'Le Poshe by Sparsa':        'le-poshe-by-sparsa-kodaikanal',
};

export class MakeMyTripScraper extends BaseScraper {
  get source(): string { return 'makemytrip'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const slug = MMT_SLUGS[hotelName];
    if (!slug) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);
      const url = `https://www.makemytrip.com/hotels/hotel-details/?hotelId=${slug}&checkin=${ci}&checkout=${co}&roomStayQualifier=2e0e&city=CTKDI`;

      await page.waitForTimeout(1000 + Math.random() * 2000);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

      // Close popup/modal
      try {
        const closeBtn = page.locator('[class*="close"], [class*="Close"]').first();
        if (await closeBtn.isVisible({ timeout: 2000 })) await closeBtn.click();
      } catch { /* no popup */ }

      const roomSections = await page.$$('[class*="roomCard"], [class*="RoomCard"], [id*="room"]');

      for (const section of roomSections) {
        try {
          const nameEl = await section.$('[class*="roomType"], [class*="RoomType"], h3');
          const roomName = (await nameEl?.textContent())?.trim() || 'Standard Room';

          const priceEl = await section.$('[class*="roomPrice"], [class*="price"], [class*="amount"]');
          const priceText = await priceEl?.textContent();
          const price = this.extractPrice(priceText || '');

          const inclEl = await section.$('[class*="inclusion"], [class*="meal"]');
          const inclText = (await inclEl?.textContent())?.toLowerCase() || '';

          if (price && price > 1000) {
            const meal = classifyMealPlan(inclText, roomName);
            if (meal.shouldReject) continue;

            // MMT shows pre-tax prices
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
              confidence: meal.confidence * 0.88,
            });
          }
        } catch { /* skip */ }
      }

      if (rates.length === 0) {
        const mainPrice = await page.$('[class*="tariff"], [class*="finalPrice"]');
        const price = this.extractPrice((await mainPrice?.textContent()) || '');
        if (price && price > 2000) {
          rates.push({
            hotelName, roomType: 'Best Available',
            mapRate: null, cpRate: null, epRate: normalizeTaxInclusive(price, false),
            taxPercent: 18, taxInclusive: false, totalWithTax: normalizeTaxInclusive(price, false),
            source: this.source, sourceUrl: url, isAvailable: true,
            breakfastIncluded: false, dinnerIncluded: false, lunchIncluded: false,
            freeCancellation: false, hasDiscount: false,
            occupancy: 2, scrapedAt: new Date(), confidence: 0.60,
          });
        }
      }
    } catch (err) {
      console.error(`[mmt] Failed for ${hotelName}:`, err);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
