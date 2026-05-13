// ============================================================
// KodaiRateIQ — Cron Scheduler
// Production-grade automated job scheduling for rate updates.
//
// SCHEDULE (IST):
// - 06:00 AM  — Morning rate sweep
// - 12:00 PM  — Midday rate update
// - 06:00 PM  — Evening rate capture
// - 02:00 AM  — Stale data cleanup & integrity check
//
// NOTE: IST = UTC+5:30, so cron times are in UTC:
// - 06:00 IST = 00:30 UTC
// - 12:00 IST = 06:30 UTC
// - 18:00 IST = 12:30 UTC
// - 02:00 IST = 20:30 UTC (previous day)
// ============================================================

import cron from 'node-cron';
import { runFullScrape } from '@/scrapers/orchestrator';
import { generateRecommendation } from '@/engine/recommendation';
import { detectStaleData } from '@/engine/verification';
import prisma from '@/lib/db';

let isRunning = false;
const jobHistory: Array<{
  job: string;
  startedAt: string;
  completedAt: string | null;
  status: 'success' | 'failed' | 'running';
  details: Record<string, unknown>;
}> = [];

// ============================================================
// JOB DEFINITIONS
// ============================================================

/**
 * MAIN JOB: Full scrape + verify + AI regeneration
 */
async function jobScrapeAndRecommend(triggerSource: string = 'cron'): Promise<void> {
  if (isRunning) {
    console.warn('[Cron] Job already in progress. Skipping this cycle.');
    return;
  }

  isRunning = true;
  const startedAt = new Date().toISOString();
  const jobEntry: {
    job: string;
    startedAt: string;
    completedAt: string | null;
    status: 'success' | 'failed' | 'running';
    details: Record<string, unknown>;
  } = {
    job: 'scrape-verify-recommend',
    startedAt,
    completedAt: null,
    status: 'running',
    details: { triggerSource },
  };
  jobHistory.push(jobEntry);

  try {
    console.log(`\n🚀 [Cron] Starting automated pipeline — triggered by ${triggerSource}`);

    // Step 1: Run full scrape with verification
    const scrapeReport = await runFullScrape();

    // Step 2: Generate AI recommendation (only if we have verified data)
    let recommendation = null;
    if (scrapeReport.verifiedHotels > 0) {
      console.log('\n🤖 [Cron] Generating AI recommendation...');
      try {
        recommendation = await generateRecommendation();
        console.log(`  ✅ AI recommendation: ₹${recommendation.recommendedMapRate.toLocaleString()} MAP (${recommendation.strategy}, ${(recommendation.confidenceScore * 100).toFixed(0)}% confidence)`);
      } catch (aiErr) {
        console.error('  ⚠️ AI recommendation failed:', (aiErr as Error).message);
        // Non-fatal: rates are still stored even if AI fails
      }
    } else {
      console.log('\n⚠️ [Cron] Skipping AI recommendation — no verified data available');
    }

    // Step 3: Create system insight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const successfulSources = scrapeReport.healthReports.filter(h => h.success).length;

    await prisma.aiInsight.create({
      data: {
        date: today,
        type: 'system-status',
        title: `Automated Rate Update — cron`,
        summary: `Pipeline completed. ${scrapeReport.totalRatesFound} rates from ${successfulSources} sources. ${scrapeReport.verifiedHotels} hotels verified.${recommendation ? ` AI recommends ₹${recommendation.recommendedMapRate.toLocaleString()} MAP.` : ' AI recommendation pending.'}`,
        severity: scrapeReport.sourcesFailed > 0 ? 'warning' : 'info',
        actionable: false,
        confidence: 0.9,
      },
    });

    jobEntry.status = 'success';
    jobEntry.completedAt = new Date().toISOString();
    jobEntry.details = {
      triggerSource,
      totalRates: scrapeReport.totalRatesFound,
      successfulSources: successfulSources,
      failedSources: scrapeReport.sourcesFailed,
      verifiedHotels: scrapeReport.verifiedHotels,
      recommendedRate: recommendation?.recommendedMapRate ?? null,
    };

    console.log(`\n✅ [Cron] Pipeline completed successfully\n`);

  } catch (error) {
    console.error('[Cron] Pipeline FAILED:', error);
    jobEntry.status = 'failed';
    jobEntry.completedAt = new Date().toISOString();
    jobEntry.details = {
      triggerSource,
      error: (error as Error).message,
    };
  } finally {
    isRunning = false;
  }
}

/**
 * CLEANUP JOB: Stale data detection + old log pruning
 */
async function jobCleanup(): Promise<void> {
  console.log('\n🧹 [Cron] Running cleanup & stale detection...');

  try {
    const staleStatus = await detectStaleData();

    // Prune old scrape logs (keep last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deleted = await prisma.scrapeLog.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    });

    // Prune old AI insights (keep last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    await prisma.aiInsight.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    });

    console.log(`  ✅ Cleanup complete. Pruned ${deleted.count} old logs.`);
    console.log(`  Fresh: ${staleStatus.freshHotels.length} | Degraded: ${staleStatus.degradedHotels.length} | Stale: ${staleStatus.staleHotels.length}`);

  } catch (error) {
    console.error('[Cron] Cleanup failed:', error);
  }
}

// ============================================================
// CRON SCHEDULE — IST-based (converted to UTC for node-cron)
// ============================================================

/**
 * Initialize all scheduled cron jobs.
 * Call this once when the server starts.
 */
export function initCronJobs(): void {
  console.log('\n📅 [Cron] Initializing scheduled jobs...');

  // 6:00 AM IST = 0:30 UTC
  cron.schedule('30 0 * * *', () => {
    jobScrapeAndRecommend('cron-6am-ist');
  }, { timezone: 'Asia/Kolkata' });
  // Use IST directly with timezone option
  cron.schedule('0 6 * * *', () => {
    jobScrapeAndRecommend('cron-6am-ist');
  }, { timezone: 'Asia/Kolkata' });

  // 12:00 PM IST
  cron.schedule('0 12 * * *', () => {
    jobScrapeAndRecommend('cron-12pm-ist');
  }, { timezone: 'Asia/Kolkata' });

  // 6:00 PM IST
  cron.schedule('0 18 * * *', () => {
    jobScrapeAndRecommend('cron-6pm-ist');
  }, { timezone: 'Asia/Kolkata' });

  // 2:00 AM IST — Cleanup
  cron.schedule('0 2 * * *', () => {
    jobCleanup();
  }, { timezone: 'Asia/Kolkata' });

  console.log('  ✅ 06:00 IST — Morning rate sweep');
  console.log('  ✅ 12:00 IST — Midday rate update');
  console.log('  ✅ 18:00 IST — Evening rate capture');
  console.log('  ✅ 02:00 IST — Cleanup & stale detection');
  console.log('📅 [Cron] All jobs scheduled.\n');
}

/**
 * Trigger a manual scrape (for API or testing)
 */
export async function triggerManualScrape(): Promise<typeof jobHistory[0] | null> {
  await jobScrapeAndRecommend('manual-api');
  return jobHistory[jobHistory.length - 1] ?? null;
}

/**
 * Get recent job history
 */
export function getJobHistory(): typeof jobHistory {
  return [...jobHistory].reverse().slice(0, 50);
}

/**
 * Get current cron status
 */
export function getCronStatus(): {
  isRunning: boolean;
  lastJob: typeof jobHistory[0] | null;
  totalJobs: number;
  successRate: number;
} {
  const total = jobHistory.length;
  const successes = jobHistory.filter(j => j.status === 'success').length;
  return {
    isRunning,
    lastJob: jobHistory[jobHistory.length - 1] ?? null,
    totalJobs: total,
    successRate: total > 0 ? successes / total : 0,
  };
}
