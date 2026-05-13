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

  abstract get source(): string;
  abstract scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]>;

  /**
   * Launch Playwright's bundled Chromium.
   *
   * NO executablePath — Playwright manages its own Chromium download
   * (installed via `npx playwright install chromium` in Docker).
   *
   * Minimal stable args for Docker/Railway:
   *   --no-sandbox             required in any unprivileged container
   *   --disable-setuid-sandbox required alongside --no-sandbox
   *   --disable-dev-shm-usage  /dev/shm is too small in Railway (64 MB)
   *   --disable-gpu            no GPU in Railway containers
   *
   * REMOVED (caused crashpad / SIGTRAP crash):
   *   --single-process         conflicts with Playwright's process model
   *   --no-zygote              causes crashpad_handler to fail
   */
  protected async launchBrowser(): Promise<void> {
    if (this.browser) return;

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const userAgent = getRandomUserAgent();
    this.context = await this.browser.newContext({
      userAgent,
      viewport: { width: 1920, height: 1080 },
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
    });

    // Block non-essential resources to reduce bandwidth + speed up scraping
    await this.context.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot}', r => r.abort());
    await this.context.route('**/analytics**', r => r.abort());
    await this.context.route('**/tracking**', r => r.abort());
    await this.context.route('**/ads/**', r => r.abort());
  }

  protected async newPage(): Promise<Page> {
    if (!this.context) await this.launchBrowser();

    const page = await this.context!.newPage();
    page.setDefaultTimeout(this.config.timeout);

    // Anti-detection: suppress webdriver fingerprint
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en-US', 'en'] });
    });

    return page;
  }

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
          await sleep(this.config.retryDelay * Math.pow(2, attempt));
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

  async cleanup(): Promise<void> {
    try {
      if (this.context) { await this.context.close(); this.context = null; }
      if (this.browser)  { await this.browser.close();  this.browser  = null; }
    } catch (e) {
      console.error('[BaseScraper] Browser cleanup error:', e);
    }
  }

  protected extractPrice(text: string): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[₹,\s]/g, '').replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  protected formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  protected async rateLimitWait(): Promise<void> {
    await sleep((60 / this.config.rateLimit) * 1000);
  }
}
