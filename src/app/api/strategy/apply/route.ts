// KodaiRateIQ — API: Apply Strategy
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { recommendationId, strategy } = body;

    if (!recommendationId) {
      return NextResponse.json({ success: false, error: 'Recommendation ID required' }, { status: 400 });
    }

    const updated = await prisma.recommendation.update({
      where: { id: recommendationId },
      data: {
        isApplied: true,
        appliedAt: new Date(),
        strategy: strategy || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Strategy ${strategy} applied successfully.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Strategy Apply API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to apply strategy' }, { status: 500 });
  }
}
