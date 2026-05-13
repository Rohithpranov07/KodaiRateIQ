// ============================================================
// KodaiRateIQ — Official Hotel Website Scrapers
//
// Scrapes each hotel's own booking engine directly.
// Official rates are the authoritative source — highest trust.
// ============================================================

import { BaseScraper } from './base';
import { classifyMealPlan, normalizeTaxInclusive } from '@/engine/map-classifier';
import type { ScrapedRate } from '@/types';
import { sleep } from '@/lib/utils';

// ── Hotel-specific booking engine configs ────────────────────
interface OfficialConfig {
  url: (ci: string, co: string) => string;
  priceSelectors: string[];
  roomSelectors: string[];
  inclSelectors: string[];
  taxInclusive: boolean;
}

// DISABLED official configs are excluded from scraping entirely.
// Reason codes:
//   BROKEN_URL  — domain does not resolve or blocks datacenter IPs
//   UNRELIABLE  — booking engine not publicly accessible
const DISABLED_OFFICIAL: Record<string, string> = {
  // book.sterlingholidays.com fails DNS on Railway + blocks datacenter IPs
  'Sterling Kodai Lake': 'BROKEN_URL: book.sterlingholidays.com unreachable from Railway',
};

const OFFICIAL_CONFIGS: Record<string, OfficialConfig> = {
  'The Carlton': {
    url: (ci, co) => `https://www.thecarlton.in/tariff/?checkin=${ci}&checkout=${co}&adults=2&children=0&rooms=1`,
    priceSelectors: ['[class*="price"], [class*="rate"], [class*="tariff"]'],
    roomSelectors: ['[class*="room-type"], [class*="roomType"], h3, h2'],
    inclSelectors: ['[class*="inclusion"], [class*="meal"], [class*="plan"]'],
    taxInclusive: false,
  },
  'The Tamara Kodai': {
    url: (ci, co) => `https://www.thetamara.com/kodaikanal/rooms-rates/?checkin=${ci}&checkout=${co}&adults=2`,
    priceSelectors: ['[class*="rate"], [class*="price"], .room-rate'],
    roomSelectors: ['[class*="room-name"], h2, h3'],
    inclSelectors: ['[class*="inclusion"], [class*="meal"], .plan-tag'],
    taxInclusive: false,
  },
  'Hotel Kodai International': {
    url: (ci, co) => `https://www.hotelkodaiinternational.com/rooms/?checkin=${ci}&checkout=${co}&adults=2`,
    priceSelectors: ['[class*="price"], [class*="rate"]'],
    roomSelectors: ['h3, h4, [class*="room"]'],
    inclSelectors: ['[class*="meal"], [class*="plan"], [class*="include"]'],
    taxInclusive: false,
  },
  // 'Sterling Kodai Lake' deliberately omitted — see DISABLED_OFFICIAL
  'Le Poshe by Sparsa': {
    url: (ci, co) => `https://www.sparsahotels.com/le-poshe/rooms/?checkin=${ci}&checkout=${co}&adults=2`,
    priceSelectors: ['[class*="price"], [class*="rate"]'],
    roomSelectors: ['[class*="room-name"], h3'],
    inclSelectors: ['[class*="meal"], [class*="plan"], [class*="include"]'],
    taxInclusive: false,
  },
};

export class OfficialScraper extends BaseScraper {
  private readonly hotelName: string;

  constructor(hotelName: string) {
    super({ maxRetries: 2, timeout: 35000 });
    this.hotelName = hotelName;
  }

  get source(): string { return `official:${this.hotelName.toLowerCase().replace(/\s+/g, '-')}`; }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const config = OFFICIAL_CONFIGS[hotelName];
    if (!config) return [];

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const ci = this.formatDate(checkIn);
      const co = this.formatDate(checkOut);
      const url = config.url(ci, co);

      // 'networkidle' hangs on hotel booking engines that keep long-polling.
      // 'domcontentloaded' fires as soon as DOM is ready — sufficient for prices.
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      await sleep(4000);

      // Try to find room listings
      const roomEls = await page.$$(config.roomSelectors.join(', '));

      if (roomEls.length > 0) {
        for (const roomEl of roomEls) {
          try {
            const roomName = (await roomEl.textContent())?.trim() || 'Standard Room';

            // Find nearest price sibling/parent
            const parentCard = await roomEl.evaluateHandle(el => {
              let p = el.parentElement;
              for (let i = 0; i < 4; i++) {
                if (p && (p.querySelector('[class*="price"]') || p.querySelector('[class*="rate"]'))) return p;
                p = p?.parentElement || null;
              }
              return el.closest('[class*="room"], [class*="package"]') ?? el;
            });

            const priceEl = await (parentCard as any).$([...config.priceSelectors].join(', '));
            const priceText = await priceEl?.textContent();
            const price = this.extractPrice(priceText || '');

            const inclEl = await (parentCard as any).$([...config.inclSelectors].join(', '));
            const inclText = (await inclEl?.textContent())?.toLowerCase() || '';

            if (price && price > 1000) {
              const meal = classifyMealPlan(inclText, roomName);
              if (meal.shouldReject) continue;

              const normalized = normalizeTaxInclusive(price, config.taxInclusive);

              rates.push({
                hotelName,
                roomType: roomName,
                mapRate: meal.isMapEligible ? normalized : null,
                cpRate: meal.plan === 'CP' ? normalized : null,
                epRate: meal.plan === 'EP' || meal.plan === 'UNKNOWN' ? normalized : null,
                taxPercent: 18,
                taxInclusive: config.taxInclusive,
                totalWithTax: normalized,
                source: this.source,
                sourceUrl: url,
                isAvailable: true,
                breakfastIncluded: meal.breakfastIncluded,
                dinnerIncluded: meal.dinnerIncluded,
                lunchIncluded: meal.lunchIncluded,
                mealDetails: inclText || undefined,
                freeCancellation: false,
                hasDiscount: false,
                occupancy: 2,
                scrapedAt: new Date(),
                // Official sites get highest base confidence
                confidence: meal.confidence * 0.98,
              });
            }
          } catch { /* skip malformed */ }
        }
      }

      // Fallback: any price text on page
      if (rates.length === 0) {
        for (const sel of config.priceSelectors) {
          const el = await page.$(sel);
          const price = this.extractPrice((await el?.textContent()) || '');
          if (price && price > 1000) {
            rates.push({
              hotelName, roomType: 'Standard Room',
              mapRate: null, cpRate: null, epRate: normalizeTaxInclusive(price, config.taxInclusive),
              taxPercent: 18, taxInclusive: config.taxInclusive,
              totalWithTax: normalizeTaxInclusive(price, config.taxInclusive),
              source: this.source, sourceUrl: url, isAvailable: true,
              breakfastIncluded: false, dinnerIncluded: false, lunchIncluded: false,
              freeCancellation: false, hasDiscount: false,
              occupancy: 2, scrapedAt: new Date(), confidence: 0.70,
            });
            break;
          }
        }
      }
    } catch (err) {
      console.error(`[official:${hotelName}] Failed:`, err);
      throw err;
    } finally {
      await page.close();
    }

    return rates;
  }
}

// Factory — creates scrapers only for active (non-disabled) hotels
export function createOfficialScrapers(): OfficialScraper[] {
  for (const [hotel, reason] of Object.entries(DISABLED_OFFICIAL)) {
    console.log(`[official] Skipping ${hotel}: ${reason}`);
  }
  return Object.keys(OFFICIAL_CONFIGS).map(name => new OfficialScraper(name));
}
