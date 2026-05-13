// KodaiRateIQ — API: Cron trigger for daily scraping
import { NextResponse } from 'next/server';
import { triggerManualScrape, getJobHistory, getCronStatus } from '@/cron/scheduler';
import { detectStaleData } from '@/engine/verification';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min timeout for scraping

export async function GET(request: Request) {
  try {
    // Verify cron secret
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const job = searchParams.get('job') || 'scrape';

    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (job === 'cleanup') {
      const staleStatus = await detectStaleData();
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const deletedLogs = await prisma.scrapeLog.deleteMany({
        where: { createdAt: { lt: thirtyDaysAgo } },
      });

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const deletedInsights = await prisma.aiInsight.deleteMany({
        where: { createdAt: { lt: ninetyDaysAgo } },
      });

      return NextResponse.json({
        success: true,
        data: {
          staleStatus,
          prunedLogs: deletedLogs.count,
          prunedInsights: deletedInsights.count,
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (job === 'status') {
      return NextResponse.json({
        success: true,
        data: getCronStatus(),
        timestamp: new Date().toISOString()
      });
    }

    // Default: run full scrape pipeline
    const jobResult = await triggerManualScrape();

    if (!jobResult || jobResult.status === 'failed') {
      return NextResponse.json({ 
        success: false, 
        error: jobResult?.details?.error || 'Scrape job failed to complete', 
        timestamp: new Date().toISOString() 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: jobResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron execution error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message, timestamp: new Date().toISOString() }, { status: 500 });
  }
}
