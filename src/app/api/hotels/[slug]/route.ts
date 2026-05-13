// KodaiRateIQ — API: Hotel Detail
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    const hotel = await prisma.hotel.findFirst({
      where: { slug },
      include: {
        rooms: true,
        facilities: { orderBy: { name: 'asc' } },
      },
    });

    if (!hotel) {
      return NextResponse.json(
        { success: false, data: null, error: 'Hotel not found' },
        { status: 404 }
      );
    }

    const snapshot = await prisma.competitorSnapshot.findFirst({
      where: { hotelId: hotel.id },
      orderBy: { date: 'desc' },
    });

    const recommendation = await prisma.recommendation.findFirst({
      where: { hotelId: hotel.id },
      orderBy: { date: 'desc' },
    });

    const rates = await prisma.dailyRate.findFirst({
      where: { hotelId: hotel.id },
      orderBy: { date: 'desc' },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const history = await prisma.rateHistory.findMany({
      where: { hotelId: hotel.id, date: { gte: thirtyDaysAgo } },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: { hotel, snapshot, rates, recommendation, history },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Hotel detail API error:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'Failed' },
      { status: 500 }
    );
  }
}
