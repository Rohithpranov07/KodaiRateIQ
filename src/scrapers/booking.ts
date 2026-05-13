// ============================================================
// KodaiRateIQ — Booking.com Scraper
// Forces INR currency. Waits aggressively for room table render.
// ============================================================
import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

const BOOKING_SLUGS: Record<string, string> = {
  'The Carlton':               'hotel/in/the-carlton-kodaikanal',
  'The Tamara Kodai':          'hotel/in/the-tamara-kodaikanal',
  'Hotel Kodai International': 'hotel/in/kodai-international',
  'Sterling Kodai Lake':       'hotel/in/sterling-kodai-lake',
  'Le Poshe by Sparsa':        'hotel/in/le-poshe-by-sparsa',
};

// Multi-generation selectors for Booking.com (2023-2025 DOM variants)
const ROOM_ROW_SELS = [
  '.hprt-table tbody tr',
  '[data-testid="availability-rates-table"] tbody tr',
  '[data-block="availability_rate_table"] table tbody tr',
  '.roomrow',
  '[id^="hprt-roomblock"] .room-options tr',
  '[data-testid="property-section--content"] tr',
  'table[class*="hprt"] tr',
  '[class*="RateRow"]',
  '[class*="rate-row"]',
];

const ROOM_NAME_SELS = [
  '.hprt-roomtype-icon-link',
  '[data-testid="room-type"]',
  '.hprt-roomtype-name',
  '[class*="RoomName"]',
  '[class*="roomName"]',
  'td:first-child a',
  'td:first-child span',
];

const PRICE_SELS = [
  '.bui-price-display__value',
  '.prco-valign-middle-helper',
  '[data-testid="price-and-discounted-price"]',
  '.bui-price__value',
  '.prco-text',
  '[class*="finalPrice"]',
  '[class*="discountedPrice"]',
  '[class*="price-total"]',
  'span[class*="price"]',
  '[data-testid="recommended-units-price"]',
  '.sr_price_type_total',
  '[class*="pricePerNight"]',
];

const MEAL_SELS = [
  '.hprt-roomtype-meal',
  '[data-testid="inclusion"]',
  '[class*="meal"]',
  '[class*="inclusion"]',
  '[class*="boardType"]',
  '[class*="MealInfo"]',
];

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
      // CRITICAL: force INR — without this, Booking.com shows GBP from UK datacenter IPs
      const url =
        `https://www.booking.com/${slug}.html` +
        `?checkin=${ci}&checkout=${co}` +
        `&group_adults=2&no_rooms=1&group_children=0` +
        `&currency=INR&selected_currency=INR&lang=en-us` +
        `&nflt=&src=hotel&src_elem=sb&srpvid=`;

      console.log(`[booking.com] navigating hotel=${hotelName}`);
      await this.navigate(page, url);

      // Dismiss cookie / GDPR banners aggressively
      for (const btnSel of [
        '#onetrust-accept-btn-handler',
        'button[data-gdpr-consent]',
        '[data-testid="accept-all-button"]',
        '#didomi-notice-agree-button',
        'button:has-text("Accept")',
        'button:has-text("I accept")',
      ]) {
        try {
          const btn = page.locator(btnSel).first();
          if (await btn.isVisible({ timeout: 1500 })) {
            await btn.click();
            await page.waitForTimeout(600);
            break;
          }
        } catch { /* none */ }
      }

      // Scroll to room section to trigger Booking.com's lazy-loaded availability table
      try {
        await page.evaluate(() => {
          const anchor =
            document.querySelector('.hprt-table') ||
            document.querySelector('[data-testid="availability-rates-table"]') ||
            document.querySelector('#hprt-table');
          if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
          else window.scrollBy(0, 600);
        });
        await page.waitForTimeout(2000);
      } catch { /* ignore */ }

      // Wait for room table — up to 25s after navigation
      const roomRowSel = ROOM_ROW_SELS.join(', ');
      const tableFound = await this.waitForSelector(page, roomRowSel, 25000);
      console.log(`[booking.com] ${hotelName}: room table found=${tableFound}`);

      // ── Strategy 1: structured room-row extraction ──────────
      let allRows: Array<import('playwright').ElementHandle> = [];
      for (const sel of ROOM_ROW_SELS) {
        const rows = await page.$$(sel);
        if (rows.length > 0) {
          allRows = rows;
          console.log(`[booking.com] using selector "${sel}": ${rows.length} rows`);
          break;
        }
      }

      for (const row of allRows) {
        try {
          let roomName = '';
          for (const nameSel of ROOM_NAME_SELS) {
            const el = await row.$(nameSel);
            const t = (await el?.textContent())?.trim() || '';
            if (t.length > 2) { roomName = t; break; }
          }
          if (!roomName) continue;

          let price: number | null = null;
          let priceText = '';
          for (const priceSel of PRICE_SELS) {
            const el = await row.$(priceSel);
            priceText = (await el?.textContent()) || '';
            if (priceText.trim()) {
              price = this.extractPrice(priceText);
              if (price && price > 50) break;
            }
          }

          let mealText = '';
          for (const mealSel of MEAL_SELS) {
            const el = await row.$(mealSel);
            const t = (await el?.textContent())?.toLowerCase() || '';
            if (t.length > 2) { mealText = t; break; }
          }

          const cancelEl = await row.$('.hprt-roomtype-cancellation, [class*="cancel"]');
          const cancelText = (await cancelEl?.textContent())?.trim() || '';

          if (price && price > 50) {
            const hasRupee = priceText.includes('₹') || priceText.includes('INR');
            const inrPrice = this.normalizeToInr(price, hasRupee);
            if (inrPrice < 500 || inrPrice > 500000) continue;

            const meal = classifyMealPlan(mealText, roomName);
            if (meal.shouldReject) continue;

            const normalized = normalizeTaxInclusive(inrPrice, true); // Booking is tax-inclusive
            rates.push({
              hotelName, roomType: roomName,
              mapRate: meal.isMapEligible ? normalized : null,
              cpRate:  meal.plan === 'CP' ? normalized : null,
              epRate:  meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalized : null,
              taxPercent: 18, taxInclusive: true, totalWithTax: inrPrice,
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
        const priceSel = PRICE_SELS.join(', ');
        const priceEls = await page.$$(priceSel);
        console.log(`[booking.com] ${hotelName}: fallback found ${priceEls.length} price elements`);
        for (const el of priceEls.slice(0, 10)) {
          const priceText = (await el.textContent()) || '';
          const price = this.extractPrice(priceText);
          if (price && price > 50) {
            const hasRupee = priceText.includes('₹') || priceText.includes('INR');
            const inrPrice = this.normalizeToInr(price, hasRupee);
            if (inrPrice >= 1000 && inrPrice <= 500000) {
              rates.push({
                hotelName, roomType: 'Best Available',
                mapRate: null, cpRate: null, epRate: normalizeTaxInclusive(inrPrice, true),
                taxPercent: 18, taxInclusive: true, totalWithTax: inrPrice,
                source: this.source, sourceUrl: url, isAvailable: true,
                breakfastIncluded: false, dinnerIncluded: false, lunchIncluded: false,
                freeCancellation: false, hasDiscount: false,
                occupancy: 2, scrapedAt: new Date(), confidence: 0.60,
              });
              break;
            }
          }
        }
      }

      // ── Strategy 3: raw page text scan ────────────────────
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
            occupancy: 2, scrapedAt: new Date(), confidence: 0.45,
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
