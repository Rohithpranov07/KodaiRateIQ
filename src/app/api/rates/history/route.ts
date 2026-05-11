// KodaiRateIQ — API: Rate History
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { ApiResponse, PriceHistoryPoint } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const hotels = await prisma.hotel.findMany({ select: { id: true, slug: true, name: true } });
    const history = await prisma.rateHistory.findMany({
      where: { date: { gte: startDate }, mapRate: { not: null } },
      orderBy: { date: 'asc' },
      include: { hotel: { select: { slug: true } } },
    });

    const dateMap = new Map<string, PriceHistoryPoint>();
    for (const entry of history) {
      const dateStr = new Date(entry.date).toISOString().split('T')[0];
      if (!dateMap.has(dateStr)) {
        const point: PriceHistoryPoint = { date: dateStr };
        for (const hotel of hotels) point[hotel.slug] = null;
        dateMap.set(dateStr, point);
      }
      dateMap.get(dateStr)![entry.hotel.slug] = entry.mapRate;
    }

    const chartData = Array.from(dateMap.values()).sort(
      (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime()
    );

    return NextResponse.json({
      success: true,
      data: { history: chartData, hotels: hotels.map(h => ({ slug: h.slug, name: h.name })), days },
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse<unknown>);
  } catch (error) {
    console.error('Rate history API error:', error);
    return NextResponse.json({ success: false, data: null, error: 'Failed', timestamp: new Date().toISOString() }, { status: 500 });
  }
}
