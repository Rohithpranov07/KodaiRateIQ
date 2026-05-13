// ============================================================
// KodaiRateIQ — Base Scraper Class
// ============================================================

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { ScrapedRate, ScrapeResult, ScraperConfig } from '@/types';
import { getRandomUserAgent, sleep } from '@/lib/utils';

// DNS / network error patterns that are worth retrying
const RETRYABLE_ERRORS = [
  'ERR_NAME_NOT_RESOLVED',
  'ERR_CONNECTION_REFUSED',
  'ERR_CONNECTION_TIMED_OUT',
  'ERR_TIMED_OUT',
  'net::ERR',
  'Navigation timeout',
  'Target page, context or browser has been closed',
  'browserType.launch',
];

function isRetryable(err: Error): boolean {
  return RETRYABLE_ERRORS.some(pat => err.message.includes(pat));
}

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
   * Launch Playwright's bundled Chromium with minimal stable args.
   *
   *  chromiumSandbox: false  → disables sandbox (required in any unprivileged
   *                            container; equivalent to --no-sandbox internally)
   *  --disable-dev-shm-usage → /dev/shm is too small in Railway (64 MB default)
   *  --disable-gpu           → no GPU available in Railway
   *
   * REMOVED (caused SIGTRAP / crashpad crash in Railway):
   *  --single-process, --no-zygote, --no-sandbox (covered by chromiumSandbox),
   *  --disable-setuid-sandbox, --disable-background-networking,
   *  --disable-extensions, executablePath / CHROMIUM_PATH
   */
  protected async launchBrowser(): Promise<void> {
    if (this.browser) return;

    this.browser = await chromium.launch({
      headless: true,
      chromiumSandbox: false,
      args: [
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

    // Block non-essential resources — cuts bandwidth and speeds scraping
    await this.context.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot,ico}', r => r.abort());
    await this.context.route('**/analytics**', r => r.abort());
    await this.context.route('**/tracking**', r => r.abort());
    await this.context.route('**/ads/**', r => r.abort());
    await this.context.route('**/gtm.js**', r => r.abort());
    await this.context.route('**/fbevents**', r => r.abort());
  }

  protected async newPage(): Promise<Page> {
    if (!this.context) await this.launchBrowser();

    const page = await this.context!.newPage();

    // Explicit timeout setters — applied on EVERY page
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(45000);

    // Anti-detection fingerprint suppression
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en-US', 'en'] });
    });

    return page;
  }

  /**
   * Execute scraping with retry logic.
   * Only retries on DNS/network errors — not on selector or logic failures.
   */
  async execute(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapeResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;

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
        const retryable = isRetryable(lastError);
        console.error(
          `[${this.source}] Attempt ${attempt + 1} failed for ${hotelName}: ${lastError.message}` +
          (retryable ? ' (retryable)' : ' (not retryable — stopping)')
        );

        if (!retryable) break; // selector / logic bugs — don't waste retries

        if (attempt < this.config.maxRetries) {
          // Exponential backoff with ±500ms jitter
          const jitter = Math.random() * 500;
          await sleep(this.config.retryDelay * Math.pow(2, attempt) + jitter);
          // Reset browser on network failures so we get a clean socket
          await this.cleanup();
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
    try {
      if (this.context) { await this.context.close(); this.context = null; }
      if (this.browser)  { await this.browser.close();  this.browser  = null; }
    } catch (e) {
      console.error('[BaseScraper] Cleanup error:', e);
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
