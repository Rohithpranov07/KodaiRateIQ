// ============================================================
// KodaiRateIQ — EaseMyTrip Scraper
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

const EMT_SLUGS: Record<string, string> = {
  'The Carlton':               'the-carlton-kodaikanal',
  'The Tamara Kodai':          'the-tamara-kodaikanal',
  'Hotel Kodai International': 'hotel-kodai-international',
  'Sterling Kodai Lake':       'sterling-kodai-lake-kodaikanal',
  'Le Poshe by Sparsa':        'le-poshe-by-sparsa-kodaikanal',
};

const ROOM_SELS = [
  '[class*="roomBox"]',
  '[class*="room-box"]',
  '[class*="room_row"]',
  '[class*="RoomCard"]',
  '[class*="roomCard"]',
  '[data-testid*="room"]',
];

const PRICE_SELS = [
  '[class*="price"]',
  '[class*="Price"]',
  '[class*="amount"]',
  '[class*="rate"]',
  '[class*="tariff"]',
  'strong',
];

export class EaseMyTripScraper extends BaseScraper {
  get source(): string { return 'easemytrip'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const slug = EMT_SLUGS[hotelName];
    if (!slug) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      const url = `https://hotels.easemytrip.com/${slug}?checkin=${ci}&checkout=${co}&adults=2&rooms=1`;

      console.log(`[easemytrip] navigating hotel=${hotelName}`);
      await this.navigate(page, url);

      for (const closeSel of ['[class*="close-btn"]', '[class*="closeBtn"]', '[aria-label="Close"]']) {
        try {
          const btn = page.locator(closeSel).first();
          if (await btn.isVisible({ timeout: 1500 })) { await btn.click(); break; }
        } catch { /* none */ }
      }

      const roomSel = ROOM_SELS.join(', ');
      await this.waitForSelector(page, roomSel, 18000);

      let allCards: Array<import('playwright').ElementHandle> = [];
      for (const sel of ROOM_SELS) {
        const cards = await page.$$(sel);
        if (cards.length > 0) { allCards = cards; break; }
      }

      for (const card of allCards) {
        try {
          const nameEl = await card.$('[class*="roomName"], [class*="room-name"], h3, h4, [class*="name"]');
          const roomName = (await nameEl?.textContent())?.trim() || 'Standard Room';

          let price: number | null = null;
          let priceText = '';
          for (const priceSel of PRICE_SELS) {
            const el = await card.$(priceSel);
            priceText = (await el?.textContent()) || '';
            if (priceText.trim()) {
              price = this.extractPrice(priceText);
              if (price && price > 50) break;
            }
          }

          const inclEl = await card.$('[class*="meal"], [class*="inclusion"], [class*="plan"]');
          const inclText = (await inclEl?.textContent())?.toLowerCase() || '';

          if (price && price > 50) {
            const hasRupee = priceText.includes('₹') || priceText.includes('INR');
            const inrPrice = this.normalizeToInr(price, hasRupee);
            if (inrPrice < 500 || inrPrice > 500000) continue;

            const normalized = normalizeTaxInclusive(inrPrice, false);
            const meal = classifyMealPlan(inclText, roomName);
            if (meal.shouldReject) continue;

            rates.push({
              hotelName, roomType: roomName,
              mapRate: meal.isMapEligible ? normalized : null,
              cpRate: meal.plan === 'CP' ? normalized : null,
              epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalized : null,
              taxPercent: 18, taxInclusive: false, totalWithTax: normalized,
              source: this.source, sourceUrl: url, isAvailable: true,
              breakfastIncluded: meal.breakfastIncluded, dinnerIncluded: meal.dinnerIncluded,
              lunchIncluded: meal.lunchIncluded, mealDetails: inclText || undefined,
              freeCancellation: inclText.includes('free cancel'), hasDiscount: false,
              occupancy: 2, scrapedAt: new Date(), confidence: meal.confidence * 0.82,
            });
          }
        } catch { /* skip */ }
      }

      if (rates.length === 0) {
        for (const priceSel of PRICE_SELS) {
          const priceEls = await page.$$(priceSel);
          for (const el of priceEls.slice(0, 5)) {
            const priceText = (await el.textContent()) || '';
            const price = this.extractPrice(priceText);
            if (price && price > 50) {
              const hasRupee = priceText.includes('₹') || priceText.includes('INR');
              const inrPrice = this.normalizeToInr(price, hasRupee);
              if (inrPrice >= 500 && inrPrice <= 500000) {
                rates.push({
                  hotelName, roomType: 'Best Available',
                  mapRate: null, cpRate: null, epRate: normalizeTaxInclusive(inrPrice, false),
                  taxPercent: 18, taxInclusive: false, totalWithTax: normalizeTaxInclusive(inrPrice, false),
                  source: this.source, sourceUrl: url, isAvailable: true,
                  breakfastIncluded: false, dinnerIncluded: false, lunchIncluded: false,
                  freeCancellation: false, hasDiscount: false,
                  occupancy: 2, scrapedAt: new Date(), confidence: 0.50,
                });
                break;
              }
            }
          }
          if (rates.length > 0) break;
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
            occupancy: 2, scrapedAt: new Date(), confidence: 0.40,
          });
        }
      }

      console.log(`[easemytrip] ${hotelName}: extracted ${rates.length} rates`);
    } catch (err) {
      console.error(`[easemytrip] Failed for ${hotelName}:`, (err as Error).message);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
