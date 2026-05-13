// ============================================================
// KodaiRateIQ — Agoda Scraper
// Forces INR currency via URL param. Multi-selector strategy.
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

// Agoda property slugs (verified format: name/hotel/city.html)
const AGODA_SLUGS: Record<string, string> = {
  'The Carlton':               'the-carlton-kodaikanal',
  'The Tamara Kodai':          'the-tamara-kodaikanal',
  'Hotel Kodai International': 'hotel-kodai-international',
  'Sterling Kodai Lake':       'sterling-kodai-lake',
  'Le Poshe by Sparsa':        'le-poshe-by-sparsa-kodaikanal',
};

// Agoda numeric property IDs (needed for fallback URL)
const AGODA_PROPERTY_IDS: Record<string, string> = {
  'The Carlton':               '302074',
  'The Tamara Kodai':          '2177765',
  'Hotel Kodai International': '495614',
  'Sterling Kodai Lake':       '256481',
  'Le Poshe by Sparsa':        '9136226',
};

const ROOM_CARD_SELS = [
  '[data-selenium="RoomCard"]',
  '[class*="RoomCard"]',
  '[class*="room-card"]',
  '[data-testid*="room"]',
  '[class*="MasterRoom"]',
  '[class*="PropertyRooms"]',
  '[class*="roomtype"]',
];

const ROOM_NAME_SELS = [
  '[data-selenium="RoomName"]',
  '[class*="RoomName"]',
  '[class*="room-name"]',
  '[class*="roomType"]',
  'h3', 'h4',
];

const PRICE_SELS = [
  '[data-selenium="PriceDisplay"]',
  '[class*="priceValue"]',
  '[class*="PriceValue"]',
  '[class*="price-display"]',
  '[class*="price"]',
  '[class*="Price"]',
  '[class*="amount"]',
  'strong[class*="price"]',
];

const MEAL_SELS = [
  '[class*="inclusion"]',
  '[class*="benefit"]',
  '[class*="meal"]',
  '[class*="Meal"]',
  '[class*="BoardType"]',
  '[class*="boardType"]',
];

export class AgodaScraper extends BaseScraper {
  get source(): string { return 'agoda'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const slug = AGODA_SLUGS[hotelName];
    const propertyId = AGODA_PROPERTY_IDS[hotelName];
    if (!slug && !propertyId) {
      console.warn(`[agoda] No config for: ${hotelName}`);
      return [];
    }

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      // Primary URL with INR currency forced via selectedCurrencyCode
      const primaryUrl = slug
        ? `https://www.agoda.com/en-in/${slug}/hotel/kodaikanal-india.html` +
          `?checkIn=${ci}&checkOut=${co}&rooms=1&adults=2&children=0` +
          `&selectedCurrencyCode=INR&currency=INR`
        : `https://www.agoda.com/en-in/hotel/${propertyId}/hotel/kodaikanal-india.html` +
          `?checkIn=${ci}&checkOut=${co}&rooms=1&adults=2&children=0` +
          `&selectedCurrencyCode=INR&currency=INR`;

      console.log(`[agoda] navigating hotel=${hotelName}`);
      await this.navigate(page, primaryUrl);

      // Cookie consent banner
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

      // Additional wait for room cards to render (Agoda is heavily async)
      const cardSel = ROOM_CARD_SELS.join(', ');
      await this.waitForSelector(page, cardSel, 20000);

      // Scroll to room section to trigger lazy load
      try {
        await page.evaluate(() => {
          const roomSection = document.querySelector('[data-selenium="RoomCard"], [class*="RoomCard"]');
          if (roomSection) roomSection.scrollIntoView({ behavior: 'smooth' });
        });
        await page.waitForTimeout(3000);
      } catch { /* ignore */ }

      let allCards: Array<import('playwright').ElementHandle> = [];
      for (const sel of ROOM_CARD_SELS) {
        const cards = await page.$$(sel);
        if (cards.length > 0) {
          allCards = cards;
          console.log(`[agoda] using selector "${sel}": ${cards.length} room cards`);
          break;
        }
      }

      for (const card of allCards) {
        try {
          let roomName = 'Standard Room';
          for (const nameSel of ROOM_NAME_SELS) {
            const el = await card.$(nameSel);
            const t = (await el?.textContent())?.trim() || '';
            if (t.length > 2) { roomName = t; break; }
          }

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

          let mealText = '';
          for (const mealSel of MEAL_SELS) {
            const el = await card.$(mealSel);
            const t = (await el?.textContent())?.toLowerCase() || '';
            if (t.length > 2) { mealText = t; break; }
          }

          if (price && price > 50) {
            // Detect if USD or INR
            const hasRupee = priceText.includes('₹') || priceText.includes('INR');
            const inrPrice = this.normalizeToInr(price, hasRupee);
            if (inrPrice < 500 || inrPrice > 500000) continue;

            const normalized = normalizeTaxInclusive(inrPrice, true); // Agoda shows tax-inclusive
            const meal = classifyMealPlan(mealText, roomName);
            if (meal.shouldReject) continue;

            rates.push({
              hotelName,
              roomType: roomName,
              mapRate: meal.isMapEligible ? normalized : null,
              cpRate: meal.plan === 'CP' ? normalized : null,
              epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalized : null,
              taxPercent: 18,
              taxInclusive: true,
              totalWithTax: inrPrice,
              source: this.source,
              sourceUrl: primaryUrl,
              isAvailable: true,
              breakfastIncluded: meal.breakfastIncluded,
              dinnerIncluded: meal.dinnerIncluded,
              lunchIncluded: meal.lunchIncluded,
              mealDetails: mealText || undefined,
              freeCancellation: mealText.includes('free cancel'),
              hasDiscount: false,
              occupancy: 2,
              scrapedAt: new Date(),
              confidence: meal.confidence * 0.90,
            });
          }
        } catch { /* skip */ }
      }

      // Fallback: generic price scan
      if (rates.length === 0) {
        for (const priceSel of PRICE_SELS) {
          const priceEls = await page.$$(priceSel);
          for (const el of priceEls.slice(0, 5)) {
            const t = (await el.textContent()) || '';
            const price = this.extractPrice(t);
            if (price && price > 50) {
              const hasRupee = t.includes('₹') || t.includes('INR');
              const inrPrice = this.normalizeToInr(price, hasRupee);
              if (inrPrice >= 1000 && inrPrice <= 500000) {
                rates.push({
                  hotelName, roomType: 'Best Available',
                  mapRate: null, cpRate: null, epRate: normalizeTaxInclusive(inrPrice, true),
                  taxPercent: 18, taxInclusive: true, totalWithTax: inrPrice,
                  source: this.source, sourceUrl: primaryUrl, isAvailable: true,
                  breakfastIncluded: false, dinnerIncluded: false, lunchIncluded: false,
                  freeCancellation: false, hasDiscount: false,
                  occupancy: 2, scrapedAt: new Date(), confidence: 0.55,
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
        console.log(`[agoda] ${hotelName}: text scan found ${evalPrices.length} prices`);
        if (evalPrices.length > 0) {
          rates.push({
            hotelName, roomType: 'Best Available',
            mapRate: null, cpRate: null, epRate: evalPrices[0],
            taxPercent: 18, taxInclusive: false, totalWithTax: evalPrices[0],
            source: this.source, sourceUrl: primaryUrl, isAvailable: true,
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
