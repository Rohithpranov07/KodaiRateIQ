// ============================================================
// KodaiRateIQ — Base Scraper Class
// ============================================================

// Type-only imports at module level — no playwright/stealth code runs at build time
import type { Browser, BrowserContext, Page } from 'playwright';
import type { ScrapedRate, ScrapeResult, ScraperConfig } from '@/types';
import { sleep } from '@/lib/utils';

const RETRYABLE_ERRORS = [
  'ERR_NAME_NOT_RESOLVED',
  'ERR_CONNECTION_REFUSED',
  'ERR_CONNECTION_TIMED_OUT',
  'ERR_TIMED_OUT',
  'ERR_HTTP2_PROTOCOL_ERROR',
  'net::ERR',
  'Navigation timeout',
  'Timeout',           // Playwright throws "Timeout Xms exceeded"
  'exceeded',          // covers both navigation and waitFor timeouts
  'Target page, context or browser has been closed',
  'browserType.launch',
  'browserContext.newPage',
  'Cannot read properties of null',
];

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

  async newContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    const ctx = await browser.newContext({
      userAgent: CHROME_UA,
      viewport: { width: 1366, height: 768 },
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
      extraHTTPHeaders: { 'accept-language': 'en-IN,en;q=0.9' },
    });

    await ctx.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot,ico}', r => r.abort());
    await ctx.route('**/analytics**', r => r.abort());
    await ctx.route('**/tracking**', r => r.abort());
    await ctx.route('**/ads/**', r => r.abort());
    await ctx.route('**/gtm.js**', r => r.abort());
    await ctx.route('**/fbevents**', r => r.abort());

    return ctx;
  }

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

  // Human-like pre-delay + networkidle navigation with domcontentloaded fallback.
  // Sites that keep long-polling (e.g. yatra) never reach networkidle → would timeout.
  // The fallback ensures navigation succeeds even for those sites.
  protected async navigate(page: Page, url: string): Promise<void> {
    await page.waitForTimeout(1000 + Math.random() * 2000);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    } catch (e: any) {
      if (e?.message?.includes('Timeout') || e?.message?.includes('exceeded')) {
        // networkidle timed out — fall back to domcontentloaded + extra render time
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
      } else {
        throw e;
      }
    }
  }

  // Universal price scanner: extracts all ₹/INR/Rs amounts from raw page text.
  // Works regardless of CSS selector changes. Used as ultimate fallback.
  protected async evaluatePrices(page: Page): Promise<number[]> {
    try {
      return await page.evaluate(() => {
        const text = (document.body?.innerText || '') + ' ' + (document.body?.textContent || '');
        const found: number[] = [];
        const patterns = text.match(/(?:₹|INR|Rs\.?)\s*([\d,]+)/g) || [];
        for (const p of patterns) {
          const n = parseInt(p.replace(/[^0-9]/g, ''), 10);
          if (n >= 1500 && n <= 300000) found.push(n);
        }
        // Also catch plain numbers in INR range that appear near "per night" context
        const contextMatches = text.match(/[\d,]{4,7}(?:\s*(?:per night|\/night|nett|net|room))/gi) || [];
        for (const m of contextMatches) {
          const n = parseInt(m.replace(/[^0-9]/g, ''), 10);
          if (n >= 1500 && n <= 300000) found.push(n);
        }
        return [...new Set(found)].sort((a, b) => a - b);
      });
    } catch {
      return [];
    }
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
          if (isBrowserFatal(lastError)) await browserManager.resetBrowser();
        }
      } finally {
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
