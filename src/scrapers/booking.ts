// ============================================================
// KodaiRateIQ — Booking.com Scraper
// ============================================================
import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

// Slugs without language suffix — INR is forced via URL query params
const BOOKING_SLUGS: Record<string, string> = {
  'The Carlton':               'hotel/in/the-carlton-kodaikanal',
  'The Tamara Kodai':          'hotel/in/the-tamara-kodaikanal',
  'Hotel Kodai International': 'hotel/in/kodai-international',
  'Sterling Kodai Lake':       'hotel/in/sterling-kodai-lake',
  'Le Poshe by Sparsa':        'hotel/in/le-poshe-by-sparsa',
};

// Multi-generation selector sets for booking.com (2023-2025)
const ROOM_ROW_SEL =
  '.hprt-table tbody tr, ' +
  '[data-testid="availability-rates-table"] tbody tr, ' +
  '[data-block="availability_rate_table"] table tbody tr, ' +
  '.roomrow, [id^="hprt-roomblock"] .room-options tr';

const ROOM_NAME_SEL =
  '.hprt-roomtype-icon-link, [data-testid="room-type"], ' +
  '.hprt-roomtype-name, [class*="RoomName"], [class*="roomName"]';

const PRICE_SEL =
  '.bui-price-display__value, .prco-valign-middle-helper, ' +
  '[data-testid="price-and-discounted-price"], .bui-price__value, ' +
  '.prco-text, [class*="finalPrice"], [class*="discountedPrice"], ' +
  '[class*="price-total"], span[class*="price"]';

export class BookingScraper extends BaseScraper {
  get source(): string { return 'booking.com'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const slug = BOOKING_SLUGS[hotelName];
    if (!slug) { console.warn(`[booking.com] No slug for: ${hotelName}`); return []; }

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);
      // CRITICAL: currency=INR — without this, Booking.com shows GBP from UK datacenter IPs
      const url =
        `https://www.booking.com/${slug}.html` +
        `?checkin=${ci}&checkout=${co}` +
        `&group_adults=2&no_rooms=1&group_children=0` +
        `&currency=INR&selected_currency=INR&lang=en-us`;

      console.log(`[booking.com] navigating hotel=${hotelName}`);
      await this.navigate(page, url);

      // Dismiss cookie / GDPR banners
      for (const sel of [
        '#onetrust-accept-btn-handler',
        'button[data-gdpr-consent]',
      ]) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 1500 })) { await btn.click(); await page.waitForTimeout(600); break; }
        } catch { /* none */ }
      }

      // Wait for room table — up to 15s
      await page.waitForSelector(ROOM_ROW_SEL, { timeout: 15000 }).catch(() => null);
      await page.waitForTimeout(1500);

      // ── Strategy 1: structured room-row extraction ──────────
      const roomRows = await page.$$(ROOM_ROW_SEL);
      console.log(`[booking.com] ${hotelName}: ${roomRows.length} room rows`);

      for (const row of roomRows) {
        try {
          const nameEl = await row.$(ROOM_NAME_SEL);
          const roomName = (await nameEl?.textContent())?.trim() || '';
          if (!roomName) continue;

          const priceEl = await row.$(PRICE_SEL);
          const priceText = await priceEl?.textContent();
          const price = this.extractPrice(priceText || '');

          const mealEl = await row.$(
            '.hprt-roomtype-meal, [data-testid="inclusion"], [class*="meal"], [class*="inclusion"]'
          );
          const mealText = (await mealEl?.textContent())?.toLowerCase() || '';
          const cancelEl = await row.$('.hprt-roomtype-cancellation, [class*="cancel"]');
          const cancelText = (await cancelEl?.textContent())?.trim() || '';

          if (price && price >= 1500 && price <= 300000) {
            const meal = classifyMealPlan(mealText, roomName);
            if (meal.shouldReject) continue;
            rates.push({
              hotelName, roomType: roomName,
              mapRate: meal.isMapEligible ? normalizeTaxInclusive(price, true) : null,
              cpRate:  meal.plan === 'CP' ? normalizeTaxInclusive(price, true) : null,
              epRate:  meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalizeTaxInclusive(price, true) : null,
              taxPercent: 18, taxInclusive: true, totalWithTax: price,
              source: this.source, sourceUrl: url, isAvailable: true,
              breakfastIncluded: meal.breakfastIncluded, dinnerIncluded: meal.dinnerIncluded,
              lunchIncluded: meal.lunchIncluded, mealDetails: mealText || undefined,
              cancellationPolicy: cancelText || undefined,
              freeCancellation: cancelText.toLowerCase().includes('free'),
              hasDiscount: false, occupancy: 2, scrapedAt: new Date(),
              confidence: meal.confidence * 0.92,
            });
          }
        } catch { /* skip malformed row */ }
      }

      // ── Strategy 2: any price element on page ───────────────
      if (rates.length === 0) {
        const priceEls = await page.$$(PRICE_SEL);
        console.log(`[booking.com] ${hotelName}: fallback found ${priceEls.length} price elements`);
        for (const el of priceEls.slice(0, 8)) {
          const price = this.extractPrice((await el.textContent()) || '');
          if (price && price >= 1500 && price <= 300000) {
            rates.push({
              hotelName, roomType: 'Best Available',
              mapRate: null, cpRate: null, epRate: normalizeTaxInclusive(price, true),
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

      // ── Strategy 3: raw page text scan for ₹ amounts ────────
      if (rates.length === 0) {
        const evalPrices = await this.evaluatePrices(page);
        console.log(`[booking.com] ${hotelName}: text-scan found ${evalPrices.length} prices: ${evalPrices.slice(0, 5).join(', ')}`);
        if (evalPrices.length > 0) {
          rates.push({
            hotelName, roomType: 'Best Available',
            mapRate: null, cpRate: null, epRate: evalPrices[0],
            taxPercent: 18, taxInclusive: true, totalWithTax: evalPrices[0],
            source: this.source, sourceUrl: url, isAvailable: true,
            breakfastIncluded: false, dinnerIncluded: false, lunchIncluded: false,
            freeCancellation: false, hasDiscount: false,
            occupancy: 2, scrapedAt: new Date(), confidence: 0.50,
          });
        }
      }

      console.log(`[booking.com] ${hotelName}: extracted ${rates.length} rates`);
    } catch (err) {
      console.error(`[booking.com] failed ${hotelName}: ${(err as Error).message}`);
      throw err;
    } finally {
      await page.close();
    }
    return rates;
  }
}
