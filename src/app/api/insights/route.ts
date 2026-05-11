// KodaiRateIQ — API: AI Insights
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const insights = await prisma.aiInsight.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      data: insights.map(i => ({
        id: i.id,
        type: i.type,
        title: i.title,
        summary: i.summary,
        severity: i.severity,
        actionable: i.actionable,
        confidence: i.confidence,
        date: i.date.toISOString().split('T')[0],
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Insights API error:', error);
    return NextResponse.json({ success: false, data: null, error: 'Failed', timestamp: new Date().toISOString() }, { status: 500 });
  }
}
