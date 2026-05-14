// ============================================================
// KodaiRateIQ — Agoda Scraper
// All direct hotel slugs and property ID URLs return 404 from
// non-India IPs. Uses Agoda city search (city=8279 = Kodaikanal)
// and matches hotels by name within results.
// Currency forced to INR via selectedCurrencyCode param.
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

// Agoda city ID 8279 = Kodaikanal, Tamil Nadu, India
const AGODA_KODAIKANAL_CITY_ID = '8279';

const HOTEL_MATCH_NAMES: Record<string, string[]> = {
  'The Carlton':               ['carlton', 'the carlton'],
  'The Tamara Kodai':          ['tamara', 'tamara kodai'],
  'Hotel Kodai International': ['kodai international', 'kodai inter'],
  'Sterling Kodai Lake':       ['sterling', 'sterling kodai'],
  'Le Poshe by Sparsa':        ['le poshe', 'poshe'],
};

const HOTEL_CARD_SELS = [
  '[data-selenium="hotel-item"]',
  '[data-element-name="hotel-card"]',
  '[class*="PropertyCard"]',
  '[class*="hotel-list-item"]',
  '[class*="HotelCard"]',
  '[class*="hotel-card"]',
  'li[data-testid*="hotel"]',
  'article[class*="hotel"]',
];

const HOTEL_NAME_SELS = [
  '[data-selenium="hotel-name"]',
  '[data-element-name="hotel-name"]',
  '[class*="PropertyName"]',
  '[class*="hotelName"]',
  '[class*="HotelName"]',
  'h3', 'h4', 'h2',
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
    if (!matchNames) {
      console.warn(`[agoda] No match config for: ${hotelName}`);
      return [];
    }

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      // City search — direct hotel slug URLs all return 404 from non-India IPs
      const url =
        `https://www.agoda.com/search` +
        `?city=${AGODA_KODAIKANAL_CITY_ID}` +
        `&checkIn=${ci}&checkOut=${co}` +
        `&rooms=1&adults=2&children=0` +
        `&currency=INR&selectedcurrency=INR`;

      console.log(`[agoda] navigating city search for ${hotelName}`);
      await this.navigate(page, url);

      // Cookie consent
      for (const consentSel of [
        '[data-selenium="cookie-consent-accept-btn"]',
        '#consent-btn',
        'button:has-text("Accept")',
        '[class*="CookieConsent"] button',
      ]) {
        try {
          const btn = page.locator(consentSel).first();
          if (await btn.isVisible({ timeout: 2000 })) {
            await btn.click();
            await page.waitForTimeout(800);
            break;
          }
        } catch { /* no banner */ }
      }

      // Wait for hotel cards to render
      const cardSel = HOTEL_CARD_SELS.join(', ');
      await this.waitForSelector(page, cardSel, 20000);

      let allCards: Array<import('playwright').ElementHandle> = [];
      for (const sel of HOTEL_CARD_SELS) {
        const cards = await page.$$(sel);
        if (cards.length > 0) {
          allCards = cards;
          console.log(`[agoda] selector "${sel}": ${cards.length} hotel cards`);
          break;
        }
      }

      for (const card of allCards) {
        try {
          // Match hotel by name
          let cardName = '';
          for (const nameSel of HOTEL_NAME_SELS) {
            const el = await card.$(nameSel);
            const t = (await el?.textContent())?.trim().toLowerCase() || '';
            if (t.length > 2) { cardName = t; break; }
          }

          const isMatch = matchNames.some(n => cardName.includes(n));
          if (!isMatch) continue;

          console.log(`[agoda] matched card: "${cardName}" for ${hotelName}`);

          // Extract price
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

          // Extract meal plan
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
        } catch { /* skip malformed card */ }
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
