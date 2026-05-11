import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const latestLog = await prisma.scrapeLog.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: {
        status: latestLog?.status === 'success' ? 'healthy' : 'degraded',
        lastRun: latestLog?.createdAt || null,
        error: latestLog?.errorMessage || null,
        duration: latestLog?.durationMs || null
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health API error:', error);
    return NextResponse.json({ success: false, data: null, error: 'Failed', timestamp: new Date().toISOString() }, { status: 500 });
  }
}
