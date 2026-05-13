// KodaiRateIQ — API: Verified Facility Benchmark
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { FACILITY_REGISTRY, LEVEL_STYLES, type FacilityLevel } from '@/lib/facility-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [facilities, hotels] = await Promise.all([
      prisma.facility.findMany({
        where: { available: true },
        include: { hotel: { select: { name: true, slug: true, luxuryTier: true, facilityScore: true } } },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
      prisma.hotel.findMany({
        select: { slug: true, name: true, luxuryTier: true, facilityScore: true, starRating: true, isTarget: true },
        orderBy: [{ isTarget: 'desc' }, { starRating: 'desc' }],
      }),
    ]);

    // Build per-hotel default map (None state)
    const defaultHotelEntry = () => ({
      available: false,
      level: 'None' as FacilityLevel,
      quality: 0,
      luxuryScore: 0,
    });

    // Group by normalizedKey
    type BenchmarkRow = {
      normalizedKey: string;
      displayName: string;
      category: string;
      icon: string;
      hotels: Record<string, { available: boolean; level: FacilityLevel; quality: number; luxuryScore: number }>;
    };

    const rowMap = new Map<string, BenchmarkRow>();

    for (const f of facilities) {
      const def = FACILITY_REGISTRY[f.normalizedKey];
      if (!def) continue;

      if (!rowMap.has(f.normalizedKey)) {
        const hotelMap: BenchmarkRow['hotels'] = {};
        for (const h of hotels) hotelMap[h.slug] = defaultHotelEntry();
        rowMap.set(f.normalizedKey, {
          normalizedKey: f.normalizedKey,
          displayName: def.displayName,
          category: def.category,
          icon: def.icon,
          hotels: hotelMap,
        });
      }

      rowMap.get(f.normalizedKey)!.hotels[f.hotel.slug] = {
        available: true,
        level: (f.level as FacilityLevel) ?? 'Standard',
        quality: f.quality ?? 0,
        luxuryScore: f.luxuryScore ?? 0,
      };
    }

    // Sort rows by category then displayName
    const rows = Array.from(rowMap.values()).sort((a, b) =>
      a.category.localeCompare(b.category) || a.displayName.localeCompare(b.displayName)
    );

    return NextResponse.json({
      success: true,
      data: {
        rows,
        hotels: hotels.map(h => ({
          slug: h.slug,
          name: h.name,
          luxuryTier: h.luxuryTier,
          facilityScore: h.facilityScore,
          starRating: h.starRating,
          isTarget: h.isTarget,
        })),
        levelStyles: LEVEL_STYLES,
        lastVerified: '2026-05-01',
        totalFacilities: rows.length,
        verificationSource: 'ota-verified',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Facilities API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch facilities', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
