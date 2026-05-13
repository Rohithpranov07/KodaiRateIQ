// ============================================================
// KodaiRateIQ — Booking.com Scraper (v2 — MAP Classifier)
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

const BOOKING_SLUGS: Record<string, string> = {
  'The Carlton':               'hotel/in/the-carlton-kodaikanal.en-gb',
  'The Tamara Kodai':          'hotel/in/the-tamara-kodaikanal.en-gb',
  'Hotel Kodai International': 'hotel/in/kodai-international.en-gb',
  'Sterling Kodai Lake':       'hotel/in/sterling-kodai-lake.en-gb',
  'Le Poshe by Sparsa':        'hotel/in/le-poshe-by-sparsa.en-gb',
};

export class BookingScraper extends BaseScraper {
  get source(): string { return 'booking.com'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const slug = BOOKING_SLUGS[hotelName];
    if (!slug) {
      console.warn(`[booking.com] No slug for: ${hotelName}`);
      return [];
    }

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);
      const url = `https://www.booking.com/${slug}?checkin=${ci}&checkout=${co}&group_adults=2&no_rooms=1&group_children=0`;

      await this.navigate(page, url);

      // Cookie consent
      try {
        const cookieBtn = page.locator('[id="onetrust-accept-btn-handler"]');
        if (await cookieBtn.isVisible({ timeout: 2000 })) {
          await cookieBtn.click();
          await page.waitForTimeout(1000);
        }
      } catch { /* no cookie banner */ }

      await page.waitForSelector('[data-testid="property-section--content"]', { timeout: 15000 }).catch(() => null);

      // Primary: room table rows
      const roomRows = await page.$$('[data-testid="property-section--content"] table tbody tr, .hprt-table tr');

      if (roomRows.length > 0) {
        for (const row of roomRows) {
          try {
            const roomNameEl = await row.$('.hprt-roomtype-icon-link, [data-testid="room-type"]');
            const roomName = (await roomNameEl?.textContent())?.trim() || 'Standard Room';

            const priceEl = await row.$('.bui-price-display__value, .prco-valign-middle-helper');
            const priceText = await priceEl?.textContent();
            const price = this.extractPrice(priceText || '');

            const mealEl = await row.$('.hprt-roomtype-meal, [data-testid="inclusion"]');
            const mealText = (await mealEl?.textContent())?.toLowerCase() || '';

            const cancelEl = await row.$('.hprt-roomtype-cancellation');
            const cancelText = (await cancelEl?.textContent())?.trim() || '';

            if (price && price > 1000) {
              const meal = classifyMealPlan(mealText, roomName);
              if (meal.shouldReject) continue;

              // Booking.com typically shows tax-inclusive for INR
              rates.push({
                hotelName,
                roomType: roomName,
                mapRate: meal.isMapEligible ? normalizeTaxInclusive(price, true) : null,
                cpRate: meal.plan === 'CP' ? normalizeTaxInclusive(price, true) : null,
                epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalizeTaxInclusive(price, true) : null,
                taxPercent: 18,
                taxInclusive: true,
                totalWithTax: price,
                source: this.source,
                sourceUrl: url,
                isAvailable: true,
                breakfastIncluded: meal.breakfastIncluded,
                dinnerIncluded: meal.dinnerIncluded,
                lunchIncluded: meal.lunchIncluded,
                mealDetails: mealText || undefined,
                cancellationPolicy: cancelText || undefined,
                freeCancellation: cancelText.toLowerCase().includes('free'),
                hasDiscount: false,
                occupancy: 2,
                scrapedAt: new Date(),
                confidence: meal.confidence * 0.92,
              });
            }
          } catch { /* skip malformed row */ }
        }
      }

      // Fallback: alternative price selectors
      if (rates.length === 0) {
        const priceEls = await page.$$('.bui-price-display__value, [data-testid="price-and-discounted-price"]');
        for (const el of priceEls) {
          const price = this.extractPrice((await el.textContent()) || '');
          if (price && price > 1000) {
            rates.push({
              hotelName, roomType: 'Best Available',
              mapRate: null, cpRate: null, epRate: price,
              taxPercent: 18, taxInclusive: true, totalWithTax: price,
              source: this.source, sourceUrl: url, isAvailable: true,
              breakfastIncluded: false, dinnerIncluded: false, lunchIncluded: false,
              freeCancellation: false, hasDiscount: false,
              occupancy: 2, scrapedAt: new Date(), confidence: 0.65,
            });
            break;
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
            occupancy: 2, scrapedAt: new Date(), confidence: 0.45,
          });
        }
      }
    } catch (err) {
      console.error(`[booking.com] Failed for ${hotelName}:`, err);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
