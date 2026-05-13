// ============================================================
// KodaiRateIQ — Yatra Hotels Scraper
// Fixed: both ci and co now formatted in YYYYMMDD.
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

const YATRA_PATHS: Record<string, string> = {
  'The Carlton':               'hotels/india/kodaikanal/the-carlton',
  'The Tamara Kodai':          'hotels/india/kodaikanal/the-tamara-kodaikanal',
  'Hotel Kodai International': 'hotels/india/kodaikanal/hotel-kodai-international',
  'Sterling Kodai Lake':       'hotels/india/kodaikanal/sterling-kodai-lake',
  'Le Poshe by Sparsa':        'hotels/india/kodaikanal/le-poshe-by-sparsa',
};

const ROOM_SELS = [
  '[class*="room-option"]',
  '[class*="roomOption"]',
  '[id*="room"]',
  '[class*="roomCard"]',
  '[class*="room-card"]',
  '[class*="RoomCard"]',
];

const PRICE_SELS = [
  '[class*="price"]',
  '[class*="amount"]',
  '[class*="tariff"]',
  '[class*="rate"]',
  'strong',
];

export class YatraScraper extends BaseScraper {
  get source(): string { return 'yatra'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const hotelPath = YATRA_PATHS[hotelName];
    if (!hotelPath) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      // FIXED: both dates must be YYYYMMDD — was using wrong variable `co` before
      const ci = this.formatDate(checkIn).replace(/-/g, '');
      const co = this.formatDate(checkOut).replace(/-/g, '');

      const url = `https://www.yatra.com/${hotelPath}?checkin=${ci}&checkout=${co}&rooms=1&adults=2`;

      console.log(`[yatra] navigating hotel=${hotelName}`);
      await this.navigate(page, url);

      for (const skipSel of [
        '[class*="skip"]',
        'button:has-text("Continue")',
        'button:has-text("Skip")',
        '[class*="close"]',
      ]) {
        try {
          const btn = page.locator(skipSel).first();
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
          const nameEl = await card.$('[class*="room-type"], [class*="roomType"], h3, h4, [class*="name"]');
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

          const inclEl = await card.$('[class*="meal"], [class*="inclusion"], [class*="plan-type"]');
          const inclText = (await inclEl?.textContent())?.toLowerCase() || '';

          if (price && price > 50) {
            const hasRupee = priceText.includes('₹') || priceText.includes('INR');
            const inrPrice = this.normalizeToInr(price, hasRupee);
            if (inrPrice < 500 || inrPrice > 500000) continue;

            const taxInclusive = priceText.toLowerCase().includes('incl');
            const normalized = normalizeTaxInclusive(inrPrice, taxInclusive);
            const meal = classifyMealPlan(inclText, roomName);
            if (meal.shouldReject) continue;

            rates.push({
              hotelName, roomType: roomName,
              mapRate: meal.isMapEligible ? normalized : null,
              cpRate: meal.plan === 'CP' ? normalized : null,
              epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalized : null,
              taxPercent: 18, taxInclusive: taxInclusive, totalWithTax: normalized,
              source: this.source, sourceUrl: url, isAvailable: true,
              breakfastIncluded: meal.breakfastIncluded, dinnerIncluded: meal.dinnerIncluded,
              lunchIncluded: meal.lunchIncluded, mealDetails: inclText || undefined,
              freeCancellation: inclText.includes('free cancel'), hasDiscount: false,
              occupancy: 2, scrapedAt: new Date(), confidence: meal.confidence * 0.80,
            });
          }
        } catch { /* skip */ }
      }

      if (rates.length === 0) {
        const priceEl = await page.$('[class*="hotel-price"], [class*="total-price"]');
        const priceText = (await priceEl?.textContent()) || '';
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
            occupancy: 2, scrapedAt: new Date(), confidence: 0.40,
          });
        }
      }

      console.log(`[yatra] ${hotelName}: extracted ${rates.length} rates`);
    } catch (err) {
      console.error(`[yatra] Failed for ${hotelName}:`, (err as Error).message);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
