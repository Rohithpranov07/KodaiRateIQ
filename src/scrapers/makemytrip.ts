// ============================================================
// KodaiRateIQ — MakeMyTrip Scraper
// ============================================================

import { BaseScraper } from './base';
import type { ScrapedRate } from '@/types';
import { sleep } from '@/lib/utils';

const MMT_SLUGS: Record<string, string> = {
  'The Carlton': 'the-carlton-kodaikanal',
  'The Tamara Kodai': 'the-tamara-kodaikanal',
  'Hotel Kodai International': 'hotel-kodai-international-kodaikanal',
  'Sterling Kodai Lake': 'sterling-kodai-lake-kodaikanal',
  'Le Poshe by Sparsa': 'le-poshe-by-sparsa-kodaikanal',
};

export class MakeMyTripScraper extends BaseScraper {
  get source(): string {
    return 'makemytrip';
  }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const slug = MMT_SLUGS[hotelName];
    if (!slug) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const checkInStr = this.formatDate(checkIn);
      const checkOutStr = this.formatDate(checkOut);

      const url = `https://www.makemytrip.com/hotels/hotel-details/?hotelId=${slug}&checkin=${checkInStr}&checkout=${checkOutStr}&roomStayQualifier=2e0e&city=CTKDI`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      await sleep(5000);

      // Close any popups/modals
      try {
        const closeBtn = page.locator('[class*="close"], [class*="Close"]').first();
        if (await closeBtn.isVisible({ timeout: 2000 })) {
          await closeBtn.click();
        }
      } catch { /* No popup */ }

      // Extract room options
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
            const breakfastIncluded = inclText.includes('breakfast');
            const dinnerIncluded = inclText.includes('dinner') || inclText.includes('half board');

            rates.push({
              hotelName,
              roomType: roomName,
              mapRate: breakfastIncluded && dinnerIncluded ? price : null,
              cpRate: breakfastIncluded && !dinnerIncluded ? price : null,
              epRate: !breakfastIncluded ? price : null,
              taxPercent: 18,
              taxInclusive: false,
              totalWithTax: Math.round(price * 1.18),
              source: this.source,
              sourceUrl: url,
              isAvailable: true,
              breakfastIncluded,
              dinnerIncluded,
              lunchIncluded: false,
              mealDetails: inclText || undefined,
              freeCancellation: inclText.includes('free cancel'),
              hasDiscount: false,
              occupancy: 2,
              scrapedAt: new Date(),
              confidence: 0.80,
            });
          }
        } catch (e) {
          console.warn('[mmt] Room parse error:', e);
        }
      }

      // Fallback price extraction
      if (rates.length === 0) {
        const mainPrice = await page.$('[class*="tariff"], [class*="finalPrice"]');
        const text = await mainPrice?.textContent();
        const price = this.extractPrice(text || '');
        if (price && price > 2000) {
          rates.push({
            hotelName,
            roomType: 'Best Available',
            mapRate: null, cpRate: null, epRate: price,
            taxPercent: 18, taxInclusive: false,
            totalWithTax: Math.round(price * 1.18),
            source: this.source, sourceUrl: url,
            isAvailable: true,
            breakfastIncluded: false, dinnerIncluded: false, lunchIncluded: false,
            freeCancellation: false, hasDiscount: false,
            occupancy: 2, scrapedAt: new Date(), confidence: 0.6,
          });
        }
      }
    } catch (error) {
      console.error(`[mmt] Failed for ${hotelName}:`, error);
      throw error;
    } finally {
      await page.close();
    }

    return rates;
  }
}
