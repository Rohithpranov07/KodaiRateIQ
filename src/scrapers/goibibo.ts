// ============================================================
// KodaiRateIQ — Goibibo Scraper
// Uses city-level search page to avoid needing numeric property IDs.
// Searches for each hotel by name within Kodaikanal results.
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';

// Partial names used for fuzzy matching in search results
const HOTEL_SEARCH_NAMES: Record<string, string[]> = {
  'The Carlton':               ['carlton', 'the carlton'],
  'The Tamara Kodai':          ['tamara', 'tamara kodai'],
  'Hotel Kodai International': ['kodai international', 'kodai inter'],
  'Sterling Kodai Lake':       ['sterling', 'sterling kodai'],
  'Le Poshe by Sparsa':        ['le poshe', 'poshe'],
};

// Multiple selector strategies for Goibibo's evolving React DOM
const HOTEL_CARD_SELS = [
  '[class*="hotel-card"]',
  '[class*="hotelCard"]',
  '[class*="HotelCard"]',
  '[data-testid*="hotel"]',
  '[class*="propertyCard"]',
  '[class*="listingCard"]',
  'li[class*="listing"]',
  'article[class*="hotel"]',
];

const HOTEL_NAME_SELS = [
  '[class*="hotelName"]',
  '[class*="hotel-name"]',
  '[class*="propertyName"]',
  '[class*="HotelName"]',
  'h2', 'h3', 'h4',
];

const PRICE_SELS = [
  '[class*="price"]',
  '[class*="Price"]',
  '[class*="amount"]',
  '[class*="Amount"]',
  '[class*="rate"]',
  '[class*="tariff"]',
  '[class*="finalPrice"]',
  'strong[class*="text"]',
];

const MEAL_SELS = [
  '[class*="meal"]',
  '[class*="Meal"]',
  '[class*="inclusion"]',
  '[class*="Inclusion"]',
  '[class*="plan"]',
  '[class*="board"]',
];

export class GoibiboScraper extends BaseScraper {
  get source(): string { return 'goibibo'; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const matchNames = HOTEL_SEARCH_NAMES[hotelName];
    if (!matchNames) {
      console.warn(`[goibibo] No match config for: ${hotelName}`);
      return [];
    }

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);

      // Search the Kodaikanal city listing — no property ID needed
      const url =
        `https://www.goibibo.com/hotels/hotels-in-kodaikanal-tamilnadu/` +
        `?checkin=${ci}&checkout=${co}&adults=2&rooms=1&children=0`;

      console.log(`[goibibo] navigating city search for ${hotelName}`);
      await this.navigate(page, url);

      // Wait for hotel cards to appear
      const cardSel = HOTEL_CARD_SELS.join(', ');
      const cardsFound = await this.waitForSelector(page, cardSel, 20000);
      console.log(`[goibibo] hotel cards found: ${cardsFound}`);

      if (cardsFound) {
        // Try each card selector until one returns results
        let allCards: Array<import('playwright').ElementHandle> = [];
        for (const sel of HOTEL_CARD_SELS) {
          const cards = await page.$$(sel);
          if (cards.length > 0) {
            allCards = cards;
            console.log(`[goibibo] using selector "${sel}": ${cards.length} cards`);
            break;
          }
        }

        for (const card of allCards) {
          try {
            // Extract name from the card
            let cardName = '';
            for (const nameSel of HOTEL_NAME_SELS) {
              const el = await card.$(nameSel);
              const t = (await el?.textContent())?.trim().toLowerCase() || '';
              if (t.length > 3) { cardName = t; break; }
            }

            // Check if this card matches our hotel
            const isMatch = matchNames.some(n => cardName.includes(n));
            if (!isMatch) continue;

            console.log(`[goibibo] matched hotel card: "${cardName}" for ${hotelName}`);

            // Extract price
            let price: number | null = null;
            let priceText = '';
            for (const priceSel of PRICE_SELS) {
              const el = await card.$(priceSel);
              priceText = (await el?.textContent()) || '';
              if (priceText.trim()) {
                price = this.extractPrice(priceText);
                if (price && price > 100) break;
              }
            }

            // Extract meal info
            let mealText = '';
            for (const mealSel of MEAL_SELS) {
              const el = await card.$(mealSel);
              const t = (await el?.textContent())?.toLowerCase() || '';
              if (t.length > 2) { mealText = t; break; }
            }

            if (price && price > 100) {
              // Goibibo shows pre-tax prices in INR; normalize USD if needed
              const isInrRange = price >= 1500;
              const normalized = isInrRange
                ? normalizeTaxInclusive(price, false)
                : normalizeTaxInclusive(this.normalizeToInr(price, false), false);

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
              break; // One card match is enough
            }
          } catch { /* skip malformed card */ }
        }
      }

      // Fallback: scan full page for price symbols near the hotel name
      if (rates.length === 0) {
        console.log(`[goibibo] card extraction yielded 0 rates — trying full-page text scan`);
        const evalPrices = await this.evaluatePrices(page);
        console.log(`[goibibo] text scan found ${evalPrices.length} prices: ${evalPrices.slice(0, 5)}`);
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

      console.log(`[goibibo] ${hotelName}: extracted ${rates.length} rates`);
    } catch (err) {
      console.error(`[goibibo] Failed for ${hotelName}:`, (err as Error).message);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}
