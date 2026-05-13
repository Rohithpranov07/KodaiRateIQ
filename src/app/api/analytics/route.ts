// ============================================================
// KodaiRateIQ — API: Analytics
// GET /api/analytics?days=7|30|90
//
// REAL DATA ONLY — no fake KPIs, no random movement, no synthetic heatmaps.
// All metrics derived exclusively from verified DB snapshots.
// ============================================================

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const daysStr = searchParams.get('days') ?? '30';

    let days = 30;
    if (daysStr === '7D' || daysStr === '7') days = 7;
    else if (daysStr === '1D' || daysStr === '1') days = 1;
    else if (daysStr === '3D' || daysStr === '3') days = 3;
    else if (daysStr === '30D' || daysStr === '30') days = 30;
    else if (daysStr === '90D' || daysStr === '90') days = 90;
    else if (daysStr === '1Y') days = 365;
    else if (daysStr === 'YTD') {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      days = Math.floor((Date.now() - startOfYear.getTime()) / 86400000);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // ── Fetch all rate history in range ───────────────────────
    const history = await prisma.rateHistory.findMany({
      where: { date: { gte: startDate }, mapRate: { not: null } },
      orderBy: { date: 'asc' },
      include: { hotel: { select: { slug: true, isTarget: true, name: true } } },
    });

    // ── Fetch all competitor snapshots in range ────────────────
    const snapshots = await prisma.competitorSnapshot.findMany({
      where: {
        date: { gte: startDate },
        bestMapRate: { not: null },
      },
      orderBy: { date: 'asc' },
      include: { hotel: { select: { slug: true, isTarget: true, name: true } } },
    });

    // ── OTA audit data for winner tracking ────────────────────
    const otaAudits = await prisma.otaBarAudit.findMany({
      where: { date: { gte: startDate }, isWinner: true },
      orderBy: { date: 'asc' },
      include: { hotel: { select: { name: true, isTarget: true } } },
    }).catch(() => []); // graceful if table doesn't exist yet

    const targetHistory = history.filter(h => h.hotel.isTarget);
    const targetSnapshots = snapshots.filter(s => s.hotel.isTarget);

    // ── KPIs — all computed from REAL DB data ─────────────────
    const targetRates = targetHistory.map(h => h.mapRate!);
    const avgMapRate = targetRates.length > 0
      ? targetRates.reduce((a, b) => a + b, 0) / targetRates.length
      : null;

    // ADR volatility: coefficient of variation (std dev / mean)
    let volatilityPct: number | null = null;
    let volatilityLabel: string | null = null;
    if (targetRates.length >= 3 && avgMapRate) {
      const variance = targetRates.reduce((a, b) => a + Math.pow(b - avgMapRate, 2), 0) / targetRates.length;
      const stdDev = Math.sqrt(variance);
      volatilityPct = (stdDev / avgMapRate) * 100;
      volatilityLabel = `±₹${Math.round(stdDev).toLocaleString('en-IN')}`;
    }

    // Rate trend: compare first half vs second half of period
    let trendDelta: number | null = null;
    if (targetRates.length >= 4) {
      const mid = Math.floor(targetRates.length / 2);
      const firstHalfAvg = targetRates.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
      const secondHalfAvg = targetRates.slice(mid).reduce((a, b) => a + b, 0) / (targetRates.length - mid);
      trendDelta = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : null;
    }

    // OTA spread: average difference between min and max MAP across OTAs per day
    const otaSpreadData = await prisma.dailyRate.groupBy({
      by: ['date', 'hotelId'],
      where: {
        date: { gte: startDate },
        mapRate: { not: null },
        isValid: true,
      },
      _min: { mapRate: true },
      _max: { mapRate: true },
      _count: { source: true },
    });

    const spreads = otaSpreadData
      .filter(d => d._min.mapRate != null && d._max.mapRate != null && d._min.mapRate! > 0)
      .map(d => ((d._max.mapRate! - d._min.mapRate!) / d._min.mapRate!) * 100);

    const avgOtaSpread = spreads.length > 0
      ? spreads.reduce((a, b) => a + b, 0) / spreads.length
      : null;

    // Yield leakage: difference between official site rate and lowest OTA rate when OTA < official
    const officialRates = await prisma.dailyRate.findMany({
      where: {
        date: { gte: startDate },
        source: { startsWith: 'official:' },
        mapRate: { not: null },
        isValid: true,
      },
      include: { hotel: { select: { isTarget: true } } },
    });
    const otaRatesForLeakage = await prisma.dailyRate.findMany({
      where: {
        date: { gte: startDate },
        source: { not: { startsWith: 'official:' } },
        mapRate: { not: null },
        isValid: true,
      },
      include: { hotel: { select: { isTarget: true } } },
    });

    let yieldLeakageTotal = 0;
    let yieldLeakageDays = 0;
    const officialByDate = new Map<string, number>();
    for (const r of officialRates.filter(r => r.hotel.isTarget)) {
      const key = r.date.toISOString().split('T')[0];
      const existing = officialByDate.get(key);
      if (!existing || r.mapRate! < existing) officialByDate.set(key, r.mapRate!);
    }
    const otaMinByDate = new Map<string, number>();
    for (const r of otaRatesForLeakage.filter(r => r.hotel.isTarget)) {
      const key = r.date.toISOString().split('T')[0];
      const existing = otaMinByDate.get(key);
      if (!existing || r.mapRate! < existing) otaMinByDate.set(key, r.mapRate!);
    }
    for (const [date, officialRate] of officialByDate) {
      const otaMin = otaMinByDate.get(date);
      if (otaMin && otaMin < officialRate) {
        yieldLeakageTotal += (officialRate - otaMin);
        yieldLeakageDays++;
      }
    }
    const avgDailyLeakage = yieldLeakageDays > 0 ? yieldLeakageTotal / yieldLeakageDays : null;

    // OTA winner frequency analysis
    const otaWinCount: Record<string, number> = {};
    for (const audit of otaAudits) {
      otaWinCount[audit.source] = (otaWinCount[audit.source] || 0) + 1;
    }
    const otaWinnerRanking = Object.entries(otaWinCount)
      .sort(([, a], [, b]) => b - a)
      .map(([source, count]) => ({ source, count, pct: otaAudits.length > 0 ? Math.round((count / otaAudits.length) * 100) : 0 }));

    // ── Heatmap — REAL occupancy pressure from availability data ──
    // Uses availability field from CompetitorSnapshot as proxy
    const heatmapData: Array<{ date: string; intensity: number; availability: string }> = [];
    const snapshotsByDate = new Map<string, typeof snapshots>();

    for (const snap of targetSnapshots) {
      const key = snap.date.toISOString().split('T')[0];
      if (!snapshotsByDate.has(key)) snapshotsByDate.set(key, []);
      snapshotsByDate.get(key)!.push(snap);
    }

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const key = date.toISOString().split('T')[0];
      const daySnaps = snapshotsByDate.get(key) ?? [];

      let intensity = 0.1; // default: no data
      let availability = 'no-data';

      if (daySnaps.length > 0) {
        const snap = daySnaps[0];
        availability = snap.availability ?? 'unknown';
        if (availability === 'sold-out') intensity = 1.0;
        else if (availability === 'limited') intensity = 0.75;
        else if (snap.confidenceScore && snap.confidenceScore >= 0.85) intensity = 0.5;
        else intensity = 0.3;
      }

      heatmapData.push({ date: key, intensity, availability });
    }

    // ── Competitor rate spread per day ─────────────────────────
    const competitorTrend: Array<{ date: string; hki: number | null; sterling: number | null; lePoshe: number | null; carlton: number | null; tamara: number | null }> = [];
    const allHotels = await prisma.hotel.findMany({ select: { id: true, slug: true } });

    const snapshotsAllByDate = new Map<string, typeof snapshots>();
    const allSnapshots = await prisma.competitorSnapshot.findMany({
      where: { date: { gte: startDate }, bestMapRate: { not: null } },
      orderBy: { date: 'asc' },
      include: { hotel: { select: { slug: true } } },
    });
    for (const snap of allSnapshots) {
      const key = snap.date.toISOString().split('T')[0];
      if (!snapshotsAllByDate.has(key)) snapshotsAllByDate.set(key, []);
      (snapshotsAllByDate.get(key) as any[]).push(snap);
    }

    for (const [date, daySnaps] of snapshotsAllByDate) {
      const get = (slug: string) => (daySnaps as any[]).find((s: any) => s.hotel.slug === slug)?.bestMapRate ?? null;
      competitorTrend.push({
        date,
        hki: get('hotel-kodai-international'),
        sterling: get('sterling-kodai-lake'),
        lePoshe: get('le-poshe-by-sparsa'),
        carlton: get('the-carlton'),
        tamara: get('the-tamara-kodai'),
      });
    }

    // ── Build KPIs from REAL data ─────────────────────────────
    const kpis = [
      {
        label: 'AVG MAP BAR',
        value: avgMapRate ? `₹${Math.round(avgMapRate).toLocaleString('en-IN')}` : '—',
        delta: trendDelta != null ? `${trendDelta >= 0 ? '+' : ''}${trendDelta.toFixed(1)}% vs prior period` : '—',
        color: trendDelta != null && trendDelta >= 0 ? 'var(--color-positive)' : 'var(--color-negative)',
        isReal: avgMapRate != null,
      },
      {
        label: 'ADR VOLATILITY',
        value: volatilityPct != null ? `${volatilityPct.toFixed(1)}%` : '—',
        delta: volatilityLabel ?? '—',
        color: volatilityPct != null && volatilityPct > 10 ? 'var(--color-warning)' : 'var(--color-positive)',
        isReal: volatilityPct != null,
      },
      {
        label: 'OTA SPREAD',
        value: avgOtaSpread != null ? `${avgOtaSpread.toFixed(1)}%` : '—',
        delta: avgOtaSpread != null ? (avgOtaSpread > 10 ? 'High spread' : 'Tight market') : '—',
        color: avgOtaSpread != null && avgOtaSpread > 15 ? 'var(--color-warning)' : 'var(--color-positive)',
        isReal: avgOtaSpread != null,
      },
      {
        label: 'YIELD LEAKAGE',
        value: avgDailyLeakage != null ? `₹${Math.round(avgDailyLeakage).toLocaleString('en-IN')}/day` : '—',
        delta: yieldLeakageDays > 0 ? `${yieldLeakageDays}d detected` : 'None detected',
        color: avgDailyLeakage != null && avgDailyLeakage > 500 ? 'var(--color-negative)' : 'var(--color-positive)',
        isReal: true,
      },
    ];

    return NextResponse.json({
      success: true,
      data: {
        kpis,
        heatmap: heatmapData,
        competitorTrend,
        otaWinnerRanking,
        avgOtaSpread,
        avgMapRate,
        trendDelta,
        dataQuality: history.length > 0 ? 'real' : 'insufficient',
        hasData: history.length > 0,
        days,
        dateRange: {
          from: startDate.toISOString().split('T')[0],
          to: new Date().toISOString().split('T')[0],
          dataPoints: history.length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ success: false, data: null, error: 'Failed to load analytics' }, { status: 500 });
  }
}
