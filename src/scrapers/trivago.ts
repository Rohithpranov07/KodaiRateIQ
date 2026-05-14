// ============================================================
// KodaiRateIQ — Trivago Meta-Search Scraper
// City search URL confirmed HTTP 200.
// Matches hotels by name in search results.
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

const HOTEL_MATCH_NAMES: Record<string, string[]> = {
  'The Carlton':               ['carlton', 'the carlton'],
  'The Tamara Kodai':          ['tamara', 'tamara kodai'],
  'Hotel Kodai International': ['kodai international', 'kodai inter'],
  'Sterling Kodai Lake':       ['sterling', 'sterling kodai'],
  'Le Poshe by Sparsa':        ['le poshe', 'poshe'],
};

const CARD_SELS = [
  '[data-qa="itemlist-element"]',
  '[class*="itemlist-element"]',
  '[class*="ItemList__element"]',
  '[class*="PropertyCard"]',
  '[class*="property-card"]',
  'li[class*="hotel"]',
  'article[class*="hotel"]',
];

const NAME_SELS = [
  '[data-qa="hotel-name"]',
  '[class*="HotelName"]',
  '[class*="hotel-name"]',
  '[class*="PropertyName"]',
  'h2', 'h3', 'h4',
];

const PRICE_SELS = [
  '[data-qa="display-price"]',
  '[class*="price__value"]',
  '[class*="best-price"]',
  '[class*="deal-price"]',
  '[class*="price-value"]',
  '[class*="price"]',
  'strong',
];

export class TrivagoScraper extends BaseScraper {
  get source(): string { return 'trivago'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const matchNames = HOTEL_MATCH_NAMES[hotelName];
    if (!matchNames) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      // Trivago city search — HTTP 200 confirmed from curl
      const url =
        `https://www.trivago.in/en-IN/lm/hotel-search` +
        `?search%5Bcheckin%5D=${ci}&search%5Bcheckout%5D=${co}` +
        `&search%5BiPersonAmountAdults%5D=2&search%5BiRoomAmount%5D=1` +
        `&search%5Bquery%5D=Kodaikanal+India`;

      console.log(`[trivago] navigating city search for ${hotelName}`);
      await this.navigate(page, url);

      // Cookie consent
      for (const sel of [
        '[data-qa="consent-accept-button"]',
        'button:has-text("Accept")',
        'button:has-text("I accept")',
      ]) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 2000 })) { await btn.click(); break; }
        } catch { /* no banner */ }
      }

      const cardSel = CARD_SELS.join(', ');
      const found = await this.waitForSelector(page, cardSel, 20000);
      console.log(`[trivago] hotel cards visible: ${found}`);

      let allCards: Array<import('playwright').ElementHandle> = [];
      for (const sel of CARD_SELS) {
        const cards = await page.$$(sel);
        if (cards.length > 0) {
          allCards = cards;
          console.log(`[trivago] selector "${sel}": ${cards.length} cards`);
          break;
        }
      }

      for (const card of allCards.slice(0, 15)) {
        try {
          let cardName = '';
          for (const nameSel of NAME_SELS) {
            const el = await card.$(nameSel);
            const t = (await el?.textContent())?.trim().toLowerCase() || '';
            if (t.length > 2) { cardName = t; break; }
          }

          if (!matchNames.some(n => cardName.includes(n))) continue;
          console.log(`[trivago] matched "${cardName}" for ${hotelName}`);

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

          const inclEl = await card.$('[class*="deal-tag"], [class*="info-tag"], [class*="inclusion"]');
          const inclText = (await inclEl?.textContent())?.toLowerCase() || '';

          const srcEl = await card.$('[class*="advertiser-name"], [data-qa="advertiser"]');
          const srcName = (await srcEl?.textContent())?.trim().toLowerCase() || 'partner';

          if (price && price > 50) {
            const hasRupee = priceText.includes('₹') || priceText.includes('INR');
            const inrPrice = this.normalizeToInr(price, hasRupee);
            if (inrPrice < 500 || inrPrice > 500_000) continue;

            const meal = classifyMealPlan(inclText);
            if (meal.shouldReject) continue;

            rates.push({
              hotelName, roomType: 'Best Available',
              mapRate: meal.isMapEligible ? inrPrice : null,
              cpRate: meal.plan === 'CP' ? inrPrice : null,
              epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? inrPrice : null,
              taxPercent: 18, taxInclusive: true, totalWithTax: inrPrice,
              source: `trivago/${srcName}`, sourceUrl: url, isAvailable: true,
              breakfastIncluded: meal.breakfastIncluded, dinnerIncluded: meal.dinnerIncluded,
              lunchIncluded: meal.lunchIncluded, mealDetails: inclText || undefined,
              freeCancellation: inclText.includes('free cancel'), hasDiscount: false,
              occupancy: 2, scrapedAt: new Date(), confidence: meal.confidence * 0.75,
            });
            break;
          }
        } catch { /* skip */ }
      }

      if (rates.length === 0) {
        const evalPrices = await this.evaluatePrices(page);
        console.log(`[trivago] ${hotelName}: text scan found ${evalPrices.length} prices`);
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

      console.log(`[trivago] ${hotelName}: extracted ${rates.length} rates`);
    } catch (err) {
      console.error(`[trivago] Failed for ${hotelName}:`, (err as Error).message);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
