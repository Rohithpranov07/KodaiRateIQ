// ============================================================
// KodaiRateIQ — Booking.com Scraper
// ============================================================

import { Page } from 'playwright';
import { BaseScraper } from './base';
import type { ScrapedRate } from '@/types';
import { sleep } from '@/lib/utils';

/**
 * Hotel name to Booking.com URL slug mapping for Kodaikanal hotels
 */
const BOOKING_SLUGS: Record<string, string> = {
  'The Carlton': 'hotel/in/the-carlton-kodaikanal.en-gb',
  'The Tamara Kodai': 'hotel/in/the-tamara-kodaikanal.en-gb',
  'Hotel Kodai International': 'hotel/in/kodai-international.en-gb',
  'Sterling Kodai Lake': 'hotel/in/sterling-kodai-lake.en-gb',
  'Le Poshe by Sparsa': 'hotel/in/le-poshe-by-sparsa.en-gb',
};

export class BookingScraper extends BaseScraper {
  get source(): string {
    return 'booking.com';
  }

  async scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]> {
    const slug = BOOKING_SLUGS[hotelName];
    if (!slug) {
      console.warn(`[booking.com] No slug found for: ${hotelName}`);
      return [];
    }

    const page = await this.newPage();
    const rates: ScrapedRate[] = [];

    try {
      const checkInStr = this.formatDate(checkIn);
      const checkOutStr = this.formatDate(checkOut);
      
      const url = `https://www.booking.com/${slug}?checkin=${checkInStr}&checkout=${checkOutStr}&group_adults=2&no_rooms=1&group_children=0`;
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      await sleep(3000); // Wait for dynamic content

      // Handle cookie consent if present
      try {
        const cookieBtn = page.locator('[id="onetrust-accept-btn-handler"]');
        if (await cookieBtn.isVisible({ timeout: 2000 })) {
          await cookieBtn.click();
          await sleep(1000);
        }
      } catch {
        // Cookie banner not found, continue
      }

      // Wait for room availability table to load
      await page.waitForSelector('[data-testid="property-section--content"]', { timeout: 15000 }).catch(() => null);
      
      // Try to extract room rates
      const roomBlocks = await page.$$('[data-testid="property-section--content"] table tbody tr, .hprt-table tr');
      
      if (roomBlocks.length === 0) {
        // Fallback: try alternative selectors
        const priceElements = await page.$$('.bui-price-display__value, [data-testid="price-and-discounted-price"]');
        
        for (const priceEl of priceElements) {
          const priceText = await priceEl.textContent();
          const price = this.extractPrice(priceText || '');
          
          if (price && price > 1000) {
            rates.push(this.createRate(hotelName, 'Standard Room', price, checkIn));
          }
        }
      } else {
        for (const block of roomBlocks) {
          try {
            // Extract room name
            const roomNameEl = await block.$('.hprt-roomtype-icon-link, [data-testid="room-type"]');
            const roomName = (await roomNameEl?.textContent())?.trim() || 'Standard Room';
            
            // Extract price
            const priceEl = await block.$('.bui-price-display__value, .prco-valign-middle-helper');
            const priceText = await priceEl?.textContent();
            const price = this.extractPrice(priceText || '');
            
            // Extract meal plan
            const mealEl = await block.$('.hprt-roomtype-meal, [data-testid="inclusion"]');
            const mealText = (await mealEl?.textContent())?.toLowerCase() || '';
            
            // Extract cancellation
            const cancelEl = await block.$('.hprt-roomtype-cancellation');
            const cancelText = (await cancelEl?.textContent())?.trim() || '';
            
            if (price && price > 1000) {
              const breakfastIncluded = mealText.includes('breakfast');
              const dinnerIncluded = mealText.includes('dinner') || mealText.includes('half board');
              const isMap = breakfastIncluded && dinnerIncluded;
              
              rates.push({
                hotelName,
                roomType: roomName,
                mapRate: isMap ? price : null,
                cpRate: breakfastIncluded && !dinnerIncluded ? price : null,
                epRate: !breakfastIncluded ? price : null,
                taxPercent: 18,
                taxInclusive: true, // Booking.com typically shows tax-inclusive
                totalWithTax: price,
                source: this.source,
                sourceUrl: url,
                isAvailable: true,
                breakfastIncluded,
                dinnerIncluded,
                lunchIncluded: false,
                mealDetails: mealText || undefined,
                cancellationPolicy: cancelText || undefined,
                freeCancellation: cancelText.toLowerCase().includes('free'),
                hasDiscount: false,
                occupancy: 2,
                scrapedAt: new Date(),
                confidence: 0.85,
              });
            }
          } catch (blockError) {
            console.warn('[booking.com] Error parsing room block:', blockError);
          }
        }
      }

      // If we still have no rates, try the main price display
      if (rates.length === 0) {
        const mainPrice = await page.$('.hp-group-header__price__from, [data-testid="price-for-x-nights"]');
        const mainPriceText = await mainPrice?.textContent();
        const price = this.extractPrice(mainPriceText || '');
        
        if (price && price > 1000) {
          rates.push(this.createRate(hotelName, 'Best Available', price, checkIn));
        }
      }
    } catch (error) {
      console.error(`[booking.com] Scraping failed for ${hotelName}:`, error);
      throw error;
    } finally {
      await page.close();
    }

    return rates;
  }

  private createRate(hotelName: string, roomType: string, price: number, date: Date): ScrapedRate {
    return {
      hotelName,
      roomType,
      mapRate: null,
      cpRate: null,
      epRate: price,
      taxPercent: 18,
      taxInclusive: true,
      totalWithTax: price,
      source: this.source,
      isAvailable: true,
      breakfastIncluded: false,
      dinnerIncluded: false,
      lunchIncluded: false,
      freeCancellation: false,
      hasDiscount: false,
      occupancy: 2,
      scrapedAt: new Date(),
      confidence: 0.7,
    };
  }
}
