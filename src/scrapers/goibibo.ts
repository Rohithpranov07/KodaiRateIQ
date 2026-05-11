// ============================================================
// KodaiRateIQ — Goibibo Scraper
// ============================================================

import { BaseScraper } from './base';
import type { ScrapedRate } from '@/types';
import { sleep } from '@/lib/utils';

/**
 * Hotel name to Goibibo search identifiers
 */
const GOIBIBO_IDS: Record<string, string> = {
  'The Carlton': 'the-carlton-kodaikanal',
  'The Tamara Kodai': 'the-tamara-kodaikanal',
  'Hotel Kodai International': 'hotel-kodai-international',
  'Sterling Kodai Lake': 'sterling-kodai-lake',
  'Le Poshe by Sparsa': 'le-poshe-by-sparsa-kodaikanal',
};

export class GoibiboScraper extends BaseScraper {
  get source(): string {
    return 'goibibo';
  }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const hotelSlug = GOIBIBO_IDS[hotelName];
    if (!hotelSlug) {
      console.warn(`[goibibo] No ID found for: ${hotelName}`);
      return [];
    }

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const checkInStr = this.formatDate(checkIn);
      const checkOutStr = this.formatDate(checkOut);

      // Goibibo hotel detail page URL pattern
      const url = `https://www.goibibo.com/hotels/${hotelSlug}/?checkin=${checkInStr}&checkout=${checkOutStr}&adults=2&rooms=1`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      await sleep(4000); // Wait for dynamic pricing to load

      // Try to find room rate cards
      const roomCards = await page.$$('[class*="RoomCard"], [class*="room-card"], [data-testid*="room"]');

      if (roomCards.length > 0) {
        for (const card of roomCards) {
          try {
            // Room name
            const nameEl = await card.$('[class*="roomName"], [class*="RoomName"], h3, h4');
            const roomName = (await nameEl?.textContent())?.trim() || 'Standard Room';

            // Price
            const priceEl = await card.$('[class*="price"], [class*="Price"], [class*="amount"]');
            const priceText = await priceEl?.textContent();
            const price = this.extractPrice(priceText || '');

            // Meal info
            const mealEl = await card.$('[class*="meal"], [class*="inclusion"], [class*="Meal"]');
            const mealText = (await mealEl?.textContent())?.toLowerCase() || '';

            if (price && price > 1000) {
              const breakfastIncluded = mealText.includes('breakfast');
              const dinnerIncluded = mealText.includes('dinner') || mealText.includes('map');
              const isMap = breakfastIncluded && dinnerIncluded;

              rates.push({
                hotelName,
                roomType: roomName,
                mapRate: isMap ? price : null,
                cpRate: breakfastIncluded && !dinnerIncluded ? price : null,
                epRate: !breakfastIncluded ? price : null,
                taxPercent: 18,
                taxInclusive: false, // Goibibo often shows pre-tax
                totalWithTax: Math.round(price * 1.18),
                source: this.source,
                sourceUrl: url,
                isAvailable: true,
                breakfastIncluded,
                dinnerIncluded,
                lunchIncluded: false,
                mealDetails: mealText || undefined,
                freeCancellation: false,
                hasDiscount: false,
                occupancy: 2,
                scrapedAt: new Date(),
                confidence: 0.80,
              });
            }
          } catch (err) {
            console.warn('[goibibo] Error parsing room card:', err);
          }
        }
      }

      // Fallback: search for any price on the page
      if (rates.length === 0) {
        const allPrices = await page.$$('[class*="price"], [class*="Price"]');
        for (const priceEl of allPrices.slice(0, 3)) {
          const text = await priceEl.textContent();
          const price = this.extractPrice(text || '');
          if (price && price > 2000 && price < 100000) {
            rates.push({
              hotelName,
              roomType: 'Best Available',
              mapRate: null,
              cpRate: null,
              epRate: price,
              taxPercent: 18,
              taxInclusive: false,
              totalWithTax: Math.round(price * 1.18),
              source: this.source,
              sourceUrl: url,
              isAvailable: true,
              breakfastIncluded: false,
              dinnerIncluded: false,
              lunchIncluded: false,
              freeCancellation: false,
              hasDiscount: false,
              occupancy: 2,
              scrapedAt: new Date(),
              confidence: 0.6,
            });
            break;
          }
        }
      }
    } catch (error) {
      console.error(`[goibibo] Scraping failed for ${hotelName}:`, error);
      throw error;
    } finally {
      await page.close();
    }

    return rates;
  }
}
