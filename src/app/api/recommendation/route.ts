// KodaiRateIQ — API: Recommendation
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { ApiResponse } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rec = await prisma.recommendation.findFirst({
      where: { hotel: { isTarget: true } },
      orderBy: { createdAt: 'desc' },
      include: { hotel: { select: { name: true, slug: true } } },
    });

    if (!rec) {
      return NextResponse.json({ success: true, data: null, timestamp: new Date().toISOString() });
    }

    return NextResponse.json({
      success: true,
      data: {
        recommendedMapRate: rec.recommendedMapRate,
        recommendedCpRate: rec.recommendedCpRate,
        recommendedEpRate: rec.recommendedEpRate,
        minRate: rec.minRate,
        maxRate: rec.maxRate,
        optimalRate: rec.optimalRate,
        strategy: rec.strategy,
        confidenceScore: rec.confidenceScore,
        reasoning: rec.reasoning,
        marketPosition: rec.marketPosition,
        seasonType: rec.seasonType,
        demandLevel: rec.demandLevel,
        weekendPremium: rec.weekendPremium,
        hotel: rec.hotel,
        date: rec.date,
        createdAt: rec.createdAt,
      },
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse<unknown>);
  } catch (error) {
    console.error('Recommendation API error:', error);
    return NextResponse.json({ success: false, data: null, error: 'Failed', timestamp: new Date().toISOString() }, { status: 500 });
  }
}
