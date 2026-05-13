// ============================================================
// KodaiRateIQ — Base Scraper Class
// ============================================================

import { chromium } from 'playwright-extra';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
import type { Browser, BrowserContext, Page } from 'playwright';
import type { ScrapedRate, ScrapeResult, ScraperConfig } from '@/types';
import { sleep } from '@/lib/utils';

chromium.use(StealthPlugin());

const RETRYABLE_ERRORS = [
  'ERR_NAME_NOT_RESOLVED',
  'ERR_CONNECTION_REFUSED',
  'ERR_CONNECTION_TIMED_OUT',
  'ERR_TIMED_OUT',
  'ERR_HTTP2_PROTOCOL_ERROR',
  'net::ERR',
  'Navigation timeout',
  'Target page, context or browser has been closed',
  'browserType.launch',
];

function isRetryable(err: Error): boolean {
  return RETRYABLE_ERRORS.some(pat => err.message.includes(pat));
}

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Singleton browser manager ─────────────────────────────────
class BrowserManager {
  private static instance: BrowserManager | null = null;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private initPromise: Promise<void> | null = null;

  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  async init(): Promise<void> {
    if (this.browser) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.browser = await chromium.launch({
        headless: true,
        chromiumSandbox: false,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-http2',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      this.context = await this.browser.newContext({
        userAgent: CHROME_UA,
        viewport: { width: 1366, height: 768 },
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        extraHTTPHeaders: {
          'accept-language': 'en-IN,en;q=0.9',
        },
      });

      await this.context.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot,ico}', r => r.abort());
      await this.context.route('**/analytics**', r => r.abort());
      await this.context.route('**/tracking**', r => r.abort());
      await this.context.route('**/ads/**', r => r.abort());
      await this.context.route('**/gtm.js**', r => r.abort());
      await this.context.route('**/fbevents**', r => r.abort());
    })();

    await this.initPromise;
    this.initPromise = null;
  }

  async getPage(): Promise<Page> {
    await this.init();

    const page = await this.context!.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(60000);

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en-US', 'en'] });
    });

    return page;
  }

  async reset(): Promise<void> {
    try {
      if (this.context) { await this.context.close(); this.context = null; }
      if (this.browser)  { await this.browser.close();  this.browser  = null; }
    } catch { /* ignore */ }
    this.initPromise = null;
  }
}

export const browserManager = BrowserManager.getInstance();

export abstract class BaseScraper {
  protected config: ScraperConfig;

  constructor(config?: Partial<ScraperConfig>) {
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      retryDelay: config?.retryDelay ?? 2000,
      timeout: config?.timeout ?? 60000,
      headless: config?.headless ?? true,
      userAgents: config?.userAgents ?? [],
      rateLimit: config?.rateLimit ?? 10,
    };
  }

  abstract get source(): string;
  abstract scrapeHotel(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapedRate[]>;

  protected async newPage(): Promise<Page> {
    return browserManager.getPage();
  }

  async execute(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapeResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
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
        const retryable = isRetryable(lastError);
        console.error(
          `[${this.source}] Attempt ${attempt + 1} failed for ${hotelName}: ${lastError.message}` +
          (retryable ? ' (retryable)' : ' (not retryable — stopping)')
        );

        if (!retryable) break;

        if (attempt < this.config.maxRetries) {
          const jitter = Math.random() * 500;
          await sleep(this.config.retryDelay * Math.pow(2, attempt) + jitter);
          await browserManager.reset();
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
      retryCount: this.config.maxRetries,
    };
  }

  async cleanup(): Promise<void> {
    // Cleanup is managed by the singleton; individual scrapers don't own the browser
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
