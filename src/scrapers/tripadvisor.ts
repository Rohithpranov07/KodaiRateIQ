// ============================================================
// KodaiRateIQ — Tripadvisor Hotels Scraper
// TripAdvisor IDs are stable numeric geo+detail codes.
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

const TRIPADVISOR_IDS: Record<string, string> = {
  'The Carlton':               'g659765-d302074',
  'The Tamara Kodai':          'g659765-d12438049',
  'Hotel Kodai International': 'g659765-d495614',
  'Sterling Kodai Lake':       'g659765-d3277695',
  'Le Poshe by Sparsa':        'g659765-d12868342',
};

const OFFER_SELS = [
  '[data-automation="hotel-offer"]',
  '[data-automation="hotel-offers-list"] li',
  '[class*="offer-item"]',
  '[class*="OfferItem"]',
  '[class*="partnerOffer"]',
  '[class*="offerRow"]',
];

const PRICE_SELS = [
  '[data-automation="offer-price"]',
  '[class*="offer-price"]',
  '[class*="offerPrice"]',
  '[data-automation="property-price"]',
  '[class*="price"]',
  'span[class*="price"]',
  'div[class*="price"]',
];

export class TripadvisorScraper extends BaseScraper {
  get source(): string { return 'tripadvisor'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const id = TRIPADVISOR_IDS[hotelName];
    if (!id) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      // Use .in domain for India-specific results and better INR pricing
      const url = `https://www.tripadvisor.in/Hotel_Review-${id}-Reviews.html?checkin=${ci}&checkout=${co}&adults=2`;

      console.log(`[tripadvisor] navigating hotel=${hotelName}`);
      await this.navigate(page, url);

      // Dismiss overlays / cookie consent
      for (const closeSel of [
        '[class*="dismiss"]',
        '[aria-label="Close"]',
        'button[class*="close"]',
        '#onetrust-accept-btn-handler',
      ]) {
        try {
          const btn = page.locator(closeSel).first();
          if (await btn.isVisible({ timeout: 1500 })) { await btn.click(); break; }
        } catch { /* none */ }
      }

      // Wait for offer/price widgets to render
      const offerSel = OFFER_SELS.join(', ');
      await this.waitForSelector(page, offerSel, 20000);

      // Try structured offer cards
      let offerCards: Array<import('playwright').ElementHandle> = [];
      for (const sel of OFFER_SELS) {
        const cards = await page.$$(sel);
        if (cards.length > 0) { offerCards = cards; break; }
      }

      for (const card of offerCards.slice(0, 8)) {
        try {
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

          const partnerEl = await card.$('[data-automation="offer-provider"], [class*="provider"], [class*="partner"]');
          const partnerName = (await partnerEl?.textContent())?.trim().toLowerCase() || 'partner';

          const inclEl = await card.$('[data-automation="offer-inclusions"], [class*="inclusion"]');
          const inclText = (await inclEl?.textContent())?.toLowerCase() || '';

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
              source: `tripadvisor/${partnerName || 'partner'}`,
              sourceUrl: url, isAvailable: true,
              breakfastIncluded: meal.breakfastIncluded, dinnerIncluded: meal.dinnerIncluded,
              lunchIncluded: meal.lunchIncluded, mealDetails: inclText || undefined,
              freeCancellation: inclText.includes('free cancel'), hasDiscount: false,
              occupancy: 2, scrapedAt: new Date(), confidence: meal.confidence * 0.78,
            });
          }
        } catch { /* skip */ }
      }

      // Fallback: generic price scan across the page
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
                  mapRate: null, cpRate: null, epRate: inrPrice,
                  taxPercent: 18, taxInclusive: true, totalWithTax: inrPrice,
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

      console.log(`[tripadvisor] ${hotelName}: extracted ${rates.length} rates`);
    } catch (err) {
      console.error(`[tripadvisor] Failed for ${hotelName}:`, (err as Error).message);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
