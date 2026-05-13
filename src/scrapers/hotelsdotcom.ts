// ============================================================
// KodaiRateIQ — Hotels.com Scraper
// Shares Expedia property IDs. Handles INR and USD prices.
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

const HOTELSDOTCOM_IDS: Record<string, string> = {
  'The Carlton':               '6823654',
  'The Tamara Kodai':          '12507628',
  'Hotel Kodai International': '3296478',
  'Sterling Kodai Lake':       '6432118',
  'Le Poshe by Sparsa':        '14856234',
};

const ROOM_SELS = [
  '[data-stid="property-room-unit"]',
  '[class*="uitk-card"][class*="room"]',
  '[data-stid*="room"]',
  '[class*="RoomType"]',
  '[class*="room-unit"]',
];

const PRICE_SELS = [
  '[class*="uitk-lockup-price"]',
  '[data-stid="rooms-room-price"] span',
  '[class*="price-summary"] span',
  '[class*="current-price"]',
  '[class*="totalPrice"]',
  'span[class*="price"]',
];

const MEAL_SELS = [
  '[data-stid="room-inclusion"]',
  '[class*="inclusion"]',
  '[class*="amenity"]',
  '[class*="benefit"]',
  '[class*="meal"]',
];

export class HotelsDotComScraper extends BaseScraper {
  get source(): string { return 'hotels.com'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const propertyId = HOTELSDOTCOM_IDS[hotelName];
    if (!propertyId) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      const url = `https://www.hotels.com/ho${propertyId}?chkin=${ci}&chkout=${co}&rm1=a2&currency=INR`;

      console.log(`[hotels.com] navigating hotel=${hotelName}`);
      await this.navigate(page, url);

      for (const closeSel of ['[data-stid="modal-close"]', '[aria-label="Close"]']) {
        try {
          const btn = page.locator(closeSel).first();
          if (await btn.isVisible({ timeout: 1500 })) { await btn.click(); break; }
        } catch { /* no popup */ }
      }

      const roomSel = ROOM_SELS.join(', ');
      await this.waitForSelector(page, roomSel, 20000);

      let allRooms: Array<import('playwright').ElementHandle> = [];
      for (const sel of ROOM_SELS) {
        const rooms = await page.$$(sel);
        if (rooms.length > 0) { allRooms = rooms; break; }
      }

      for (const room of allRooms) {
        try {
          const nameEl = await room.$('h3, [class*="uitk-heading"], [class*="roomName"]');
          const roomName = (await nameEl?.textContent())?.trim() || 'Standard Room';

          let price: number | null = null;
          let priceText = '';
          for (const priceSel of PRICE_SELS) {
            const el = await room.$(priceSel);
            priceText = (await el?.textContent()) || '';
            if (priceText.trim()) {
              price = this.extractPrice(priceText);
              if (price && price > 20) break;
            }
          }

          let mealText = '';
          for (const mealSel of MEAL_SELS) {
            const el = await room.$(mealSel);
            const t = (await el?.textContent())?.toLowerCase() || '';
            if (t.length > 2) { mealText = t; break; }
          }

          if (price && price > 20) {
            const hasRupee = priceText.includes('₹') || priceText.includes('INR');
            const inrPrice = this.normalizeToInr(price, hasRupee);
            if (inrPrice < 500 || inrPrice > 500000) continue;

            const meal = classifyMealPlan(mealText, roomName);
            if (meal.shouldReject) continue;

            const normalized = normalizeTaxInclusive(inrPrice, true);
            rates.push({
              hotelName, roomType: roomName,
              mapRate: meal.isMapEligible ? normalized : null,
              cpRate: meal.plan === 'CP' ? normalized : null,
              epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalized : null,
              taxPercent: 18, taxInclusive: true, totalWithTax: inrPrice,
              source: this.source, sourceUrl: url, isAvailable: true,
              breakfastIncluded: meal.breakfastIncluded, dinnerIncluded: meal.dinnerIncluded,
              lunchIncluded: meal.lunchIncluded, mealDetails: mealText || undefined,
              freeCancellation: mealText.includes('fully refundable') || mealText.includes('free cancel'),
              hasDiscount: false, occupancy: 2, scrapedAt: new Date(),
              confidence: meal.confidence * 0.88,
            });
          }
        } catch { /* skip */ }
      }

      if (rates.length === 0) {
        const priceSel = PRICE_SELS.join(', ');
        const priceEls = await page.$$(priceSel);
        for (const el of priceEls.slice(0, 5)) {
          const priceText = (await el.textContent()) || '';
          const price = this.extractPrice(priceText);
          if (price && price > 20) {
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
                occupancy: 2, scrapedAt: new Date(), confidence: 0.55,
              });
              break;
            }
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
            occupancy: 2, scrapedAt: new Date(), confidence: 0.40,
          });
        }
      }

      console.log(`[hotels.com] ${hotelName}: extracted ${rates.length} rates`);
    } catch (err) {
      console.error(`[hotels.com] Failed for ${hotelName}:`, (err as Error).message);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
