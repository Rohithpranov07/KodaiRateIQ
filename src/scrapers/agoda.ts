// ============================================================
// KodaiRateIQ — Agoda Scraper
// Correct URL: /city/kodaikanal-in.html (HTTP 200 confirmed).
// Direct hotel slugs and /search?city= all returned 404/empty.
// Matches hotels by name within city results.
// Forces INR via currency param.
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
  '[data-selenium="hotel-item"]',
  '[data-element-name="hotel-card"]',
  '[class*="PropertyCard"]',
  '[class*="HotelCard"]',
  '[class*="hotel-card"]',
  '[class*="hotel-item"]',
  'li[data-testid*="hotel"]',
  'article[class*="hotel"]',
];

const NAME_SELS = [
  '[data-selenium="hotel-name"]',
  '[data-element-name="hotel-name"]',
  '[class*="PropertyName"]',
  '[class*="HotelName"]',
  '[class*="hotelName"]',
  'h3', 'h2', 'h4',
];

const PRICE_SELS = [
  '[data-selenium="PriceDisplay"]',
  '[data-element-name="final-price"]',
  '[class*="priceValue"]',
  '[class*="PriceValue"]',
  '[class*="final-price"]',
  '[class*="price-display"]',
  '[class*="price"]',
  '[class*="Price"]',
];

const MEAL_SELS = [
  '[class*="inclusion"]',
  '[class*="benefit"]',
  '[class*="meal"]',
  '[class*="Meal"]',
  '[class*="BoardType"]',
];

export class AgodaScraper extends BaseScraper {
  get source(): string { return 'agoda'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const matchNames = HOTEL_MATCH_NAMES[hotelName];
    if (!matchNames) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      // Confirmed HTTP 200. Slug-based and /search?city= all returned 404.
      const url =
        `https://www.agoda.com/city/kodaikanal-in.html` +
        `?checkIn=${ci}&checkOut=${co}&rooms=1&adults=2&children=0` +
        `&currency=INR&selectedcurrency=INR`;

      console.log(`[agoda] navigating city page for ${hotelName}`);
      await this.navigate(page, url);

      // Dismiss cookie consent
      for (const sel of [
        '[data-selenium="cookie-consent-accept-btn"]',
        '#consent-btn',
        'button:has-text("Accept")',
      ]) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 2000 })) { await btn.click(); await page.waitForTimeout(800); break; }
        } catch { /* no banner */ }
      }

      const cardSel = CARD_SELS.join(', ');
      const found = await this.waitForSelector(page, cardSel, 20000);
      console.log(`[agoda] hotel cards visible: ${found}`);

      let allCards: Array<import('playwright').ElementHandle> = [];
      for (const sel of CARD_SELS) {
        const cards = await page.$$(sel);
        if (cards.length > 0) {
          allCards = cards;
          console.log(`[agoda] selector "${sel}": ${cards.length} cards`);
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
          console.log(`[agoda] matched "${cardName}" for ${hotelName}`);

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

          let mealText = '';
          for (const mealSel of MEAL_SELS) {
            const el = await card.$(mealSel);
            const t = (await el?.textContent())?.toLowerCase() || '';
            if (t.length > 2) { mealText = t; break; }
          }

          if (price && price > 50) {
            const hasRupee = priceText.includes('₹') || priceText.includes('INR');
            const inrPrice = this.normalizeToInr(price, hasRupee);
            if (inrPrice < 500 || inrPrice > 500_000) continue;

            const normalized = normalizeTaxInclusive(inrPrice, true);
            const meal = classifyMealPlan(mealText, hotelName);
            if (meal.shouldReject) continue;

            rates.push({
              hotelName, roomType: 'Best Available',
              mapRate: meal.isMapEligible ? normalized : null,
              cpRate: meal.plan === 'CP' ? normalized : null,
              epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalized : null,
              taxPercent: 18, taxInclusive: true, totalWithTax: inrPrice,
              source: this.source, sourceUrl: url, isAvailable: true,
              breakfastIncluded: meal.breakfastIncluded, dinnerIncluded: meal.dinnerIncluded,
              lunchIncluded: meal.lunchIncluded, mealDetails: mealText || undefined,
              freeCancellation: mealText.includes('free cancel'), hasDiscount: false,
              occupancy: 2, scrapedAt: new Date(), confidence: meal.confidence * 0.88,
            });
            break;
          }
        } catch { /* skip */ }
      }

      if (rates.length === 0) {
        const evalPrices = await this.evaluatePrices(page);
        console.log(`[agoda] ${hotelName}: text scan found ${evalPrices.length} prices`);
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

      console.log(`[agoda] ${hotelName}: extracted ${rates.length} rates`);
    } catch (err) {
      console.error(`[agoda] Failed for ${hotelName}:`, (err as Error).message);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
