// ============================================================
// KodaiRateIQ — Base Scraper Class
// ============================================================

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { ScrapedRate, ScrapeResult, ScraperConfig } from '@/types';
import { getRandomUserAgent, sleep } from '@/lib/utils';

/**
 * Abstract base class for all hotel rate scrapers.
 * Provides browser management, retry logic, and error handling.
 */
export abstract class BaseScraper {
  protected config: ScraperConfig;
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;

  constructor(config?: Partial<ScraperConfig>) {
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      retryDelay: config?.retryDelay ?? 2000,
      timeout: config?.timeout ?? 30000,
      headless: config?.headless ?? true,
      userAgents: config?.userAgents ?? [],
      rateLimit: config?.rateLimit ?? 10,
    };
  }

  /**
   * Source identifier (e.g., "booking.com", "goibibo")
   */
  abstract get source(): string;

  /**
   * Scrape rates for a specific hotel
   */
  abstract scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]>;

  /**
   * Launch browser instance
   */
  protected async launchBrowser(): Promise<void> {
    if (this.browser) return;

    // In Docker/Railway, use the system Chromium installed by the Dockerfile.
    // CHROMIUM_PATH is set to /usr/bin/chromium-browser in the base image.
    const executablePath = process.env.CHROMIUM_PATH || undefined;

    this.browser = await chromium.launch({
      headless: this.config.headless,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--single-process',           // required in constrained containers
        '--no-zygote',                // prevents zygote sandbox crash
        '--disable-background-networking',
        '--disable-extensions',
      ],
    });

    const userAgent = getRandomUserAgent();
    this.context = await this.browser.newContext({
      userAgent,
      viewport: { width: 1920, height: 1080 },
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
    });

    // Block unnecessary resources to speed up scraping
    await this.context.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot}', route => route.abort());
    await this.context.route('**/analytics**', route => route.abort());
    await this.context.route('**/tracking**', route => route.abort());
  }

  /**
   * Create a new page with anti-detection measures
   */
  protected async newPage(): Promise<Page> {
    if (!this.context) {
      await this.launchBrowser();
    }

    const page = await this.context!.newPage();
    page.setDefaultTimeout(this.config.timeout);

    // Anti-detection: Override navigator properties
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en-US', 'en'] });
    });

    return page;
  }

  /**
   * Execute scraping with retry logic
   */
  async execute(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapeResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        await this.launchBrowser();
        
        const rates = await this.scrapeHotel(hotelName, checkIn, checkOut);
        
        return {
          success: true,
          source: this.source,
          hotelName,
          rates,
          duration: Date.now() - startTime,
          retryCount: attempt,
        };
      } catch (error) {
        lastError = error as Error;
        retryCount = attempt;
        console.error(`[${this.source}] Attempt ${attempt + 1} failed for ${hotelName}:`, (error as Error).message);

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await sleep(delay);
        }
      }
    }

    return {
      success: false,
      source: this.source,
      hotelName,
      rates: [],
      duration: Date.now() - startTime,
      error: lastError?.message ?? 'Unknown error',
      retryCount,
    };
  }

  /**
   * Clean up browser resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (e) {
      console.error('Browser cleanup error:', e);
    }
  }

  /**
   * Extract price from text (handles ₹, commas, etc.)
   */
  protected extractPrice(text: string): number | null {
    if (!text) return null;
    // Remove currency symbols, commas, and whitespace
    const cleaned = text.replace(/[₹,\s]/g, '').replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Format date for URL parameters
   */
  protected formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Wait for rate-limiting
   */
  protected async rateLimitWait(): Promise<void> {
    const delay = (60 / this.config.rateLimit) * 1000;
    await sleep(delay);
  }
}
