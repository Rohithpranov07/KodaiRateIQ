// ============================================================
// KodaiRateIQ — Base Scraper Class
// ============================================================
import * as fs from 'fs';
import * as path from 'path';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { ScrapedRate, ScrapeResult, ScraperConfig, ScraperDiagnostics } from '@/types';
import { sleep } from '@/lib/utils';

const DEBUG_DIR = '/tmp/kodairate-debug';

// Patterns that indicate a bot-challenge / blocked page
const BOT_INDICATORS = [
  'captcha', 'verify you are human', 'access denied', 'cloudflare',
  'datadome', 'akamai', 'unusual traffic', 'robot check',
  'just a moment', 'checking your browser', 'enable javascript and cookies',
  'too many requests', 'rate limited', 'forbidden',
  'sorry, you have been blocked', 'attention required',
  'security check', 'ddos-guard', 'are you a bot',
  'please wait while we check', 'browser check',
];

// Minimum page sizes to consider a page real (not bot-blocked)
const MIN_HTML_BYTES = 8000;
const MIN_BODY_CHARS = 400;

const RETRYABLE_ERRORS = [
  'ERR_NAME_NOT_RESOLVED',
  'ERR_CONNECTION_REFUSED',
  'ERR_CONNECTION_TIMED_OUT',
  'ERR_TIMED_OUT',
  'ERR_HTTP2_PROTOCOL_ERROR',
  'net::ERR',
  'Navigation timeout',
  'Timeout',
  'exceeded',
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

export class BotBlockedError extends Error {
  readonly blockReason: string;
  constructor(reason: string, context: string) {
    super(`BOT_BLOCKED: ${reason} — ${context}`);
    this.name = 'BotBlockedError';
    this.blockReason = reason;
  }
}

function isRetryable(err: Error): boolean {
  if (err.name === 'BotBlockedError') return false;  // Never retry bot blocks — wastes time
  if (err.message.startsWith('PAGE_TOO_SMALL:')) return false;
  return RETRYABLE_ERRORS.some(pat => err.message.includes(pat));
}

function isBrowserFatal(err: Error): boolean {
  return BROWSER_FATAL_ERRORS.some(pat => err.message.includes(pat));
}

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Browser singleton ─────────────────────────────────────────
// Browser process is shared; each execute() call gets its own BrowserContext
// so a reset or failure in one scraper never kills concurrent scrapers.
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
          '--disable-features=IsolateOrigins,site-per-process',
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
      extraHTTPHeaders: {
        'accept-language': 'en-IN,en;q=0.9,hi;q=0.8',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
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
    try { if (this.browser) await this.browser.close(); } catch { /* ignore */ }
    this.browser = null;
    this.launchPromise = null;
  }
}

export const browserManager = BrowserManager.getInstance();

// ── Base scraper ──────────────────────────────────────────────
export abstract class BaseScraper {
  protected config: ScraperConfig;
  private _context: BrowserContext | null = null;
  // Set by navigate() — readable by execute() to attach to ScrapeResult
  protected _lastDiag: ScraperDiagnostics | null = null;

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };
    });
    return page;
  }

  // Navigate, wait for content, then collect full page diagnostics.
  // Throws BotBlockedError if the page is clearly a challenge page — non-retryable.
  protected async navigate(page: Page, url: string): Promise<void> {
    await page.waitForTimeout(1500 + Math.random() * 3000);

    const navStart = Date.now();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      // Let network settle up to 8s (caps on long-polling sites)
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => null);
    } catch (e: any) {
      if (e?.message?.includes('Timeout') || e?.message?.includes('exceeded')) {
        // Already on domcontentloaded, just give JS time to render
        await page.waitForTimeout(3000);
      } else {
        throw e;
      }
    }
    const navigationMs = Date.now() - navStart;

    // ── Collect page diagnostics ──────────────────────────────
    let pageTitle = '';
    let finalUrl = page.url();
    let htmlSize = 0;
    let bodyText = '';

    try { pageTitle = await page.title(); } catch { /* ignore */ }
    try { finalUrl = page.url(); } catch { /* ignore */ }
    try {
      const html = await page.content();
      htmlSize = html.length;
    } catch { /* ignore */ }
    try {
      bodyText = await page.evaluate(
        () => (document.body?.innerText || '').substring(0, 3000)
      );
    } catch { /* ignore */ }

    const bodyTextLength = bodyText.length;
    const titleLower = pageTitle.toLowerCase();
    const bodyLower = bodyText.toLowerCase();
    const combined = titleLower + ' ' + bodyLower;

    // Bot / challenge detection
    let botBlocked = false;
    let blockReason: string | null = null;
    for (const ind of BOT_INDICATORS) {
      if (combined.includes(ind)) {
        botBlocked = true;
        blockReason = `keyword:${ind}`;
        break;
      }
    }
    if (!botBlocked && htmlSize > 0 && htmlSize < MIN_HTML_BYTES) {
      botBlocked = true;
      blockReason = `page_too_small:${htmlSize}bytes`;
    }
    if (!botBlocked && bodyTextLength < MIN_BODY_CHARS) {
      botBlocked = true;
      blockReason = `body_too_small:${bodyTextLength}chars`;
    }

    // Extract sample prices from raw body text
    const priceMatches = bodyText.match(/(?:₹|INR|Rs\.?)\s*([\d,]+)/g) || [];
    const samplePrices = priceMatches.slice(0, 8);
    const hasPriceSymbol = priceMatches.length > 0 || bodyText.includes('₹') || bodyText.includes('INR');

    this._lastDiag = {
      source: this.source,
      hotelName: '(pending)',
      url,
      finalUrl,
      pageTitle,
      htmlSize,
      bodyTextLength,
      hasPriceSymbol,
      botBlocked,
      blockReason,
      sampleBodyText: bodyText.substring(0, 500).replace(/\n+/g, ' '),
      samplePrices,
      navigationMs,
      ratesExtracted: 0,
      screenshotPath: null,
    };

    // Always log — visible in Railway logs for every navigation
    console.log(JSON.stringify({
      event: 'PAGE_DIAG',
      source: this.source,
      url: finalUrl.substring(0, 120),
      pageTitle: pageTitle.substring(0, 80),
      htmlSize,
      bodyTextLength,
      hasPriceSymbol,
      botBlocked,
      blockReason,
      navigationMs,
      samplePrices: samplePrices.slice(0, 5),
    }));

    if (botBlocked) {
      const art = await this.captureDebugArtifacts(page, this.source, blockReason ?? 'blocked');
      if (art.screenshotPath) this._lastDiag.screenshotPath = art.screenshotPath;
      console.warn(`[${this.source}] BOT_BLOCK detected — ${blockReason} — html=${htmlSize}B title="${pageTitle.substring(0, 60)}"`);
      throw new BotBlockedError(blockReason!, `html=${htmlSize}B,title=${pageTitle.substring(0, 50)}`);
    }
  }

  // Capture screenshot + HTML dump to /tmp for post-mortem debugging
  protected async captureDebugArtifacts(
    page: Page, source: string, label: string
  ): Promise<{ screenshotPath: string | null }> {
    const result = { screenshotPath: null as string | null };
    try {
      fs.mkdirSync(DEBUG_DIR, { recursive: true });
      const ts = Date.now();
      const safe = source.replace(/[^a-z0-9]/gi, '_');
      const safeLabel = (label || 'debug').replace(/[^a-z0-9]/gi, '_').substring(0, 40);
      const screenshotPath = path.join(DEBUG_DIR, `${safe}-${safeLabel}-${ts}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      result.screenshotPath = screenshotPath;
      const htmlPath = path.join(DEBUG_DIR, `${safe}-${safeLabel}-${ts}.html`);
      fs.writeFileSync(htmlPath, await page.content());
      console.log(`[${source}] debug artifacts: ${screenshotPath}`);
    } catch { /* /tmp might not be writable in all envs */ }
    return result;
  }

  // Universal price scanner via raw innerText — independent of CSS selectors.
  // Used as the ultimate fallback when structured selectors return nothing.
  protected async evaluatePrices(page: Page): Promise<number[]> {
    try {
      return await page.evaluate(() => {
        const text = (document.body?.innerText || '') + ' ' + (document.body?.textContent || '');
        const found: number[] = [];
        const p1 = text.match(/(?:₹|INR|Rs\.?)\s*([\d,]+)/g) || [];
        for (const m of p1) {
          const n = parseInt(m.replace(/[^0-9]/g, ''), 10);
          if (n >= 1500 && n <= 300000) found.push(n);
        }
        const p2 = text.match(/[\d,]{4,7}(?:\s*(?:per night|\/night|nett|net rate|room rate))/gi) || [];
        for (const m of p2) {
          const n = parseInt(m.replace(/[^0-9]/g, ''), 10);
          if (n >= 1500 && n <= 300000) found.push(n);
        }
        return [...new Set(found)].sort((a, b) => a - b);
      });
    } catch { return []; }
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
    let lastDiag: ScraperDiagnostics | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      this._lastDiag = null;

      try {
        this._context = await browserManager.newContext();
      } catch (ctxErr) {
        lastError = ctxErr as Error;
        console.error(`[${this.source}] ctx_create_failed attempt=${attempt + 1} hotel=${hotelName}: ${lastError.message}`);
        await browserManager.resetBrowser();
        if (attempt < this.config.maxRetries) {
          await sleep(this.config.retryDelay * Math.pow(2, attempt));
          continue;
        }
        break;
      }

      try {
        console.log(`[${this.source}] scrape_start attempt=${attempt + 1} hotel=${hotelName}`);
        const rates = await this.scrapeHotel(hotelName, checkIn, checkOut);

        // Read into typed local — avoids TS narrowing this._lastDiag to never
        const diag = this._lastDiag as ScraperDiagnostics | null;
        if (diag) {
          diag.hotelName = hotelName;
          diag.ratesExtracted = rates.length;
          lastDiag = diag;
        }

        const ms = Date.now() - startTime;
        console.log(`[${this.source}] scrape_done hotel=${hotelName} rates=${rates.length} ms=${ms}`);

        if (rates.length === 0) {
          console.warn(JSON.stringify({
            event: 'ZERO_RATES',
            source: this.source,
            hotelName,
            htmlSize: lastDiag?.htmlSize,
            hasPriceSymbol: lastDiag?.hasPriceSymbol,
            pageTitle: lastDiag?.pageTitle,
            samplePrices: lastDiag?.samplePrices,
            sampleBodyText: (lastDiag?.sampleBodyText ?? '').substring(0, 200),
          }));
        }

        return {
          success: true,
          source: this.source,
          hotelName,
          rates,
          duration: ms,
          retryCount: attempt,
          diagnostics: lastDiag ?? undefined,
        };
      } catch (error) {
        lastError = error as Error;

        // Read into typed local — avoids TS narrowing to never
        const diagErr = this._lastDiag as ScraperDiagnostics | null;
        if (diagErr) {
          diagErr.hotelName = hotelName;
          lastDiag = diagErr;
        }

        const retryable = isRetryable(lastError);
        const isBotBlock = lastError.name === 'BotBlockedError';

        console.error(JSON.stringify({
          event: isBotBlock ? 'BOT_BLOCK' : 'SCRAPE_ERROR',
          source: this.source,
          hotelName,
          attempt: attempt + 1,
          error: lastError.message.substring(0, 250),
          retryable,
          htmlSize: diagErr?.htmlSize,
          pageTitle: (diagErr?.pageTitle ?? '').substring(0, 60),
        }));

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
      diagnostics: lastDiag ?? undefined,
    };
  }

  async cleanup(): Promise<void> { await this.closeContext(); }

  protected extractPrice(text: string): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[₹,\s]/g, '').replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  protected formatDate(date: Date): string { return date.toISOString().split('T')[0]; }

  protected async rateLimitWait(): Promise<void> {
    await sleep((60 / this.config.rateLimit) * 1000);
  }
}
