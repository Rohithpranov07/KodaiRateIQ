// ============================================================
// KodaiRateIQ — Goibibo Scraper
// Root domain (www.goibibo.com/) is TCP-refused from Railway,
// but /hotels/ and /hotels/search/ sub-paths ARE accessible (HTTP 200).
// Uses city search URL and matches hotels by name in results.
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

const HOTEL_MATCH_NAMES: Record<string, string[]> = {
  'The Carlton':               ['carlton', 'the carlton'],
  'The Tamara Kodai':          ['tamara', 'tamara kodai'],
  'Hotel Kodai International': ['kodai international', 'kodai inter'],
  'Sterling Kodai Lake':       ['sterling', 'sterling kodai'],
  'Le Poshe by Sparsa':        ['le poshe', 'poshe'],
};

const CARD_SELS = [
  '[class*="HotelCard"]',
  '[class*="hotelCard"]',
  '[class*="hotel-card"]',
  '[class*="listingCard"]',
  '[class*="propertyCard"]',
  '[data-testid*="hotel"]',
  'li[class*="hotel"]',
  'article[class*="hotel"]',
];

const NAME_SELS = [
  '[class*="hotelName"]',
  '[class*="HotelName"]',
  '[class*="hotel-name"]',
  '[class*="propertyName"]',
  'h2', 'h3', 'h4',
];

const PRICE_SELS = [
  '[class*="price"]',
  '[class*="Price"]',
  '[class*="amount"]',
  '[class*="Amount"]',
  '[class*="tariff"]',
  '[class*="rate"]',
  '[class*="finalPrice"]',
  'strong',
];

const MEAL_SELS = [
  '[class*="meal"]',
  '[class*="Meal"]',
  '[class*="inclusion"]',
  '[class*="plan"]',
  '[class*="board"]',
];

export class GoibiboScraper extends BaseScraper {
  get source(): string { return 'goibibo'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const matchNames = HOTEL_MATCH_NAMES[hotelName];
    if (!matchNames) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      // /hotels/search/ sub-path is accessible (HTTP 200) even though
      // the root www.goibibo.com/ is TCP-refused from Railway
      const url = `https://www.goibibo.com/hotels/search/?q=kodaikanal&checkin=${ci}&checkout=${co}&adults=2&rooms=1`;

      console.log(`[goibibo] navigating city search for ${hotelName}`);
      await this.navigate(page, url);

      const cardSel = CARD_SELS.join(', ');
      const found = await this.waitForSelector(page, cardSel, 20000);
      console.log(`[goibibo] hotel cards visible: ${found}`);

      let allCards: Array<import('playwright').ElementHandle> = [];
      for (const sel of CARD_SELS) {
        const cards = await page.$$(sel);
        if (cards.length > 0) {
          allCards = cards;
          console.log(`[goibibo] selector "${sel}": ${cards.length} cards`);
          break;
        }
      }

      for (const card of allCards) {
        try {
          let cardName = '';
          for (const nameSel of NAME_SELS) {
            const el = await card.$(nameSel);
            const t = (await el?.textContent())?.trim().toLowerCase() || '';
            if (t.length > 2) { cardName = t; break; }
          }

          if (!matchNames.some(n => cardName.includes(n))) continue;
          console.log(`[goibibo] matched "${cardName}" for ${hotelName}`);

          let price: number | null = null;
          let priceText = '';
          for (const priceSel of PRICE_SELS) {
            const el = await card.$(priceSel);
            priceText = (await el?.textContent()) || '';
            if (priceText.trim()) {
              price = this.extractPrice(priceText);
              if (price && price > 100) break;
            }
          }

          let mealText = '';
          for (const mealSel of MEAL_SELS) {
            const el = await card.$(mealSel);
            const t = (await el?.textContent())?.toLowerCase() || '';
            if (t.length > 2) { mealText = t; break; }
          }

          if (price && price > 100) {
            const hasRupee = priceText.includes('₹') || priceText.includes('INR');
            const inrPrice = this.normalizeToInr(price, hasRupee);
            if (inrPrice < 500 || inrPrice > 500_000) continue;

            const normalized = normalizeTaxInclusive(inrPrice, false);
            const meal = classifyMealPlan(mealText, hotelName);
            if (meal.shouldReject) continue;

            rates.push({
              hotelName, roomType: 'Best Available',
              mapRate: meal.isMapEligible ? normalized : null,
              cpRate: meal.plan === 'CP' ? normalized : null,
              epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalized : null,
              taxPercent: 18, taxInclusive: false, totalWithTax: normalized,
              source: this.source, sourceUrl: url, isAvailable: true,
              breakfastIncluded: meal.breakfastIncluded, dinnerIncluded: meal.dinnerIncluded,
              lunchIncluded: meal.lunchIncluded, mealDetails: mealText || undefined,
              freeCancellation: false, hasDiscount: false,
              occupancy: 2, scrapedAt: new Date(), confidence: meal.confidence * 0.85,
            });
            break;
          }
        } catch { /* skip */ }
      }

      if (rates.length === 0) {
        const evalPrices = await this.evaluatePrices(page);
        console.log(`[goibibo] ${hotelName}: text scan found ${evalPrices.length} prices`);
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

      console.log(`[goibibo] ${hotelName}: extracted ${rates.length} rates`);
    } catch (err) {
      console.error(`[goibibo] Failed for ${hotelName}:`, (err as Error).message);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
