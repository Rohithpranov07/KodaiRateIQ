// ============================================================
// KodaiRateIQ — Trivago Meta-Search Scraper
// Uses search-based URL — prior numeric IDs were placeholders.
// Matches hotels by name in search results.
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

// Partial names for fuzzy matching in Trivago search results
const HOTEL_MATCH_NAMES: Record<string, string[]> = {
  'The Carlton':               ['carlton', 'the carlton'],
  'The Tamara Kodai':          ['tamara', 'tamara kodai'],
  'Hotel Kodai International': ['kodai international', 'kodai inter'],
  'Sterling Kodai Lake':       ['sterling', 'sterling kodai'],
  'Le Poshe by Sparsa':        ['le poshe', 'poshe'],
};

const DEAL_SELS = [
  '[data-qa="itemlist-element"]',
  '[class*="itemlist-element"]',
  '[class*="ItemList__element"]',
  'li[class*="hotel"]',
  'article[class*="hotel"]',
  '[class*="property-card"]',
  '[class*="PropertyCard"]',
];

const HOTEL_NAME_SELS = [
  '[data-qa="hotel-name"]',
  '[class*="HotelName"]',
  '[class*="hotel-name"]',
  'h2', 'h3', 'h4',
  '[class*="title"]',
];

const PRICE_SELS = [
  '[data-qa="display-price"]',
  '[class*="price__value"]',
  '[class*="best-price"]',
  '[class*="price-value"]',
  '[class*="deal-price"]',
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

      // Search Trivago for the specific hotel in Kodaikanal
      const query = encodeURIComponent(`${hotelName} Kodaikanal`);
      const url =
        `https://www.trivago.in/en-IN/lm/hotel-price-comparison` +
        `?search%5Bcheckin%5D=${ci}&search%5Bcheckout%5D=${co}` +
        `&search%5BiPersonAmountAdults%5D=2&search%5BiRoomAmount%5D=1` +
        `&search%5Bquery%5D=${query}&search%5BiGeoDistanceLimit%5D=50000`;

      console.log(`[trivago] navigating search for ${hotelName}`);
      await this.navigate(page, url);

      // Cookie consent
      for (const consentSel of [
        '[data-qa="consent-accept-button"]',
        'button:has-text("Accept")',
        'button:has-text("I accept")',
      ]) {
        try {
          const btn = page.locator(consentSel).first();
          if (await btn.isVisible({ timeout: 2000 })) { await btn.click(); break; }
        } catch { /* no banner */ }
      }

      const dealSel = DEAL_SELS.join(', ');
      await this.waitForSelector(page, dealSel, 20000);

      let allDeals: Array<import('playwright').ElementHandle> = [];
      for (const sel of DEAL_SELS) {
        const deals = await page.$$(sel);
        if (deals.length > 0) { allDeals = deals; break; }
      }

      for (const deal of allDeals.slice(0, 10)) {
        try {
          let cardName = '';
          for (const nameSel of HOTEL_NAME_SELS) {
            const el = await deal.$(nameSel);
            const t = (await el?.textContent())?.trim().toLowerCase() || '';
            if (t.length > 3) { cardName = t; break; }
          }

          const isMatch = matchNames.some(n => cardName.includes(n));
          if (!isMatch) continue;

          console.log(`[trivago] matched deal card: "${cardName}" for ${hotelName}`);

          let price: number | null = null;
          let priceText = '';
          for (const priceSel of PRICE_SELS) {
            const el = await deal.$(priceSel);
            priceText = (await el?.textContent()) || '';
            if (priceText.trim()) {
              price = this.extractPrice(priceText);
              if (price && price > 50) break;
            }
          }

          const inclEl = await deal.$('[class*="deal-tag"], [class*="info-tag"], [class*="inclusion"]');
          const inclText = (await inclEl?.textContent())?.toLowerCase() || '';

          const sourceEl = await deal.$('[class*="advertiser-name"], [data-qa="advertiser"], [class*="partner"]');
          const sourceName = (await sourceEl?.textContent())?.trim().toLowerCase() || 'partner';

          if (price && price > 50) {
            const hasRupee = priceText.includes('₹') || priceText.includes('INR');
            const inrPrice = this.normalizeToInr(price, hasRupee);
            if (inrPrice < 500 || inrPrice > 500000) continue;

            const meal = classifyMealPlan(inclText);
            if (meal.shouldReject) continue;

            rates.push({
              hotelName, roomType: 'Best Available',
              mapRate: meal.isMapEligible ? inrPrice : null,
              cpRate: meal.plan === 'CP' ? inrPrice : null,
              epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? inrPrice : null,
              taxPercent: 18, taxInclusive: true, totalWithTax: inrPrice,
              source: `trivago/${sourceName}`, sourceUrl: url, isAvailable: true,
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
