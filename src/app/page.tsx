'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/Toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ── Helpers ────────────────────────────────────────────────────
function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}
function confColor(label: string) {
  if (label === 'HIGH') return '#10b981';
  if (label === 'MEDIUM') return '#f59e0b';
  return '#ef4444';
}
function confBg(label: string) {
  if (label === 'HIGH') return 'rgba(16,185,129,0.12)';
  if (label === 'MEDIUM') return 'rgba(245,158,11,0.12)';
  return 'rgba(239,68,68,0.12)';
}
function freshLabel(f: string) {
  const m: Record<string, string> = { fresh: 'LIVE', recent: 'RECENT', aging: 'AGING', stale: 'STALE', 'no-data': 'NO DATA' };
  return m[f] ?? '—';
}
function freshColor(f: string) {
  const m: Record<string, string> = { fresh: '#10b981', recent: '#38bdf8', aging: '#f59e0b', stale: '#ef4444', 'no-data': '#6b7280' };
  return m[f] ?? '#6b7280';
}

export default function DashboardPage() {
  const [liveRates, setLiveRates] = useState<any[]>([]);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState('—');
  const [dataQuality, setDataQuality] = useState('—');
  const [avgConfidence, setAvgConfidence] = useState(0);
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyDays, setHistoryDays] = useState(30);
  const [insightsData, setInsightsData] = useState<any[]>([]);
  const [healthInfo, setHealthInfo] = useState<any>(null);
  const { showToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ratesRes, recRes, healthRes, historyRes, insightsRes] = await Promise.all([
        fetch('/api/rates/live'),
        fetch('/api/recommendation'),
        fetch('/api/health'),
        fetch(`/api/rates/history?days=${historyDays}`),
        fetch('/api/insights'),
      ]);

      const [ratesData, recData, healthData, historyJson, insightsJson] = await Promise.all([
        ratesRes.json(), recRes.json(), healthRes.json(), historyRes.json(), insightsRes.json(),
      ]);

      if (ratesData.success && ratesData.data) {
        setLiveRates(ratesData.data.rates ?? []);
        setLastUpdated(new Date(ratesData.data.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));
        setDataQuality(ratesData.data.dataQuality ?? '—');
        setAvgConfidence(ratesData.data.avgConfidence ?? 0);
      }
      if (recData.success && recData.data) setRecommendation(recData.data);
      if (healthData.success && healthData.data) setHealthInfo(healthData.data);
      if (historyJson.success && historyJson.data) setHistoryData(historyJson.data.history ?? []);
      if (insightsJson.success && insightsJson.data) setInsightsData(insightsJson.data.slice(0, 3));
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [historyDays]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const applyStrategy = async (type: string) => {
    if (!recommendation) return;
    showToast(`Applying ${type} strategy…`, 'info');
    try {
      const res = await fetch('/api/strategy/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: (recommendation as any).id, strategy: type }),
      });
      const data = await res.json();
      if (data.success) { showToast('Strategy applied', 'success'); fetchData(); }
      else showToast('Strategy sync failed', 'error');
    } catch { showToast('Network error', 'error'); }
  };

  const hki = liveRates.find(r => r.isTarget);
  const competitors = liveRates.filter(r => !r.isTarget);
  const verifiedHotels = liveRates.filter(r => r.otaCount > 0).length;

  return (
    <DashboardLayout>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden clay-panel p-8 md:p-10 mb-8">
        <div className="absolute top-0 right-0 w-120 h-120 pointer-events-none -mr-48 -mt-48 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(201,169,110,0.12) 0%, transparent 70%)' }} />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10">
          <div className="max-w-xl">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-5 flex-wrap">
              <span className="badge-gold">AI Revenue Intelligence</span>
              <span className="flex items-center gap-1.5">
                <div className="live-dot" />
                <span className="text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: 'var(--color-positive)' }}>Live Engine</span>
              </span>
              {/* Data quality pill */}
              <span className="text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full"
                style={{ background: avgConfidence >= 0.80 ? 'rgba(16,185,129,0.12)' : avgConfidence >= 0.60 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', color: avgConfidence >= 0.80 ? '#10b981' : avgConfidence >= 0.60 ? '#f59e0b' : '#ef4444' }}>
                {dataQuality.replace(/-/g, ' ')}
              </span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="text-display-luxury mb-3">
              {loading && !recommendation ? (
                <div className="h-14 w-56 shimmer rounded-2xl bg-black/5" />
              ) : (
                <>
                  {fmt(recommendation?.recommendedMapRate)}
                  <span className="text-editorial-title font-light ml-3" style={{ color: 'var(--color-warm-slate)' }}>Target MAP</span>
                </>
              )}
            </motion.h1>

            <p className="text-base font-light leading-relaxed mb-2" style={{ color: 'var(--color-warm-slate)' }}>
              AI-powered MAP recommendation for{' '}
              <span className="font-semibold" style={{ color: 'var(--color-luxury-black)' }}>Hotel Kodai International</span>
            </p>

            {/* Live BAR for HKI */}
            {hki && (
              <div className="flex items-center gap-3 mb-7 flex-wrap">
                <span className="text-sm font-light" style={{ color: 'var(--color-warm-slate)' }}>
                  Current verified BAR:
                </span>
                <span className="text-base font-bold" style={{ color: hki.currentMapRate ? 'var(--color-luxury-black)' : 'var(--color-warm-slate)' }}>
                  {fmt(hki.currentMapRate)}
                </span>
                {hki.cheapestOta && (
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(201,169,110,0.12)', color: 'var(--color-gold)' }}>
                    via {hki.cheapestOta}
                  </span>
                )}
                <span className="text-[9px] font-bold px-2 py-1 rounded-md"
                  style={{ background: confBg(hki.confidenceLabel), color: confColor(hki.confidenceLabel) }}>
                  {hki.confidenceLabel} · {hki.otaCount}/{hki.otasChecked} OTAs
                </span>
              </div>
            )}

            {/* KPI pills */}
            <div className="flex flex-wrap gap-3">
              <div className="clay-inset px-5 py-3.5 min-w-32">
                <p className="text-label-luxury mb-1.5">AI Confidence</p>
                <p className="text-2xl font-semibold" style={{ color: recommendation?.confidenceScore >= 0.8 ? 'var(--color-positive)' : 'var(--color-gold)' }}>
                  {recommendation ? `${Math.round(recommendation.confidenceScore * 100)}%` : '—'}
                </p>
              </div>
              <div className="clay-inset px-5 py-3.5 min-w-32">
                <p className="text-label-luxury mb-1.5">Verified Hotels</p>
                <p className="text-2xl font-semibold" style={{ color: 'var(--color-luxury-black)' }}>
                  {loading ? '—' : `${verifiedHotels}/${liveRates.length}`}
                </p>
              </div>
              <div className="clay-inset px-5 py-3.5 min-w-32">
                <p className="text-label-luxury mb-1.5">Season</p>
                <p className="text-2xl font-semibold capitalize" style={{ color: 'var(--color-luxury-black)' }}>
                  {recommendation?.seasonType || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="w-full lg:w-auto flex flex-col items-stretch gap-3 lg:min-w-65">
            <button
              onClick={() => applyStrategy('optimal')}
              disabled={recommendation?.isApplied}
              className={`py-5 px-7 rounded-2xl flex items-center justify-between gap-4 transition-all ${recommendation?.isApplied ? 'cursor-not-allowed' : 'clay-button-gold hover:scale-[1.02] active:scale-[0.98]'}`}
              style={recommendation?.isApplied ? { background: 'rgba(17,17,17,0.05)', border: '1px solid var(--color-border)', color: 'var(--color-warm-slate)', borderRadius: 16 } : {}}>
              <span className="text-[11px] font-bold tracking-[0.12em]">
                {recommendation?.isApplied ? 'STRATEGY ACTIVE' : 'APPLY OPTIMAL TARGET'}
              </span>
              <span className="material-symbols-outlined text-[20px]">{recommendation?.isApplied ? 'check_circle' : 'bolt'}</span>
            </button>
            <p className="text-center text-[9px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--color-warm-slate)', opacity: 0.55 }}>
              Last verified sync · {lastUpdated}
            </p>
          </div>
        </div>
      </section>

      {/* ── LIVE BAR MATRIX ──────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex justify-between items-end mb-5 flex-wrap gap-3">
          <div>
            <div className="section-eyebrow">
              <span className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'var(--color-gold)' }}>Verified OTA Data</span>
            </div>
            <h2 className="text-editorial-title -mt-1">Live BAR Matrix</h2>
            <p className="text-sm font-light mt-0.5" style={{ color: 'var(--color-warm-slate)' }}>
              Lowest verified MAP rate · Double occupancy · Tax inclusive · All OTAs
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[9px] font-bold px-3 py-1.5 rounded-full"
              style={{ background: avgConfidence >= 0.80 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: avgConfidence >= 0.80 ? '#10b981' : '#f59e0b', border: `1px solid ${avgConfidence >= 0.80 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
              {(avgConfidence * 100).toFixed(0)}% avg confidence
            </span>
            <button onClick={fetchData} className="text-[10px] font-bold tracking-widest uppercase transition-opacity hover:opacity-70 px-3 py-1.5 rounded-full clay-inset"
              style={{ color: 'var(--color-gold)' }}>
              Refresh
            </button>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden flex flex-col gap-4">
          {loading && liveRates.length === 0
            ? Array(4).fill(0).map((_, i) => <div key={i} className="clay-card h-52 shimmer" />)
            : liveRates.map((hotel, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                className="clay-card p-6 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: hotel.isTarget ? 'var(--color-deep-bronze)' : 'var(--color-luxury-black)' }}>
                      {hotel.hotelName}
                      {hotel.isTarget && <span className="ml-1.5 badge-gold" style={{ fontSize: '8px' }}>OUR PROPERTY</span>}
                    </h3>
                    <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--color-warm-slate)' }}>{hotel.category}</p>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-1 rounded-md"
                    style={{ background: confBg(hotel.confidenceLabel), color: confColor(hotel.confidenceLabel) }}>
                    {hotel.confidenceLabel}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ['MAP BAR', fmt(hotel.currentMapRate)],
                    ['OTA', hotel.cheapestOta || '—'],
                    ['Δ', hotel.deltaPercent != null ? `${hotel.deltaPercent > 0 ? '+' : ''}${hotel.deltaPercent}%` : '—'],
                  ].map(([label, val], idx) => (
                    <div key={idx} className="clay-inset p-3 rounded-xl text-center">
                      <p className="text-[8px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-warm-slate)' }}>{label}</p>
                      <p className="text-sm font-bold truncate">{val}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: freshColor(hotel.freshness), fontSize: 10, fontWeight: 700 }}>{freshLabel(hotel.freshness)}</span>
                  {hotel.otaCount > 0 && <span className="text-[10px] font-mono" style={{ color: 'var(--color-warm-slate)' }}>{hotel.otaCount} OTAs verified</span>}
                </div>
              </motion.div>
            ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block clay-card overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.02)' }}>
                {['Property', 'Verified MAP BAR', 'Yesterday', 'Day Δ', 'OTA Winner', 'Sources', 'Confidence', 'Freshness', 'Rec. Rate'].map((h, i) => (
                  <th key={i} className="py-4 px-5 text-[9px] font-bold tracking-widest uppercase"
                    style={{ color: 'var(--color-warm-slate)', textAlign: i >= 2 && i <= 3 ? 'right' : 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && liveRates.length === 0
                ? Array(5).fill(0).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {Array(9).fill(0).map((__, j) => <td key={j} className="py-5 px-5"><div className="h-4 rounded shimmer bg-black/5 w-3/4" /></td>)}
                  </tr>
                ))
                : liveRates.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="py-14 flex flex-col items-center gap-3 text-center">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <span style={{ fontSize: 18, color: '#f59e0b' }}>⏳</span>
                        </div>
                        <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>No rates collected yet</p>
                        <p className="text-xs max-w-xs" style={{ color: 'var(--color-warm-slate)', opacity: 0.6 }}>
                          Scrape pending — pipeline runs at 6 AM, 12 PM, and 6 PM IST
                        </p>
                      </div>
                    </td>
                  </tr>
                )
                : liveRates.map((hotel, i) => {
                  const isLast = i === liveRates.length - 1;
                  const trendColor = hotel.trend === 'up' ? '#10b981' : hotel.trend === 'down' ? '#ef4444' : 'var(--color-warm-slate)';
                  const otaBreakdown: Record<string, number> | null = hotel.otaBreakdown;

                  return (
                    <tr key={i} className="group transition-colors"
                      style={{ borderBottom: !isLast ? '1px solid var(--color-border)' : 'none', background: hotel.isStale ? 'rgba(239,68,68,0.02)' : 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.5)')}
                      onMouseLeave={e => (e.currentTarget.style.background = hotel.isStale ? 'rgba(239,68,68,0.02)' : 'transparent')}>

                      {/* Property */}
                      <td className="py-5 px-5">
                        <div className="flex items-center gap-2">
                          {hotel.isTarget && <div className="w-0.5 h-8 rounded-full" style={{ background: 'var(--color-gold)' }} />}
                          <div>
                            <span className="text-[14px] font-semibold tracking-tight block"
                              style={{ color: hotel.isTarget ? 'var(--color-deep-bronze)' : 'var(--color-luxury-black)' }}>
                              {hotel.hotelName}
                              {hotel.isTarget && <span className="ml-1.5 badge-gold" style={{ fontSize: '7px', verticalAlign: 'middle' }}>OUR PROPERTY</span>}
                              {hotel.anomalyFlags?.length > 0 && <span className="ml-1 text-[10px]" style={{ color: '#f59e0b' }} title={hotel.anomalyFlags.join('\n')}>⚠</span>}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-warm-slate)', opacity: 0.6 }}>
                              {hotel.category}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Verified MAP BAR */}
                      <td className="py-5 px-5">
                        <div>
                          <span className="text-[15px] font-semibold block">{fmt(hotel.currentMapRate)}</span>
                          {hotel.isStale && <span className="text-[9px] font-bold" style={{ color: '#ef4444' }}>STALE</span>}
                        </div>
                      </td>

                      {/* Yesterday */}
                      <td className="py-5 px-5 text-right">
                        <span className="text-sm" style={{ color: 'var(--color-warm-slate)' }}>{fmt(hotel.yesterdayMapRate)}</span>
                      </td>

                      {/* Day Δ */}
                      <td className="py-5 px-5 text-right">
                        {hotel.deltaPercent != null ? (
                          <span className="text-sm font-semibold" style={{ color: trendColor }}>
                            {hotel.deltaPercent > 0 ? '+' : ''}{hotel.deltaPercent}%
                          </span>
                        ) : <span className="text-sm" style={{ color: 'var(--color-warm-slate)' }}>—</span>}
                      </td>

                      {/* OTA Winner */}
                      <td className="py-5 px-5">
                        <div>
                          <span className="text-[12px] font-semibold block capitalize"
                            style={{ color: hotel.cheapestOta ? 'var(--color-luxury-black)' : 'var(--color-warm-slate)' }}>
                            {hotel.cheapestOta?.replace('official:', '').replace(/\//g, '/') || '—'}
                          </span>
                          {otaBreakdown && hotel.cheapestOta && otaBreakdown[hotel.cheapestOta] && (
                            <span className="text-[10px] font-mono" style={{ color: '#10b981' }}>
                              {fmt(otaBreakdown[hotel.cheapestOta])}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* OTA count */}
                      <td className="py-5 px-5">
                        {hotel.otaCount > 0 ? (
                          <span className="text-[11px] font-mono clay-inset px-2 py-1 rounded-lg"
                            style={{ color: 'var(--color-warm-slate)' }}>
                            {hotel.otaCount}/{hotel.otasChecked}
                          </span>
                        ) : <span style={{ color: 'var(--color-warm-slate)', fontSize: 12 }}>—</span>}
                      </td>

                      {/* Confidence */}
                      <td className="py-5 px-5">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-md"
                          style={{ background: confBg(hotel.confidenceLabel), color: confColor(hotel.confidenceLabel) }}>
                          {hotel.confidenceLabel}
                        </span>
                      </td>

                      {/* Freshness */}
                      <td className="py-5 px-5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: freshColor(hotel.freshness) }} />
                          <span className="text-[10px] font-bold" style={{ color: freshColor(hotel.freshness) }}>
                            {freshLabel(hotel.freshness)}
                          </span>
                        </div>
                      </td>

                      {/* Rec Rate */}
                      <td className="py-5 px-5 text-right">
                        {hotel.isTarget && hotel.recommendedRate ? (
                          <div>
                            <span className="text-[14px] font-semibold block" style={{ color: 'var(--color-gold)' }}>
                              {fmt(hotel.recommendedRate)}
                            </span>
                            {hotel.currentMapRate && (
                              <span className="text-[9px] font-bold" style={{ color: hotel.recommendedRate > hotel.currentMapRate ? '#10b981' : '#ef4444' }}>
                                {hotel.recommendedRate > hotel.currentMapRate ? '↑ Raise' : hotel.recommendedRate < hotel.currentMapRate ? '↓ Lower' : '→ Hold'}
                              </span>
                            )}
                          </div>
                        ) : <span style={{ color: 'var(--color-warm-slate)', fontSize: 12 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <div className="px-5 py-3 flex items-center gap-6 flex-wrap" style={{ borderTop: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.015)' }}>
            {[['#10b981', 'HIGH = 2+ OTAs confirmed'], ['#f59e0b', 'MED = 1 OTA'], ['#ef4444', 'LOW = stale / unverified']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                <span className="text-[9px] font-semibold" style={{ color: 'var(--color-warm-slate)' }}>{l}</span>
              </div>
            ))}
            <span className="ml-auto text-[9px] font-mono" style={{ color: 'var(--color-warm-slate)', opacity: 0.6 }}>
              BAR = Lowest MAP · Room+B+D · 2 adults · Tax incl.
            </span>
          </div>
        </div>
      </section>

      {/* ── MAIN GRID ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Market Trajectory + Insights */}
        <div className="lg:col-span-8 flex flex-col gap-8">

          {/* Chart */}
          <section className="clay-card p-7 flex flex-col" style={{ minHeight: 420 }}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-7">
              <div>
                <div className="section-eyebrow">
                  <span className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'var(--color-gold)' }}>Historical Snapshots</span>
                </div>
                <h2 className="text-editorial-title -mt-1">BAR Trajectory</h2>
                <p className="text-sm font-light mt-0.5" style={{ color: 'var(--color-warm-slate)' }}>Verified MAP rates from real OTA scrapes</p>
              </div>
              <div className="clay-inset p-1 rounded-xl flex gap-0.5">
                {[7, 30].map(d => (
                  <button key={d} onClick={() => setHistoryDays(d)}
                    className="px-5 py-2 rounded-lg text-[10px] font-bold tracking-widest transition-all"
                    style={{ background: historyDays === d ? '#fff' : 'transparent', color: historyDays === d ? 'var(--color-luxury-black)' : 'var(--color-warm-slate)', boxShadow: historyDays === d ? '0 2px 8px rgba(17,17,17,0.08)' : 'none' }}>
                    {d}D
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 w-full rounded-2xl clay-inset p-4 overflow-hidden" style={{ minHeight: 260 }}>
              {loading && historyData.length === 0 ? (
                <div className="w-full h-full shimmer flex items-center justify-center text-sm font-light italic" style={{ color: 'var(--color-warm-slate)' }}>
                  Loading verified rate history…
                </div>
              ) : historyData.length < 2 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
                  <span className="material-symbols-outlined text-4xl mb-4" style={{ color: 'var(--color-warm-slate)', opacity: 0.2 }}>analytics</span>
                  <p className="text-lg font-light" style={{ color: 'var(--color-warm-slate)' }}>Awaiting history</p>
                  <p className="text-xs mt-2 max-w-[200px]" style={{ color: 'var(--color-warm-slate)', opacity: 0.6 }}>
                    Requires at least 2 verified scrape cycles.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(17,17,17,0.04)" />
                    <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      stroke="var(--color-warm-slate)" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="var(--color-warm-slate)" fontSize={10} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `₹${v / 1000}k`} dx={-10} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 8px 32px rgba(17,17,17,0.1)', fontSize: 12 }}
                      labelFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      formatter={(v: any, name: any) => [`₹${Number(v).toLocaleString('en-IN')}`, name]} />
                    <Line type="monotone" dataKey="hotel-kodai-international" name="HKI" stroke="var(--color-gold)" strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--color-gold)' }} />
                    <Line type="monotone" dataKey="sterling-kodai-lake" name="Sterling" stroke="#38bdf8" strokeWidth={1.5} dot={false} strokeOpacity={0.5} />
                    <Line type="monotone" dataKey="le-poshe-by-sparsa" name="Le Poshe" stroke="#a78bfa" strokeWidth={1.5} dot={false} strokeOpacity={0.5} />
                    <Line type="monotone" dataKey="the-carlton" name="Carlton" stroke="var(--color-warm-slate)" strokeWidth={1} dot={false} strokeOpacity={0.3} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex items-center gap-5 mt-4 px-1 flex-wrap">
              {[['var(--color-gold)', 'HKI (Target)', 3], ['#38bdf8', 'Sterling', 1.5], ['#a78bfa', 'Le Poshe', 1.5], ['var(--color-warm-slate)', 'Carlton', 1]].map(([c, l, w]) => (
                <div key={String(l)} className="flex items-center gap-2">
                  <div style={{ background: String(c), height: Number(w), width: 16, borderRadius: 4 }} />
                  <span className="text-[10px] font-medium" style={{ color: 'var(--color-warm-slate)' }}>{l}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Intelligence Feed */}
          <section>
            <div className="flex justify-between items-end mb-5">
              <div>
                <div className="section-eyebrow">
                  <span className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'var(--color-gold)' }}>AI Signals</span>
                </div>
                <h2 className="text-editorial-title -mt-1">Intelligence Feed</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {insightsData.length === 0 ? (
                <div className="col-span-full clay-card p-12 text-center font-light italic" style={{ color: 'var(--color-warm-slate)' }}>
                  Scanning for market signals…
                </div>
              ) : insightsData.map((insight, idx) => (
                <motion.div key={insight.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}
                  className="clay-card p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <span className={insight.severity === 'critical' ? 'badge-negative' : 'badge-gold'}>{insight.type}</span>
                      <span className="text-[9px] font-bold tracking-widest" style={{ color: 'var(--color-warm-slate)' }}>
                        {Math.round(insight.confidence * 100)}%
                      </span>
                    </div>
                    <h3 className="text-[14px] font-semibold leading-snug mb-2 tracking-tight">{insight.title}</h3>
                    <p className="text-xs font-light leading-relaxed line-clamp-3" style={{ color: 'var(--color-warm-slate)' }}>{insight.summary}</p>
                  </div>
                  <button className="mt-5 flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--color-gold)' }}>
                    Explore Brief <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                  </button>
                </motion.div>
              ))}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 flex flex-col gap-8">

          {/* Market Position scatter */}
          <section className="clay-card p-7 flex flex-col" style={{ height: 360 }}>
            <div className="mb-4">
              <h2 className="text-editorial-title">Market Position</h2>
              <p className="text-xs font-light mt-0.5" style={{ color: 'var(--color-warm-slate)' }}>BAR vs. luxury tier</p>
            </div>
            <div className="flex-1 clay-inset rounded-2xl relative p-5 overflow-hidden">
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-[7px] font-bold tracking-widest uppercase"
                style={{ color: 'var(--color-warm-slate)', opacity: 0.35 }}>MAP BAR</div>
              {liveRates.map((hotel, idx) => {
                const yPos = hotel.currentMapRate ? Math.max(8, 88 - ((hotel.currentMapRate - 4000) / 18000) * 80) : 50;
                const xPos = hotel.starRating === 5 ? 18 : hotel.starRating === 4 ? 50 : 78;
                return (
                  <motion.div key={idx} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: idx * 0.08, type: 'spring', stiffness: 200 }}
                    className="absolute flex flex-col items-center" style={{ top: `${yPos}%`, left: `${xPos}%` }} title={`${hotel.hotelName}: ${fmt(hotel.currentMapRate)}`}>
                    <div className={`rounded-full transition-transform hover:scale-150 ${hotel.isTarget ? 'w-4 h-4 z-20' : 'w-2.5 h-2.5 z-10'}`}
                      style={{ background: hotel.isTarget ? 'var(--color-gold)' : confColor(hotel.confidenceLabel), opacity: hotel.isTarget ? 1 : 0.6, boxShadow: hotel.isTarget ? '0 0 0 6px rgba(201,169,110,0.2)' : 'none' }} />
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-3 flex justify-between px-1">
              <span className="text-[8px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>Premium</span>
              <span className="text-[8px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>Value</span>
            </div>
            <div className="mt-3 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: 'var(--color-gold)' }} />
                <span className="text-[9px] font-semibold" style={{ color: 'var(--color-warm-slate)' }}>HKI</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#10b981' }} />
                <span className="text-[9px] font-semibold" style={{ color: 'var(--color-warm-slate)' }}>HIGH conf.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} />
                <span className="text-[9px] font-semibold" style={{ color: 'var(--color-warm-slate)' }}>MED conf.</span>
              </div>
            </div>
          </section>

          {/* Terminal Health */}
          <section className="clay-panel p-7">
            <h2 className="text-label-luxury mb-5">Terminal Health</h2>
            <div className="flex flex-col gap-3">
              {[
                { label: 'OTA Scraper Engine', status: healthInfo?.status === 'healthy' ? 'active' : 'syncing', note: `${liveRates.filter(r => r.otaCount > 0).length}/${liveRates.length} hotels live` },
                { label: 'BAR Verification', status: avgConfidence >= 0.7 ? 'active' : 'syncing', note: `${(avgConfidence * 100).toFixed(0)}% avg confidence` },
                { label: 'AI Strategy Core', status: recommendation ? 'active' : 'syncing', note: recommendation?.strategy ?? 'awaiting data' },
                { label: 'Database Sync', status: 'active', note: `Updated ${lastUpdated}` },
              ].map(({ label, status, note }) => (
                <div key={label} className="flex justify-between items-center py-3 px-4 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.5)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${status === 'active' ? 'live-dot' : ''}`}
                      style={status !== 'active' ? { background: 'var(--color-gold)', animation: 'pulse 1.5s infinite' } : {}} />
                    <div>
                      <span className="text-[12px] font-medium tracking-tight block">{label}</span>
                      <span className="text-[9px] capitalize" style={{ color: 'var(--color-warm-slate)', opacity: 0.6 }}>{note}</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-widest"
                    style={{ color: status === 'active' ? 'var(--color-positive)' : 'var(--color-gold)' }}>
                    {status === 'active' ? 'Active' : 'Syncing'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
