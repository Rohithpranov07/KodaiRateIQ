'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Helpers ────────────────────────────────────────────────────
const fmt = (n: number | null | undefined) => n == null ? '—' : `₹${n.toLocaleString('en-IN')}`;
const confColor = (l: string) => ({ HIGH: '#10b981', MEDIUM: '#f59e0b', LOW: '#ef4444' }[l] ?? '#6b7280');
const confBg = (l: string) => ({ HIGH: 'rgba(16,185,129,0.12)', MEDIUM: 'rgba(245,158,11,0.12)', LOW: 'rgba(239,68,68,0.12)' }[l] ?? 'rgba(0,0,0,0.05)');
const freshColor = (f: string) => ({ fresh: '#10b981', recent: '#38bdf8', aging: '#f59e0b', stale: '#ef4444', 'no-data': '#6b7280' }[f] ?? '#6b7280');
const freshLabel = (f: string) => ({ fresh: 'LIVE', recent: 'RECENT', aging: 'AGING', stale: 'STALE', 'no-data': 'NO DATA' }[f] ?? '—');

export default function LiveRatesPage() {
  const [liveRates, setLiveRates] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState('—');
  const [dataQuality, setDataQuality] = useState('—');
  const [avgConf, setAvgConf] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/rates/live');
      const data = await res.json();
      if (data.success && data.data) {
        setLiveRates(data.data.rates ?? []);
        setLastUpdated(new Date(data.data.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));
        setDataQuality(data.data.dataQuality ?? '—');
        setAvgConf(data.data.avgConfidence ?? 0);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filters = ['All', 'MAP Only', 'HIGH Confidence', 'Stale Alert'];
  const filtered = liveRates.filter(r => {
    if (activeFilter === 'MAP Only') return r.currentMapRate != null;
    if (activeFilter === 'HIGH Confidence') return r.confidenceLabel === 'HIGH';
    if (activeFilter === 'Stale Alert') return r.isStale || r.freshness === 'stale';
    return true;
  });

  const hki = liveRates.find(r => r.isTarget);
  const competitors = liveRates.filter(r => !r.isTarget && r.currentMapRate != null);
  const compAvg = competitors.length > 0 ? competitors.reduce((s, r) => s + r.currentMapRate, 0) / competitors.length : 0;

  return (
    <DashboardLayout>

      {/* ── Ticker Bar ── */}
      <div className="fixed top-0 left-0 right-0 z-20 md:left-68 overflow-hidden flex items-center"
        style={{ height: 40, marginTop: 68, background: 'rgba(17,17,17,0.97)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {liveRates.length > 0 && (
          <div className="flex items-center gap-8 animate-marquee whitespace-nowrap px-4">
            {[...liveRates, ...liveRates].map((rate, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: rate.isTarget ? 'var(--color-gold)' : 'rgba(255,255,255,0.4)' }}>
                  {rate.hotelName.split(' ').slice(0, 2).join(' ')}
                </span>
                <span className="text-[11px] font-semibold" style={{ color: '#fff' }}>
                  {rate.currentMapRate ? fmt(rate.currentMapRate) : '—'}
                </span>
                {rate.cheapestOta && (
                  <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{rate.cheapestOta}</span>
                )}
                {/* Confidence dot */}
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: confColor(rate.confidenceLabel) }} />
                <span className="w-1 h-1 rounded-full opacity-15" style={{ background: '#fff' }} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ height: 40 }} />

      <div className="pt-6">
        {/* ── Header ── */}
        <section className="mb-8">
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="section-eyebrow">
            <span className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'var(--color-gold)' }}>Live OTA Terminal</span>
          </motion.div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
            <div>
              <h1 className="text-display-luxury mb-2 -mt-1">BAR Pricing Pulse</h1>
              <p className="text-base font-light leading-relaxed max-w-2xl" style={{ color: 'var(--color-warm-slate)' }}>
                Lowest verified MAP rate across all 13 OTA sources. Double occupancy · Tax inclusive · Real-time cross-verification.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="live-dot" />
                <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-positive)' }}>Live</span>
              </div>
              <span className="text-[9px] font-bold px-3 py-1.5 rounded-full"
                style={{ background: avgConf >= 0.80 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: avgConf >= 0.80 ? '#10b981' : '#f59e0b' }}>
                {(avgConf * 100).toFixed(0)}% avg conf
              </span>
              <span className="text-[10px] font-medium" style={{ color: 'var(--color-warm-slate)', opacity: 0.6 }}>Synced {lastUpdated}</span>
              <button onClick={fetchData} className="text-[10px] font-bold clay-inset px-3 py-1.5 rounded-full tracking-widest uppercase hover:opacity-70 transition-opacity"
                style={{ color: 'var(--color-gold)' }}>
                Refresh
              </button>
            </div>
          </div>
        </section>

        {/* ── Filter dock ── */}
        <div className="flex overflow-x-auto gap-2.5 mb-8 pb-1 scrollbar-hide">
          {filters.map((f, i) => (
            <button key={i} onClick={() => setActiveFilter(f)}
              className="px-5 py-2.5 rounded-2xl clay-card text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-all hover:shadow-md"
              style={{ color: activeFilter === f ? 'var(--color-luxury-black)' : 'var(--color-warm-slate)', background: activeFilter === f ? '#fff' : undefined, boxShadow: activeFilter === f ? '0 2px 12px rgba(17,17,17,0.1)' : undefined }}>
              {f}
            </button>
          ))}
          <span className="ml-auto self-center text-[10px] font-mono pr-1 whitespace-nowrap" style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>
            {filtered.length} hotels
          </span>
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 mb-12">

          {/* Rate cards */}
          <div className="lg:col-span-8 flex flex-col gap-5">

            {/* Summary strip */}
            {!loading && hki && (
              <div className="clay-panel px-6 py-4 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-warm-slate)' }}>HKI Verified BAR</p>
                  <p className="text-2xl font-semibold" style={{ color: 'var(--color-luxury-black)' }}>{fmt(hki.currentMapRate)}</p>
                </div>
                {hki.cheapestOta && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-warm-slate)' }}>OTA Winner</p>
                    <p className="text-base font-semibold capitalize" style={{ color: 'var(--color-luxury-black)' }}>{hki.cheapestOta}</p>
                  </div>
                )}
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-warm-slate)' }}>vs Comp Avg</p>
                  {hki.currentMapRate && compAvg > 0 ? (
                    <p className="text-base font-semibold" style={{ color: hki.currentMapRate < compAvg ? '#10b981' : '#ef4444' }}>
                      {((hki.currentMapRate - compAvg) / compAvg * 100).toFixed(1)}%
                    </p>
                  ) : <p className="text-base font-semibold" style={{ color: 'var(--color-warm-slate)' }}>—</p>}
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-warm-slate)' }}>Sources</p>
                  <p className="text-base font-semibold">{hki.otaCount}/{hki.otasChecked} OTAs</p>
                </div>
                <span className="text-[10px] font-bold px-3 py-1.5 rounded-md"
                  style={{ background: confBg(hki.confidenceLabel), color: confColor(hki.confidenceLabel) }}>
                  {hki.confidenceLabel} CONFIDENCE
                </span>
              </div>
            )}

            {/* Rate rows */}
            <section className="clay-card overflow-hidden">
              <div className="px-7 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <div className="section-eyebrow">
                    <span className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'var(--color-gold)' }}>OTA Data</span>
                  </div>
                  <h2 className="text-editorial-title -mt-1">Verified BAR Matrix</h2>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-full"
                  style={{ background: 'rgba(26,122,85,0.08)', border: '1px solid rgba(26,122,85,0.15)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-positive)' }} />
                  <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-positive)' }}>Active</span>
                </div>
              </div>

              <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {loading && filtered.length === 0
                  ? Array(5).fill(0).map((_, i) => <div key={i} className="h-24 w-full clay-inset shimmer m-4 rounded-xl" />)
                  : filtered.map((rate, i) => {
                    const variance = rate.currentMapRate && compAvg ? ((rate.currentMapRate - compAvg) / compAvg * 100) : null;
                    const isExpanded = expandedRow === rate.hotelId;
                    const otaBreakdown: Record<string, number> | null = rate.otaBreakdown;

                    return (
                      <div key={i}>
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                          className="p-6 cursor-pointer transition-colors hover:bg-black/1.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                          style={{ background: rate.isTarget ? 'rgba(201,169,110,0.04)' : 'transparent', borderLeft: rate.isTarget ? '3px solid var(--color-gold)' : '3px solid transparent' }}
                          onClick={() => setExpandedRow(isExpanded ? null : rate.hotelId)}>

                          {/* Left: name + meta */}
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                              style={{ background: rate.isTarget ? 'rgba(201,169,110,0.15)' : 'rgba(17,17,17,0.05)' }}>
                              <span className="material-symbols-outlined text-[18px]"
                                style={{ color: rate.isTarget ? 'var(--color-gold)' : 'var(--color-warm-slate)', opacity: 0.7 }}>
                                {rate.isTarget ? 'stars' : 'home'}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-[14px] font-semibold tracking-tight"
                                style={{ color: rate.isTarget ? 'var(--color-deep-bronze)' : 'var(--color-luxury-black)' }}>
                                {rate.hotelName}
                                {rate.isTarget && <span className="ml-1.5 badge-gold" style={{ fontSize: '8px', verticalAlign: 'middle' }}>OUR PROPERTY</span>}
                                {rate.anomalyFlags?.length > 0 && <span className="ml-1.5 text-[10px]" style={{ color: '#f59e0b' }} title={rate.anomalyFlags.join('\n')}>⚠ {rate.anomalyFlags.length}</span>}
                              </h3>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-warm-slate)', opacity: 0.6 }}>{rate.category}</span>
                                {rate.cheapestOta && (
                                  <span className="text-[9px] font-bold" style={{ color: 'var(--color-gold)' }}>
                                    via {rate.cheapestOta}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: rates + badges */}
                          <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end flex-wrap">
                            {/* MAP BAR */}
                            <div className="flex flex-col items-end">
                              <span className="text-lg font-semibold" style={{ color: 'var(--color-luxury-black)' }}>
                                {fmt(rate.currentMapRate)}
                              </span>
                              {variance != null && (
                                <span className="text-[9px] font-bold uppercase tracking-wider"
                                  style={{ color: variance <= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                                  {variance > 0 ? '+' : ''}{variance.toFixed(1)}% vs mkt
                                </span>
                              )}
                            </div>

                            {/* Delta */}
                            <div className="flex flex-col items-end">
                              {rate.deltaPercent != null ? (
                                <span className="text-sm font-bold"
                                  style={{ color: rate.deltaPercent > 0 ? 'var(--color-positive)' : rate.deltaPercent < 0 ? 'var(--color-negative)' : 'var(--color-warm-slate)' }}>
                                  {rate.deltaPercent > 0 ? '+' : ''}{rate.deltaPercent}%
                                </span>
                              ) : <span className="text-sm" style={{ color: 'var(--color-warm-slate)' }}>—</span>}
                              <span className="text-[9px]" style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>day Δ</span>
                            </div>

                            {/* Confidence */}
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-md"
                              style={{ background: confBg(rate.confidenceLabel), color: confColor(rate.confidenceLabel) }}>
                              {rate.confidenceLabel}
                            </span>

                            {/* Freshness */}
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: freshColor(rate.freshness) }} />
                              <span className="text-[10px] font-bold" style={{ color: freshColor(rate.freshness) }}>{freshLabel(rate.freshness)}</span>
                            </div>

                            {/* Expand toggle */}
                            <span className="text-[12px] font-bold" style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          </div>
                        </motion.div>

                        {/* OTA breakdown expanded */}
                        <AnimatePresence>
                          {isExpanded && otaBreakdown && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                              style={{ background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--color-border)' }}>
                              <div className="px-6 py-4">
                                <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-warm-slate)' }}>
                                  MAP Rates by OTA — {Object.keys(otaBreakdown).length} sources
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {Object.entries(otaBreakdown)
                                    .sort(([, a], [, b]) => (a as number) - (b as number))
                                    .map(([source, otaRate]) => {
                                      const isWinner = source === rate.cheapestOta;
                                      return (
                                        <div key={source}
                                          className="flex items-center justify-between px-3 py-2 rounded-xl"
                                          style={{ background: isWinner ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isWinner ? 'rgba(16,185,129,0.2)' : 'var(--color-border)'}` }}>
                                          <div>
                                            <span className="text-[9px] font-bold block capitalize" style={{ color: isWinner ? '#10b981' : 'var(--color-warm-slate)' }}>
                                              {source.replace('official:', '').replace(/\//g, '/')}
                                              {isWinner && ' ★'}
                                            </span>
                                          </div>
                                          <span className="text-[11px] font-mono font-bold"
                                            style={{ color: isWinner ? '#10b981' : 'var(--color-luxury-black)' }}>
                                            {fmt(otaRate as number)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                </div>
                                <p className="text-[9px] mt-3" style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>
                                  ★ = verified BAR winner · Rates tax-inclusive · Last verified: {rate.lastVerifiedAt ? new Date(rate.lastVerifiedAt).toLocaleTimeString('en-IN') : '—'}
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
              </div>
            </section>

            {/* Auto-Sync strip */}
            <section className="clay-panel p-5 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.2)' }}>
                  <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-gold)' }}>refresh</span>
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold">Auto-Sync Active</h4>
                  <p className="text-xs font-light" style={{ color: 'var(--color-warm-slate)' }}>
                    Polls every 60s · 13 OTA sources · Last sync {lastUpdated}
                  </p>
                </div>
              </div>
              <button onClick={fetchData} className="text-[10px] font-bold tracking-widest uppercase transition-opacity hover:opacity-70"
                style={{ color: 'var(--color-gold)', textDecoration: 'underline', textUnderlineOffset: 4 }}>
                Force Refresh
              </button>
            </section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 flex flex-col gap-5">

            {/* Leakage alert */}
            <AnimatePresence>
              {hki && hki.cheapestOta && !hki.cheapestOta.startsWith('official') && (
                <motion.section initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="clay-card p-6"
                  style={{ borderTop: '3px solid var(--color-negative)', background: 'rgba(155,75,75,0.04)' }}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-negative)' }}>error</span>
                    <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-negative)' }}>Rate Leakage</h3>
                  </div>
                  <p className="text-sm font-light leading-relaxed mb-2" style={{ color: 'var(--color-warm-slate)' }}>
                    Lowest HKI MAP found on <span className="font-semibold capitalize" style={{ color: 'var(--color-negative)' }}>{hki.cheapestOta}</span>, not official site.
                  </p>
                  {hki.otaBreakdown && (
                    <p className="text-[11px] font-mono font-bold mb-4" style={{ color: 'var(--color-negative)' }}>
                      {fmt((hki.otaBreakdown as any)[hki.cheapestOta])} vs official
                    </p>
                  )}
                  <button className="w-full py-3 rounded-xl text-[10px] font-bold tracking-widest uppercase text-white"
                    style={{ background: 'var(--color-negative)', boxShadow: '0 4px 16px rgba(155,75,75,0.25)' }}>
                    Enforce Parity
                  </button>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Channel integrity */}
            <section className="clay-card p-6">
              <h3 className="text-label-luxury mb-5">OTA Channel Breakdown</h3>
              <div className="flex flex-col gap-3">
                {filtered.filter(r => r.currentMapRate != null).map((rate, i) => (
                  <div key={i} className="flex justify-between items-center py-2"
                    style={{ borderBottom: i < filtered.length - 2 ? '1px solid var(--color-border)' : 'none' }}>
                    <div>
                      <p className="text-[12px] font-semibold" style={{ color: rate.isTarget ? 'var(--color-deep-bronze)' : 'var(--color-warm-slate)' }}>
                        {rate.hotelName.split(' ').slice(0, 3).join(' ')}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>
                          {rate.cheapestOta || '—'}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: confBg(rate.confidenceLabel), color: confColor(rate.confidenceLabel) }}>
                          {rate.confidenceLabel}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[13px] font-semibold block" style={{ color: 'var(--color-luxury-black)' }}>
                        {fmt(rate.currentMapRate)}
                      </span>
                      <span className="text-[9px]" style={{ color: freshColor(rate.freshness) }}>{freshLabel(rate.freshness)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Market context */}
            <section className="rounded-2xl p-6" style={{ background: 'var(--color-luxury-black)', color: '#fff' }}>
              <h3 className="text-[9px] font-bold tracking-widest uppercase mb-4" style={{ opacity: 0.5 }}>Market Overview</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-1" style={{ opacity: 0.4 }}>Comp Avg MAP</p>
                  <p className="text-lg font-semibold" style={{ color: 'var(--color-gold)' }}>{compAvg > 0 ? fmt(compAvg) : '—'}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-1" style={{ opacity: 0.4 }}>Hotels Verified</p>
                  <p className="text-lg font-semibold">{liveRates.filter(r => r.otaCount >= 2).length}/{liveRates.length}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-1" style={{ opacity: 0.4 }}>OTA Sources</p>
                  <p className="text-lg font-semibold">13</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-1" style={{ opacity: 0.4 }}>Data Quality</p>
                  <p className="text-sm font-semibold capitalize" style={{ color: avgConf >= 0.80 ? '#10b981' : '#f59e0b' }}>
                    {dataQuality.replace(/-/g, ' ')}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
