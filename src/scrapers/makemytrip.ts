// ============================================================
// KodaiRateIQ — MakeMyTrip Scraper
// Uses city listing URL with correct MMDDYYYY date format.
// MMT slugs are not valid hotel IDs — must use listing search.
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

// Partial names for fuzzy matching in MMT listing results
const HOTEL_MATCH_NAMES: Record<string, string[]> = {
  'The Carlton':               ['carlton', 'the carlton'],
  'The Tamara Kodai':          ['tamara', 'tamara kodai'],
  'Hotel Kodai International': ['kodai international', 'kodai inter'],
  'Sterling Kodai Lake':       ['sterling', 'sterling kodai'],
  'Le Poshe by Sparsa':        ['le poshe', 'poshe', 'sparsa'],
};

const HOTEL_CARD_SELS = [
  '[class*="hotelCard"]',
  '[class*="hotel-card"]',
  '[class*="HotelCard"]',
  '[class*="listingCard"]',
  '[class*="propertyCard"]',
  '[data-testid*="hotel"]',
  'li[class*="hotel"]',
  'article[class*="hotel"]',
];

const HOTEL_NAME_SELS = [
  '[class*="hotelName"]',
  '[class*="hotel-name"]',
  '[class*="HotelName"]',
  '[class*="propertyName"]',
  'p[class*="name"]',
  'h2', 'h3', 'h4',
];

const PRICE_SELS = [
  '[class*="price"]',
  '[class*="Price"]',
  '[class*="amount"]',
  '[class*="Amount"]',
  '[class*="tariff"]',
  '[class*="rate"]',
  '[class*="finalPrice"]',
  '[class*="discountPrice"]',
  'strong',
];

const MEAL_SELS = [
  '[class*="meal"]',
  '[class*="Meal"]',
  '[class*="inclusion"]',
  '[class*="plan"]',
  '[class*="board"]',
  '[class*="amenity"]',
];

export class MakeMyTripScraper extends BaseScraper {
  get source(): string { return 'makemytrip'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const matchNames = HOTEL_MATCH_NAMES[hotelName];
    if (!matchNames) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      // MMT requires MMDDYYYY format (no hyphens)
      const ci = this.formatMmtDate(checkIn);
      const co = this.formatMmtDate(checkOut);

      // Use city listing URL — bypasses the invalid numeric hotelId issue
      const url =
        `https://www.makemytrip.com/hotels/hotel-listing/` +
        `?checkin=${ci}&checkout=${co}&roomStayQualifier=2e0e` +
        `&city=CTKDI&country=IN&area=Kodaikanal` +
        `&locusId=CTKDI&locusType=city&searchText=Kodaikanal`;

      console.log(`[makemytrip] navigating listing for ${hotelName}`);
      await this.navigate(page, url);

      // Close login/signin modal if it appears
      for (const closeSelStr of [
        '[class*="close"]',
        '[aria-label="Close"]',
        '[class*="Cross"]',
        'button:has-text("×")',
        '[class*="modalClose"]',
      ]) {
        try {
          const closeBtn = page.locator(closeSelStr).first();
          if (await closeBtn.isVisible({ timeout: 2000 })) {
            await closeBtn.click();
            await page.waitForTimeout(500);
            break;
          }
        } catch { /* no modal */ }
      }

      const cardSel = HOTEL_CARD_SELS.join(', ');
      const cardsFound = await this.waitForSelector(page, cardSel, 20000);
      console.log(`[makemytrip] hotel cards found: ${cardsFound}`);

      if (cardsFound) {
        let allCards: Array<import('playwright').ElementHandle> = [];
        for (const sel of HOTEL_CARD_SELS) {
          const cards = await page.$$(sel);
          if (cards.length > 0) {
            allCards = cards;
            console.log(`[makemytrip] using selector "${sel}": ${cards.length} cards`);
            break;
          }
        }

        for (const card of allCards) {
          try {
            let cardName = '';
            for (const nameSel of HOTEL_NAME_SELS) {
              const el = await card.$(nameSel);
              const t = (await el?.textContent())?.trim().toLowerCase() || '';
              if (t.length > 3) { cardName = t; break; }
            }

            const isMatch = matchNames.some(n => cardName.includes(n));
            if (!isMatch) continue;

            console.log(`[makemytrip] matched card: "${cardName}" for ${hotelName}`);

            let price: number | null = null;
            let priceText = '';
            for (const priceSel of PRICE_SELS) {
              const priceEls = await card.$$(priceSel);
              for (const el of priceEls) {
                priceText = (await el.textContent()) || '';
                const p = this.extractPrice(priceText);
                if (p && p > 100) { price = p; break; }
              }
              if (price) break;
            }

            let mealText = '';
            for (const mealSel of MEAL_SELS) {
              const el = await card.$(mealSel);
              const t = (await el?.textContent())?.toLowerCase() || '';
              if (t.length > 2) { mealText = t; break; }
            }

            if (price && price > 100) {
              const isInrRange = price >= 1500;
              const inrPrice = isInrRange ? price : this.normalizeToInr(price, false);
              const normalized = normalizeTaxInclusive(inrPrice, false);

              if (normalized < 500 || normalized > 500000) continue;

              const meal = classifyMealPlan(mealText, hotelName);
              if (meal.shouldReject) continue;

              rates.push({
                hotelName,
                roomType: 'Best Available',
                mapRate: meal.isMapEligible ? normalized : null,
                cpRate: meal.plan === 'CP' ? normalized : null,
                epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalized : null,
                taxPercent: 18,
                taxInclusive: false,
                totalWithTax: normalized,
                source: this.source,
                sourceUrl: url,
                isAvailable: true,
                breakfastIncluded: meal.breakfastIncluded,
                dinnerIncluded: meal.dinnerIncluded,
                lunchIncluded: meal.lunchIncluded,
                mealDetails: mealText || undefined,
                freeCancellation: false,
                hasDiscount: false,
                occupancy: 2,
                scrapedAt: new Date(),
                confidence: meal.confidence * 0.85,
              });
              break;
            }
          } catch { /* skip malformed card */ }
        }
      }

      if (rates.length === 0) {
        console.log(`[makemytrip] card extraction yielded 0 rates — text scan`);
        const evalPrices = await this.evaluatePrices(page);
        console.log(`[makemytrip] text scan found ${evalPrices.length} prices`);
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

      console.log(`[makemytrip] ${hotelName}: extracted ${rates.length} rates`);
    } catch (err) {
      console.error(`[makemytrip] Failed for ${hotelName}:`, (err as Error).message);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
