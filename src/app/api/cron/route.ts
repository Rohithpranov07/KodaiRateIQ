// KodaiRateIQ — API: Cron trigger for daily scraping
import { NextResponse } from 'next/server';
import { runFullScrape } from '@/scrapers/orchestrator';
import { generateRecommendation } from '@/engine/recommendation';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min timeout for scraping

export async function GET(request: Request) {
  try {
    // Verify cron secret
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 1: Run scrapers
    const scrapeResult = await runFullScrape();

    // Step 2: Generate recommendation
    const recommendation = await generateRecommendation();

    return NextResponse.json({
      success: true,
      data: {
        scraping: {
          totalRates: scrapeResult.totalRates,
          successfulSources: scrapeResult.successfulSources,
          failedSources: scrapeResult.failedSources,
          duration: scrapeResult.duration,
        },
        recommendation: {
          recommendedRate: recommendation.recommendedMapRate,
          confidence: recommendation.confidenceScore,
          strategy: recommendation.strategy,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron execution error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message, timestamp: new Date().toISOString() }, { status: 500 });
  }
}
