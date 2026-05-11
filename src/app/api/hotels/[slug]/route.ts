// KodaiRateIQ — API: Hotel Detail
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const { slug } = params;

    const hotel = await prisma.hotel.findFirst({
      where: { slug },
      include: {
        rooms: true,
        facilities: true,
      }
    });

    if (!hotel) {
      return NextResponse.json({ success: false, data: null, error: 'Hotel not found' }, { status: 404 });
    }

    // Get current rates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snapshot = await prisma.competitorSnapshot.findFirst({
      where: { hotelId: hotel.id },
      orderBy: { date: 'desc' }
    });

    const recommendation = await prisma.recommendation.findFirst({
      where: { hotelId: hotel.id },
      orderBy: { date: 'desc' }
    });

    const rates = await prisma.dailyRate.findFirst({
      where: { hotelId: hotel.id },
      orderBy: { date: 'desc' }
    });

    // History
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const history = await prisma.rateHistory.findMany({
      where: { hotelId: hotel.id, date: { gte: thirtyDaysAgo } },
      orderBy: { date: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: {
        hotel,
        snapshot,
        rates,
        recommendation,
        history
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Hotel detail API error:', error);
    return NextResponse.json({ success: false, data: null, error: 'Failed' }, { status: 500 });
  }
}
