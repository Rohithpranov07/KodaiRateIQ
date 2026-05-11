// ============================================================
// KodaiRateIQ — API: Live Rates
// GET /api/rates/live
// ============================================================

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { calcDeltaPercent, getTrend } from '@/lib/utils';
import type { LiveRateRow, ApiResponse } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Use date range approach for robustness with timezone handling
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const hotels = await prisma.hotel.findMany({
      orderBy: { starRating: 'desc' },
    });

    // Fetch latest recommendation for target hotel
    const latestRec = await prisma.recommendation.findFirst({
      where: { hotel: { isTarget: true } },
      orderBy: { createdAt: 'desc' },
    });

    const liveRates: LiveRateRow[] = [];

    for (const hotel of hotels) {
      // Get today's snapshot (or most recent if today doesn't exist)
      const todaySnap = await prisma.competitorSnapshot.findFirst({
        where: {
          hotelId: hotel.id,
          date: { gte: yesterdayStart, lt: todayEnd },
        },
        orderBy: { date: 'desc' },
      });

      // Get yesterday's snapshot
      const yesterdaySnap = await prisma.competitorSnapshot.findFirst({
        where: {
          hotelId: hotel.id,
          date: { lt: yesterdayStart },
        },
        orderBy: { date: 'desc' },
      });

      const currentRate = todaySnap?.bestMapRate ?? null;
      const yesterdayRate = yesterdaySnap?.bestMapRate ?? null;

      const deltaPercent = currentRate && yesterdayRate
        ? calcDeltaPercent(currentRate, yesterdayRate)
        : null;

      liveRates.push({
        hotelId: hotel.id,
        hotelName: hotel.name,
        slug: hotel.slug,
        category: hotel.category,
        starRating: hotel.starRating,
        role: hotel.role,
        currentMapRate: currentRate,
        currentCpRate: todaySnap?.bestCpRate ?? null,
        currentEpRate: todaySnap?.bestEpRate ?? null,
        yesterdayMapRate: yesterdayRate,
        deltaPercent: deltaPercent ? Math.round(deltaPercent * 10) / 10 : null,
        trend: getTrend(deltaPercent),
        cheapestOta: todaySnap?.bestSource ?? null,
        availability: todaySnap?.availability ?? 'unknown',
        isTarget: hotel.isTarget,
        recommendedRate: hotel.isTarget && latestRec ? latestRec.recommendedMapRate : undefined,
      });
    }

    const response: ApiResponse<{ rates: LiveRateRow[]; lastUpdated: string }> = {
      success: true,
      data: {
        rates: liveRates,
        lastUpdated: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Live rates API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch live rates', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
