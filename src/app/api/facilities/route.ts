// KodaiRateIQ — API: Facilities Comparison
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const facilities = await prisma.facility.findMany({
      include: { hotel: { select: { name: true, slug: true } } },
      orderBy: { name: 'asc' },
    });

    // Group by facility name
    const facilityMap = new Map<string, { facility: string; category: string; hotels: Record<string, { available: boolean; quality: number }> }>();

    for (const f of facilities) {
      if (!facilityMap.has(f.name)) {
        facilityMap.set(f.name, { facility: f.name, category: f.category, hotels: {} });
      }
      facilityMap.get(f.name)!.hotels[f.hotel.slug] = { available: f.available, quality: f.quality ?? 0 };
    }

    return NextResponse.json({
      success: true,
      data: Array.from(facilityMap.values()),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Facilities API error:', error);
    return NextResponse.json({ success: false, data: null, error: 'Failed', timestamp: new Date().toISOString() }, { status: 500 });
  }
}
