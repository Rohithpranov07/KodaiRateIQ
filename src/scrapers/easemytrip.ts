// ============================================================
// KodaiRateIQ — EaseMyTrip Scraper
// Correct base: www.easemytrip.com (hotels.easemytrip.com → 301)
// City slug URL: /hotels/hotels-in-kodaikanal/ (HTTP 200 confirmed)
// Matches hotels by name within city listing.
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
  '[class*="hotel-card"]',
  '[class*="hotelCard"]',
  '[class*="HotelCard"]',
  '[class*="roomBox"]',
  '[class*="listing-item"]',
  '[class*="listingItem"]',
  'li[class*="hotel"]',
  'article[class*="hotel"]',
  '[data-testid*="hotel"]',
];

const NAME_SELS = [
  '[class*="hotelName"]',
  '[class*="hotel-name"]',
  '[class*="HotelName"]',
  '[class*="propertyName"]',
  'h2', 'h3', 'h4',
];

const PRICE_SELS = [
  '[class*="price"]',
  '[class*="Price"]',
  '[class*="amount"]',
  '[class*="Amount"]',
  '[class*="rate"]',
  '[class*="tariff"]',
  'strong',
];

export class EaseMyTripScraper extends BaseScraper {
  get source(): string { return 'easemytrip'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const matchNames = HOTEL_MATCH_NAMES[hotelName];
    if (!matchNames) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      // www.easemytrip.com/hotels/hotels-in-kodaikanal/ = HTTP 200 confirmed.
      // hotels.easemytrip.com redirects → all endpoints there returned 404.
      const url = `https://www.easemytrip.com/hotels/hotels-in-kodaikanal/?checkin=${ci}&checkout=${co}&rooms=1&adults=2`;

      console.log(`[easemytrip] navigating city page for ${hotelName}`);
      await this.navigate(page, url);

      // Dismiss modal/popup
      for (const sel of [
        '[class*="close-btn"]',
        '[class*="closeBtn"]',
        '[aria-label="Close"]',
        'button:has-text("×")',
      ]) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 1500 })) { await btn.click(); break; }
        } catch { /* none */ }
      }

      const cardSel = CARD_SELS.join(', ');
      const found = await this.waitForSelector(page, cardSel, 18000);
      console.log(`[easemytrip] hotel cards visible: ${found}`);

      let allCards: Array<import('playwright').ElementHandle> = [];
      for (const sel of CARD_SELS) {
        const cards = await page.$$(sel);
        if (cards.length > 0) {
          allCards = cards;
          console.log(`[easemytrip] selector "${sel}": ${cards.length} cards`);
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
          console.log(`[easemytrip] matched "${cardName}" for ${hotelName}`);

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

          const inclEl = await card.$('[class*="meal"], [class*="inclusion"], [class*="plan"]');
          const inclText = (await inclEl?.textContent())?.toLowerCase() || '';

          if (price && price > 100) {
            const hasRupee = priceText.includes('₹') || priceText.includes('INR');
            const inrPrice = this.normalizeToInr(price, hasRupee);
            if (inrPrice < 500 || inrPrice > 500_000) continue;

            const normalized = normalizeTaxInclusive(inrPrice, false);
            const meal = classifyMealPlan(inclText, hotelName);
            if (meal.shouldReject) continue;

            rates.push({
              hotelName, roomType: 'Best Available',
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
            break;
          }
        } catch { /* skip */ }
      }

      if (rates.length === 0) {
        const evalPrices = await this.evaluatePrices(page);
        console.log(`[easemytrip] ${hotelName}: text scan found ${evalPrices.length} prices`);
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
