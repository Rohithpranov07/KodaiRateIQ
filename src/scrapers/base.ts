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
  'please complete the security check',
];

// Reduced thresholds — original 8000/400 were too strict for SPA shells
const MIN_HTML_BYTES = 3000;
const MIN_BODY_CHARS = 150;

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
  if (err.name === 'BotBlockedError') return false;
  if (err.message.startsWith('PAGE_TOO_SMALL:')) return false;
  return RETRYABLE_ERRORS.some(pat => err.message.includes(pat));
}

function isBrowserFatal(err: Error): boolean {
  return BROWSER_FATAL_ERRORS.some(pat => err.message.includes(pat));
}

// Rotate through multiple realistic User-Agent strings to reduce fingerprinting
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

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
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-web-security',
          '--window-size=1366,768',
          '--lang=en-IN',
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
    const ua = randomUA();
    const ctx = await browser.newContext({
      userAgent: ua,
      viewport: { width: 1366, height: 768 },
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
      extraHTTPHeaders: {
        'accept-language': 'en-IN,en;q=0.9,hi;q=0.8',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-encoding': 'gzip, deflate, br',
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'upgrade-insecure-requests': '1',
      },
    });

    // Block heavy assets that add no value to scraping
    await ctx.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot,ico,mp4,webp}', r => r.abort());
    await ctx.route('**/analytics**', r => r.abort());
    await ctx.route('**/tracking**', r => r.abort());
    await ctx.route('**/ads/**', r => r.abort());
    await ctx.route('**/gtm.js**', r => r.abort());
    await ctx.route('**/fbevents**', r => r.abort());
    await ctx.route('**/hotjar**', r => r.abort());
    await ctx.route('**/intercom**', r => r.abort());

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
  protected _lastDiag: ScraperDiagnostics | null = null;

  constructor(config?: Partial<ScraperConfig>) {
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      retryDelay: config?.retryDelay ?? 2000,
      timeout: config?.timeout ?? 90000,
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
    page.setDefaultTimeout(45000);
    page.setDefaultNavigationTimeout(90000);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en-US', 'en'] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };
      // Spoof screen dimensions to look more realistic
      Object.defineProperty(screen, 'width',  { get: () => 1366 });
      Object.defineProperty(screen, 'height', { get: () => 768 });
    });
    return page;
  }

  // Navigate and wait for real JS-rendered content.
  // Uses a multi-phase wait: domcontentloaded → networkidle → scroll → extra buffer.
  // Throws BotBlockedError on challenge pages.
  protected async navigate(page: Page, url: string): Promise<void> {
    // Human-like pre-navigation delay
    await page.waitForTimeout(1000 + Math.random() * 2500);

    const navStart = Date.now();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    } catch (e: any) {
      if (e?.message?.includes('Timeout') || e?.message?.includes('exceeded')) {
        // Already partially loaded — continue extraction
        await page.waitForTimeout(2000);
      } else {
        throw e;
      }
    }

    // Phase 2: wait for network to settle — most AJAX calls should complete by 30s
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);

    // Phase 3: scroll to trigger lazy-loaded room cards and price components
    try {
      await page.evaluate(() => window.scrollTo(0, 400));
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 1600));
      await page.waitForTimeout(1000);
      // Scroll back to top to expose any sticky price bars
      await page.evaluate(() => window.scrollTo(0, 0));
    } catch { /* ignore scroll errors */ }

    // Phase 4: additional buffer for React hydration / price widget renders
    await page.waitForTimeout(4000 + Math.random() * 4000);

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
        () => (document.body?.innerText || '').substring(0, 5000)
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

    // Extract sample prices from raw body text (multi-currency)
    const priceMatches = bodyText.match(/(?:₹|INR|Rs\.?|\$|€|£|USD)\s*([\d,]+)/g) || [];
    const samplePrices = priceMatches.slice(0, 8);
    const hasPriceSymbol = priceMatches.length > 0 ||
      bodyText.includes('₹') || bodyText.includes('INR') ||
      bodyText.includes('per night') || bodyText.includes('/night');

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
      sampleBodyText: bodyText.substring(0, 600).replace(/\n+/g, ' '),
      samplePrices,
      navigationMs,
      ratesExtracted: 0,
      screenshotPath: null,
    };

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
      sampleBodyText: bodyText.substring(0, 150).replace(/\n+/g, ' '),
    }));

    if (botBlocked) {
      const art = await this.captureDebugArtifacts(page, this.source, blockReason ?? 'blocked');
      if (art.screenshotPath) this._lastDiag.screenshotPath = art.screenshotPath;
      console.warn(`[${this.source}] BOT_BLOCK — ${blockReason} — html=${htmlSize}B title="${pageTitle.substring(0, 60)}"`);
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
      console.log(`[${source}] debug artifacts saved: ${screenshotPath}`);
    } catch { /* /tmp might not be writable */ }
    return result;
  }

  // Multi-currency price scanner via raw innerText.
  // INR prices are returned as-is. USD/EUR/GBP prices are converted to INR.
  // Used as ultimate fallback when structured selectors find nothing.
  protected async evaluatePrices(page: Page): Promise<number[]> {
    try {
      return await page.evaluate(() => {
        const text = (document.body?.innerText || '') + ' ' + (document.body?.textContent || '');
        const found: number[] = [];

        // INR prices (₹, INR, Rs.)
        const inrMatches = text.match(/(?:₹|INR|Rs\.?)\s*([\d,]+)/g) || [];
        for (const m of inrMatches) {
          const n = parseInt(m.replace(/[^0-9]/g, ''), 10);
          if (n >= 1500 && n <= 300000) found.push(n);
        }

        // USD prices ($) — convert to INR @ 84 (approximate)
        if (found.length === 0) {
          const usdMatches = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/g) || [];
          for (const m of usdMatches) {
            const n = parseFloat(m.replace(/[^0-9.]/g, ''));
            if (n >= 30 && n <= 5000) found.push(Math.round(n * 84));
          }
        }

        // EUR prices (€) — convert @ 90
        if (found.length === 0) {
          const eurMatches = text.match(/€\s*([\d,]+(?:\.\d{1,2})?)/g) || [];
          for (const m of eurMatches) {
            const n = parseFloat(m.replace(/[^0-9.]/g, ''));
            if (n >= 30 && n <= 5000) found.push(Math.round(n * 90));
          }
        }

        // GBP prices (£) — convert @ 107
        if (found.length === 0) {
          const gbpMatches = text.match(/£\s*([\d,]+(?:\.\d{1,2})?)/g) || [];
          for (const m of gbpMatches) {
            const n = parseFloat(m.replace(/[^0-9.]/g, ''));
            if (n >= 25 && n <= 4000) found.push(Math.round(n * 107));
          }
        }

        // "per night" context numbers — last resort
        if (found.length === 0) {
          const p2 = text.match(/[\d,]{4,7}(?:\s*(?:per night|\/night|nett|net rate|room rate))/gi) || [];
          for (const m of p2) {
            const n = parseInt(m.replace(/[^0-9]/g, ''), 10);
            if (n >= 1500 && n <= 300000) found.push(n);
          }
        }

        return [...new Set(found)].sort((a, b) => a - b);
      });
    } catch { return []; }
  }

  // Wait for a selector to appear with a timeout, returning true/false
  protected async waitForSelector(page: Page, selector: string, timeoutMs = 15000): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  // Extract price from text — strips all non-numeric characters then parses.
  // Returns the numeric value regardless of currency symbol.
  protected extractPrice(text: string): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[₹$€£,\s]/g, '').replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  // Normalize a price that may be in USD/EUR to INR.
  // Uses heuristic: if price < 1500, assume foreign currency and convert.
  protected normalizeToInr(price: number, pageHasRupeeSymbol: boolean): number {
    if (pageHasRupeeSymbol || price >= 1500) return price;
    // Likely USD range ($30–$2000) → INR @ 84
    if (price >= 30 && price <= 2000) return Math.round(price * 84);
    return price;
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

        const diag = this._lastDiag as ScraperDiagnostics | null;
        if (diag) {
          diag.hotelName = hotelName;
          diag.ratesExtracted = rates.length;
          lastDiag = diag;
        }

        const ms = Date.now() - startTime;
        console.log(`[${this.source}] scrape_done hotel=${hotelName} rates=${rates.length} ms=${ms}`);

        if (rates.length === 0) {
          // Capture debug artifact for zero-rate pages so Railway logs have context
          try {
            if (this._context) {
              const pages = this._context.pages();
              if (pages.length > 0) {
                await this.captureDebugArtifacts(pages[0], this.source, `zero_rates_${hotelName.replace(/\s+/g, '_')}`);
              }
            }
          } catch { /* ignore */ }

          console.warn(JSON.stringify({
            event: 'ZERO_RATES',
            source: this.source,
            hotelName,
            htmlSize: lastDiag?.htmlSize,
            hasPriceSymbol: lastDiag?.hasPriceSymbol,
            pageTitle: lastDiag?.pageTitle,
            samplePrices: lastDiag?.samplePrices,
            sampleBodyText: (lastDiag?.sampleBodyText ?? '').substring(0, 300),
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

  protected formatDate(date: Date): string { return date.toISOString().split('T')[0]; }

  // MMDDYYYY format used by MakeMyTrip
  protected formatMmtDate(date: Date): string {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${mm}${dd}${date.getFullYear()}`;
  }

  // DDMMYYYY format used by some Indian OTAs
  protected formatDdMmYyyy(date: Date): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${date.getFullYear()}`;
  }

  protected async rateLimitWait(): Promise<void> {
    await sleep((60 / this.config.rateLimit) * 1000);
  }
}
