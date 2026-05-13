// ============================================================
// KodaiRateIQ — Base Scraper Class
// ============================================================

// Type-only imports at module level — no playwright/stealth code runs at build time
import type { Browser, BrowserContext, Page } from 'playwright';
import type { ScrapedRate, ScrapeResult, ScraperConfig } from '@/types';
import { sleep } from '@/lib/utils';

// Network errors worth retrying
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
  'browserContext.newPage',
  'Cannot read properties of null',
];

// Errors that indicate the browser process itself crashed — need a full restart
const BROWSER_FATAL_ERRORS = [
  'Target page, context or browser has been closed',
  'browserType.launch',
  'browserContext.newPage',
  'Cannot read properties of null',
];

function isRetryable(err: Error): boolean {
  return RETRYABLE_ERRORS.some(pat => err.message.includes(pat));
}

function isBrowserFatal(err: Error): boolean {
  return BROWSER_FATAL_ERRORS.some(pat => err.message.includes(pat));
}

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Browser singleton ─────────────────────────────────────────
// Only the Browser process is shared. Each scraper execution gets
// its own BrowserContext so that a reset or failure in one scraper
// never kills pages owned by another concurrent scraper.
class BrowserManager {
  private static instance: BrowserManager | null = null;
  private browser: Browser | null = null;
  private launchPromise: Promise<Browser> | null = null;

  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) BrowserManager.instance = new BrowserManager();
    return BrowserManager.instance;
  }

  async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    if (this.launchPromise) return this.launchPromise;

    this.launchPromise = (async () => {
      // Dynamic requires — never evaluated during Next.js build phase
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { chromium } = require('playwright-extra');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const StealthPlugin = require('puppeteer-extra-plugin-stealth');
      chromium.use(StealthPlugin());

      const browser: Browser = await chromium.launch({
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

      // Auto-clear when Chromium process exits unexpectedly
      browser.on('disconnected', () => {
        this.browser = null;
        this.launchPromise = null;
      });

      this.browser = browser;
      this.launchPromise = null;
      return browser;
    })();

    return this.launchPromise;
  }

  // Creates an isolated context — safe to close without affecting other scrapers
  async newContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    const ctx = await browser.newContext({
      userAgent: CHROME_UA,
      viewport: { width: 1366, height: 768 },
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
      extraHTTPHeaders: { 'accept-language': 'en-IN,en;q=0.9' },
    });

    // Block non-essential resources per context
    await ctx.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot,ico}', r => r.abort());
    await ctx.route('**/analytics**', r => r.abort());
    await ctx.route('**/tracking**', r => r.abort());
    await ctx.route('**/ads/**', r => r.abort());
    await ctx.route('**/gtm.js**', r => r.abort());
    await ctx.route('**/fbevents**', r => r.abort());

    return ctx;
  }

  // Only called when the browser process itself has crashed
  async resetBrowser(): Promise<void> {
    try {
      if (this.browser) await this.browser.close();
    } catch { /* ignore */ }
    this.browser = null;
    this.launchPromise = null;
  }
}

export const browserManager = BrowserManager.getInstance();

// ── Base scraper ──────────────────────────────────────────────
export abstract class BaseScraper {
  protected config: ScraperConfig;
  // Each execute() call owns its own context; never shared across concurrent scrapers
  private _context: BrowserContext | null = null;

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
    if (!this._context) throw new Error('No browser context — call execute() first');
    const page = await this._context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(60000);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en-US', 'en'] });
    });
    return page;
  }

  private async closeContext(): Promise<void> {
    if (this._context) {
      try { await this._context.close(); } catch { /* ignore */ }
      this._context = null;
    }
  }

  async execute(hotelName: string, checkIn: Date, checkOut: Date): Promise<ScrapeResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      // Fresh isolated context every attempt — closing it never affects other scrapers
      try {
        this._context = await browserManager.newContext();
      } catch (ctxErr) {
        lastError = ctxErr as Error;
        console.error(`[${this.source}] Attempt ${attempt + 1} — context creation failed for ${hotelName}: ${lastError.message}`);
        await browserManager.resetBrowser();
        if (attempt < this.config.maxRetries) {
          await sleep(this.config.retryDelay * Math.pow(2, attempt));
          continue;
        }
        break;
      }

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
          // Only restart the browser process on fatal browser crashes
          if (isBrowserFatal(lastError)) await browserManager.resetBrowser();
        }
      } finally {
        // Always close our context — never leaks, never affects other scrapers
        await this.closeContext();
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
    await this.closeContext();
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
