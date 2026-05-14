// ============================================================
// KodaiRateIQ — Cleartrip Scraper
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

// Cleartrip hotel slugs return 410 Gone — use city search + name matching instead.
// Partial names used for fuzzy matching within city results.
const HOTEL_MATCH_NAMES: Record<string, string[]> = {
  'The Carlton':               ['carlton', 'the carlton'],
  'The Tamara Kodai':          ['tamara', 'tamara kodai'],
  'Hotel Kodai International': ['kodai international', 'kodai inter'],
  'Sterling Kodai Lake':       ['sterling', 'sterling kodai'],
  'Le Poshe by Sparsa':        ['le poshe', 'poshe'],
};

const ROOM_SELS = [
  '[class*="roomCard"]',
  '[class*="room-card"]',
  '[class*="RoomCard"]',
  '[data-testid*="room"]',
  '[class*="roomRow"]',
  '[class*="room_row"]',
];

const PRICE_SELS = [
  '[class*="finalPrice"]',
  '[class*="totalPrice"]',
  '[class*="price"]',
  '[class*="Price"]',
  '[class*="amount"]',
  'strong[class*="price"]',
];

const MEAL_SELS = [
  '[class*="inclusion"]',
  '[class*="meal"]',
  '[class*="amenity"]',
  '[class*="plan"]',
];

export class CleartripScraper extends BaseScraper {
  get source(): string { return 'cleartrip'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const matchNames = HOTEL_MATCH_NAMES[hotelName];
    if (!matchNames) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      // Use city-level search — direct hotel slugs return 410 Gone
      const url = `https://www.cleartrip.com/hotels/search/?city=Kodaikanal&checkin=${ci}&checkout=${co}&adults=2&rooms=1`;

      console.log(`[cleartrip] navigating city search for ${hotelName}`);
      await this.navigate(page, url);

      for (const skipSel of [
        '[data-testid="skip-login"]',
        'button:has-text("Skip")',
        'button:has-text("Continue")',
        '[class*="skipBtn"]',
      ]) {
        try {
          const btn = page.locator(skipSel).first();
          if (await btn.isVisible({ timeout: 2000 })) { await btn.click(); break; }
        } catch { /* no prompt */ }
      }

      const roomSel = ROOM_SELS.join(', ');
      await this.waitForSelector(page, roomSel, 18000);

      let allCards: Array<import('playwright').ElementHandle> = [];
      for (const sel of ROOM_SELS) {
        const cards = await page.$$(sel);
        if (cards.length > 0) { allCards = cards; break; }
      }

      for (const card of allCards) {
        // Check if this card matches our target hotel
        const cardText = (await card.textContent())?.toLowerCase() || '';
        if (!matchNames.some(n => cardText.includes(n))) continue;
        try {
          const nameEl = await card.$('[class*="roomName"], [class*="RoomName"], h3, h4, [class*="name"]');
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

          let inclText = '';
          for (const mealSel of MEAL_SELS) {
            const el = await card.$(mealSel);
            const t = (await el?.textContent())?.toLowerCase() || '';
            if (t.length > 2) { inclText = t; break; }
          }

          if (price && price > 50) {
            const hasRupee = priceText.includes('₹') || priceText.includes('INR');
            const inrPrice = this.normalizeToInr(price, hasRupee);
            if (inrPrice < 500 || inrPrice > 500000) continue;

            const taxIncl = inclText.includes('incl') || inclText.includes('taxes') || priceText.includes('incl');
            const normalized = normalizeTaxInclusive(inrPrice, taxIncl);
            const meal = classifyMealPlan(inclText, roomName);
            if (meal.shouldReject) continue;

            rates.push({
              hotelName, roomType: roomName,
              mapRate: meal.isMapEligible ? normalized : null,
              cpRate: meal.plan === 'CP' ? normalized : null,
              epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalized : null,
              taxPercent: 18, taxInclusive: taxIncl, totalWithTax: normalized,
              source: this.source, sourceUrl: url, isAvailable: true,
              breakfastIncluded: meal.breakfastIncluded, dinnerIncluded: meal.dinnerIncluded,
              lunchIncluded: meal.lunchIncluded, mealDetails: inclText || undefined,
              freeCancellation: inclText.includes('free cancel'), hasDiscount: false,
              occupancy: 2, scrapedAt: new Date(), confidence: meal.confidence * 0.85,
            });
          }
        } catch { /* skip */ }
      }

      if (rates.length === 0) {
        const priceSel = PRICE_SELS.join(', ');
        const el = await page.$(priceSel);
        const priceText = (await el?.textContent()) || '';
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

      console.log(`[cleartrip] ${hotelName}: extracted ${rates.length} rates`);
    } catch (err) {
      console.error(`[cleartrip] Failed for ${hotelName}:`, (err as Error).message);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
