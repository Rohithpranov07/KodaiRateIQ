import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { runFullScrape } from '@/scrapers/orchestrator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

export async function GET(request: Request) {
  const start = Date.now();
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ success: false, error: 'Unauthorised' }, { status: 401 });
  }

  // Step 0: DB connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: `Database connection failed: ${err.message}`,
      durationMs: Date.now() - start,
    }, { status: 503 });
  }

  // Step 1: Run hardened scraper pipeline
  let scrapeReport;
  try {
    scrapeReport = await runFullScrape();
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: `Scrape pipeline failed: ${err.message}`,
      durationMs: Date.now() - start,
    }, { status: 500 });
  }

  const totalDuration = Date.now() - start;

  return NextResponse.json({
    success: scrapeReport.success,
    totalRatesFound: scrapeReport.totalRatesFound,
    ratesSavedToSupabase: scrapeReport.ratesSavedToSupabase,
    verifiedHotels: scrapeReport.verifiedHotels,
    sourcesFailed: scrapeReport.sourcesFailed,
    durationMs: totalDuration,
    healthReports: scrapeReport.healthReports,
  });
}
