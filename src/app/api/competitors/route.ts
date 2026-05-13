import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const hotels = await prisma.hotel.findMany({
      include: {
        rooms: true,
        facilities: true,
        competitorSnapshots: { orderBy: { date: 'desc' }, take: 1 },
      },
      orderBy: { starRating: 'desc' },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const data = await Promise.all(hotels.map(async (h) => {
      const snap = h.competitorSnapshots[0];
      
      // Calculate volatility from last 30 days of history
      const history = await prisma.rateHistory.findMany({
        where: { hotelId: h.id, date: { gte: thirtyDaysAgo }, mapRate: { not: null } },
        select: { mapRate: true },
      });

      let vol = 'Low';
      if (history.length > 3) {
        const rates = history.map(rh => rh.mapRate!);
        const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
        const squareDiffs = rates.map(r => Math.pow(r - avg, 2));
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
        const stdDev = Math.sqrt(avgSquareDiff);
        const relativeVolatility = stdDev / avg;
        
        if (relativeVolatility > 0.15) vol = 'High';
        else if (relativeVolatility > 0.05) vol = 'Med';
      }

      return {
        id: h.id,
        name: h.name,
        slug: h.slug,
        category: h.category,
        starRating: h.starRating,
        role: h.role,
        isTarget: h.isTarget,
        luxuryTier: h.luxuryTier,
        facilityScore: h.facilityScore,
        facilities: h.facilities.filter(f => f.available).map(f => f.name),
        map: snap?.bestMapRate ?? null,
        cp: snap?.bestCpRate ?? null,
        ep: snap?.bestEpRate ?? null,
        ota: snap?.bestCpRate && snap.bestSource !== 'official' ? snap.bestCpRate - 200 : snap?.bestCpRate ?? null,
        vol,
      };
    }));

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Competitors API error:', error);
    return NextResponse.json({ success: false, data: null, error: 'Failed', timestamp: new Date().toISOString() }, { status: 500 });
  }
}
