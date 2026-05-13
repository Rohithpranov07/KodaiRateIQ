// ============================================================
// KodaiRateIQ — Tripadvisor Hotels Scraper
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

const TRIPADVISOR_IDS: Record<string, string> = {
  'The Carlton':               'g659765-d302074',
  'The Tamara Kodai':          'g659765-d12438049',
  'Hotel Kodai International': 'g659765-d495614',
  'Sterling Kodai Lake':       'g659765-d3277695',
  'Le Poshe by Sparsa':        'g659765-d12868342',
};

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

      const url = `https://www.tripadvisor.in/Hotel_Review-${id}-Reviews.html?checkin=${ci}&checkout=${co}&adults=2`;

      await this.navigate(page, url);

      // Dismiss overlays
      try {
        const closeBtn = page.locator('[class*="dismiss"], [aria-label="Close"]').first();
        if (await closeBtn.isVisible({ timeout: 2000 })) await closeBtn.click();
      } catch { /* none */ }

      // Tripadvisor shows partner prices in a "Check availability" panel
      const partnerCards = await page.$$('[data-automation="hotel-offers-list"] [data-automation="hotel-offer"]');

      for (const card of partnerCards) {
        try {
          const priceEl = await card.$('[data-automation="offer-price"]');
          const priceText = await priceEl?.textContent();
          const price = this.extractPrice(priceText || '');

          const partnerEl = await card.$('[data-automation="offer-provider"]');
          const partnerName = (await partnerEl?.textContent())?.trim().toLowerCase() || '';

          const inclEl = await card.$('[data-automation="offer-inclusions"]');
          const inclText = (await inclEl?.textContent())?.toLowerCase() || '';

          if (price && price > 1000) {
            const meal = classifyMealPlan(inclText);
            if (meal.shouldReject) continue;

            // Tripadvisor typically shows tax-inclusive prices
            rates.push({
              hotelName,
              roomType: 'Best Available',
              mapRate: meal.isMapEligible ? price : null,
              cpRate: meal.plan === 'CP' ? price : null,
              epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? price : null,
              taxPercent: 18,
              taxInclusive: true,
              totalWithTax: price,
              source: `tripadvisor/${partnerName || 'partner'}`,
              sourceUrl: url,
              isAvailable: true,
              breakfastIncluded: meal.breakfastIncluded,
              dinnerIncluded: meal.dinnerIncluded,
              lunchIncluded: meal.lunchIncluded,
              mealDetails: inclText || undefined,
              freeCancellation: inclText.includes('free cancel'),
              hasDiscount: false,
              occupancy: 2,
              scrapedAt: new Date(),
              confidence: meal.confidence * 0.78,
            });
          }
        } catch { /* skip */ }
      }

      // Fallback: look for "from" price on main page
      if (rates.length === 0) {
        const priceEl = await page.$('[data-automation="property-price"]');
        const price = this.extractPrice((await priceEl?.textContent()) || '');
        if (price && price > 1000) {
          rates.push({
            hotelName, roomType: 'Best Available',
            mapRate: null, cpRate: null, epRate: price,
            taxPercent: 18, taxInclusive: true, totalWithTax: price,
            source: this.source, sourceUrl: url, isAvailable: true,
            breakfastIncluded: false, dinnerIncluded: false, lunchIncluded: false,
            freeCancellation: false, hasDiscount: false,
            occupancy: 2, scrapedAt: new Date(), confidence: 0.55,
          });
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
            occupancy: 2, scrapedAt: new Date(), confidence: 0.45,
          });
        }
      }
    } catch (err) {
      console.error(`[tripadvisor] Failed for ${hotelName}:`, err);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
