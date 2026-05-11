// KodaiRateIQ — API: Competitors
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

    return NextResponse.json({
      success: true,
      data: hotels.map(h => ({
        id: h.id,
        name: h.name,
        slug: h.slug,
        category: h.category,
        starRating: h.starRating,
        role: h.role,
        isTarget: h.isTarget,
        website: h.website,
        description: h.description,
        roomCount: h.rooms.length,
        facilityCount: h.facilities.length,
        latestRate: h.competitorSnapshots[0]?.bestMapRate ?? null,
        latestSource: h.competitorSnapshots[0]?.bestSource ?? null,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Competitors API error:', error);
    return NextResponse.json({ success: false, data: null, error: 'Failed', timestamp: new Date().toISOString() }, { status: 500 });
  }
}
