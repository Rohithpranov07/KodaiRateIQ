// ============================================================
// ⚠️  TEMPORARY DEBUG ROUTE — REMOVE BEFORE GA LAUNCH
//
// GET /api/debug/browser-test?secret=<CRON_SECRET>
//
// Validates that Playwright's bundled Chromium launches correctly
// inside the Railway Docker container.
//
// TO REMOVE: delete src/app/api/debug/ entirely
// ============================================================

import { NextResponse } from 'next/server';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 });
  }

  const start = Date.now();
  const steps: { step: string; ok: boolean; detail?: string; ms?: number }[] = [];
  const mark = (step: string, ok: boolean, detail?: string, t0 = start) =>
    steps.push({ step, ok, detail, ms: Date.now() - t0 });

  const env = {
    NODE_ENV:                 process.env.NODE_ENV,
    PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? '(default)',
    CHROMIUM_PATH:            process.env.CHROMIUM_PATH ?? '(not set — using bundled)',
  };

  // All playwright/stealth requires are inside the handler — never run at build time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chromium } = require('playwright-extra');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  chromium.use(StealthPlugin());

  let browser: any = null;
  let pageTitle: string | null = null;
  let launchError: string | null = null;

  // ── Step 1: Locate bundled executable ───────────────────────
  let executablePath: string | null = null;
  try {
    executablePath = chromium.executablePath();
    mark('locate-executable', true, executablePath ?? undefined);
  } catch (err: any) {
    mark('locate-executable', false, err.message);
    return NextResponse.json({
      success: false,
      error: `Playwright cannot find bundled Chromium: ${err.message}`,
      env, steps, durationMs: Date.now() - start,
    }, { status: 500 });
  }

  // ── Step 2: Launch browser ──────────────────────────────────
  const t2 = Date.now();
  try {
    browser = await chromium.launch({
      headless: true,
      chromiumSandbox: false,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-http2', '--disable-blink-features=AutomationControlled'],
    });
    mark('launch-browser', true, `pid ${browser.process()?.pid ?? 'unknown'}`, t2);
  } catch (err: any) {
    launchError = err.message;
    mark('launch-browser', false, err.message, t2);
    return NextResponse.json({
      success: false, error: `chromium.launch() failed: ${launchError}`,
      executablePath, env, steps, durationMs: Date.now() - start,
    }, { status: 500 });
  }

  // ── Step 3: New page ────────────────────────────────────────
  const t3 = Date.now();
  let page: any = null;
  try {
    page = await browser.newPage();
    mark('new-page', true, undefined, t3);
  } catch (err: any) {
    mark('new-page', false, err.message, t3);
    await browser.close().catch(() => {});
    return NextResponse.json({
      success: false, error: `browser.newPage() failed: ${err.message}`,
      env, steps, durationMs: Date.now() - start,
    }, { status: 500 });
  }

  // ── Step 4: Navigate ────────────────────────────────────────
  const t4 = Date.now();
  try {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
    mark('goto-example.com', true, page.url(), t4);
  } catch (err: any) {
    mark('goto-example.com', false, err.message, t4);
  }

  // ── Step 5: Title ───────────────────────────────────────────
  const t5 = Date.now();
  try {
    pageTitle = await page.title();
    mark('page-title', true, pageTitle ?? '', t5);
  } catch (err: any) {
    mark('page-title', false, err.message, t5);
  }

  // ── Step 6: Close ───────────────────────────────────────────
  const t6 = Date.now();
  try {
    await browser.close();
    mark('close-browser', true, undefined, t6);
  } catch (err: any) {
    mark('close-browser', false, err.message, t6);
  }

  const allPassed = steps.every(s => s.ok);

  return NextResponse.json({
    _warning: 'Temporary debug endpoint — remove before GA launch.',
    success: allPassed,
    executablePath,
    pageTitle,
    env,
    steps,
    durationMs: Date.now() - start,
  }, { status: allPassed ? 200 : 500 });
}
