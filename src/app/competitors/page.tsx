'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n: number | null | undefined) => n == null ? '—' : `₹${n.toLocaleString('en-IN')}`;
const confColor = (l: string) => ({ HIGH: '#10b981', MEDIUM: '#f59e0b', LOW: '#ef4444' }[l] ?? '#6b7280');
const confBg    = (l: string) => ({ HIGH: 'rgba(16,185,129,0.12)', MEDIUM: 'rgba(245,158,11,0.12)', LOW: 'rgba(239,68,68,0.12)' }[l] ?? 'rgba(0,0,0,0.05)');
const freshColor = (f: string) => ({ fresh: '#10b981', recent: '#38bdf8', aging: '#f59e0b', stale: '#ef4444', 'no-data': '#6b7280' }[f] ?? '#6b7280');
const freshLabel = (f: string) => ({ fresh: 'LIVE', recent: 'RECENT', aging: 'AGING', stale: 'STALE', 'no-data': 'NO DATA' }[f] ?? '—');

const HOTEL_COLORS: Record<string, string> = {
  'hotel-kodai-international': 'var(--color-gold)',
  'sterling-kodai-lake':       '#38bdf8',
  'le-poshe-by-sparsa':        '#a78bfa',
  'the-carlton':               '#94a3b8',
  'the-tamara-kodai':          'var(--color-deep-bronze)',
};

export default function CompetitorsPage() {
  const [liveRates, setLiveRates]   = useState<any[]>([]);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyDays, setHistoryDays] = useState(30);
  const [loading, setLoading]       = useState(true);
  const [sortKey, setSortKey]       = useState<'bar'|'delta'|'conf'>('bar');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ratesRes, historyRes] = await Promise.all([
        fetch('/api/rates/live'),
        fetch(`/api/rates/history?days=${historyDays}`),
      ]);
      const [ratesJson, historyJson] = await Promise.all([
        ratesRes.json(), historyRes.json(),
      ]);
      if (ratesJson.success)   setLiveRates(ratesJson.data?.rates ?? []);
      if (historyJson.success) setHistoryData(historyJson.data?.history ?? []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [historyDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sorted = [...liveRates].sort((a, b) => {
    if (sortKey === 'bar')   return (a.currentMapRate ?? Infinity) - (b.currentMapRate ?? Infinity);
    if (sortKey === 'delta') return (Math.abs(b.deltaPercent ?? 0)) - (Math.abs(a.deltaPercent ?? 0));
    if (sortKey === 'conf') {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return (order[a.confidenceLabel as keyof typeof order] ?? 3) - (order[b.confidenceLabel as keyof typeof order] ?? 3);
    }
    return 0;
  });

  // Competitor-only rates (exclude target) for variance analysis
  const competitors = liveRates.filter(r => !r.isTarget && r.currentMapRate != null);
  const hki = liveRates.find(r => r.isTarget);
  const compAvg = competitors.length > 0
    ? competitors.reduce((s, r) => s + r.currentMapRate, 0) / competitors.length : 0;

  return (
    <DashboardLayout>

      {/* ── Header ── */}
      <section className="mb-10">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 mb-4">
          <span className="w-12 h-px opacity-50" style={{ background: 'var(--color-gold)' }} />
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase" style={{ color: 'var(--color-gold)' }}>Market Parity</span>
        </motion.div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-display-luxury mb-3">Competitor Analytics</h1>
            <p className="text-lg font-light leading-relaxed max-w-3xl" style={{ color: 'var(--color-warm-slate)' }}>
              Verified BAR from 13 OTAs · Lowest MAP per hotel · Double occupancy · Tax inclusive
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="clay-inset p-1 rounded-xl flex gap-0.5">
              {(['bar', 'delta', 'conf'] as const).map(k => (
                <button key={k} onClick={() => setSortKey(k)}
                  className="px-4 py-1.5 rounded-lg text-[9px] font-bold tracking-widest uppercase transition-all"
                  style={{ background: sortKey === k ? '#fff' : 'transparent', color: sortKey === k ? 'var(--color-luxury-black)' : 'var(--color-warm-slate)', boxShadow: sortKey === k ? '0 2px 8px rgba(17,17,17,0.08)' : 'none' }}>
                  {k === 'bar' ? 'By BAR' : k === 'delta' ? 'By Δ' : 'By Conf.'}
                </button>
              ))}
            </div>
            <button onClick={fetchData}
              className="clay-inset px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-gold)' }}>
              Refresh
            </button>
          </div>
        </div>
      </section>

      {/* ── Competitor BAR Matrix (desktop) ── */}
      <section className="mb-12">
        <div className="hidden md:block clay-card rounded-[28px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.02)' }}>
                  {[
                    { h: 'Property',         align: 'left'   },
                    { h: 'Verified MAP BAR', align: 'right'  },
                    { h: 'Yesterday',        align: 'right'  },
                    { h: 'Day Δ',            align: 'right'  },
                    { h: 'OTA Winner',       align: 'left'   },
                    { h: 'Sources',          align: 'center' },
                    { h: 'Confidence',       align: 'left'   },
                    { h: 'Freshness',        align: 'left'   },
                    { h: 'vs HKI',           align: 'right'  },
                  ].map(({ h, align }) => (
                    <th key={h} className="py-5 px-6 text-[9px] font-bold tracking-widest uppercase"
                      style={{ color: 'var(--color-warm-slate)', textAlign: align as any }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="py-16 text-center"><div className="shimmer h-5 w-48 mx-auto rounded-lg bg-black/5" /></td></tr>
                ) : sorted.map((hotel, i) => {
                  const isLast = i === sorted.length - 1;
                  const vsHki = hotel.currentMapRate && hki?.currentMapRate
                    ? ((hotel.currentMapRate - hki.currentMapRate) / hki.currentMapRate * 100) : null;
                  const deltaColor = (hotel.deltaPercent ?? 0) > 0 ? 'var(--color-positive)' : (hotel.deltaPercent ?? 0) < 0 ? 'var(--color-negative)' : 'var(--color-warm-slate)';
                  const otaBreakdown: Record<string, number> | null = hotel.otaBreakdown;

                  return (
                    <tr key={i} className="group transition-colors"
                      style={{ borderBottom: !isLast ? '1px solid var(--color-border)' : 'none', background: hotel.isTarget ? 'rgba(201,169,110,0.04)' : 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = hotel.isTarget ? 'rgba(201,169,110,0.07)' : 'rgba(255,255,255,0.5)')}
                      onMouseLeave={e => (e.currentTarget.style.background = hotel.isTarget ? 'rgba(201,169,110,0.04)' : 'transparent')}>

                      {/* Property */}
                      <td className="py-7 px-6">
                        <div className="flex items-center gap-2">
                          {hotel.isTarget && <div className="w-0.5 h-8 rounded-full shrink-0" style={{ background: 'var(--color-gold)' }} />}
                          <div>
                            <span className="text-[14px] font-bold tracking-tight block"
                              style={{ color: hotel.isTarget ? 'var(--color-deep-bronze)' : 'var(--color-luxury-black)' }}>
                              {hotel.hotelName}
                              {hotel.isTarget && <span className="ml-1.5 badge-gold" style={{ fontSize: '7px', verticalAlign: 'middle' }}>OUR PROPERTY</span>}
                              {hotel.anomalyFlags?.length > 0 && (
                                <span className="ml-1.5 text-[10px]" title={hotel.anomalyFlags.join('\n')} style={{ color: '#f59e0b' }}>⚠</span>
                              )}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-warm-slate)', opacity: 0.55 }}>
                              {hotel.category}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Verified MAP BAR */}
                      <td className="py-7 px-6 text-right">
                        <span className="text-[15px] font-semibold">{fmt(hotel.currentMapRate)}</span>
                      </td>

                      {/* Yesterday */}
                      <td className="py-7 px-6 text-right">
                        <span className="text-sm" style={{ color: 'var(--color-warm-slate)' }}>{fmt(hotel.yesterdayMapRate)}</span>
                      </td>

                      {/* Day Δ */}
                      <td className="py-7 px-6 text-right">
                        {hotel.deltaPercent != null ? (
                          <span className="text-sm font-bold" style={{ color: deltaColor }}>
                            {hotel.deltaPercent > 0 ? '+' : ''}{hotel.deltaPercent}%
                          </span>
                        ) : <span className="text-sm" style={{ color: 'var(--color-warm-slate)' }}>—</span>}
                      </td>

                      {/* OTA Winner */}
                      <td className="py-7 px-6">
                        <div>
                          <span className="text-[12px] font-semibold capitalize block"
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

                      {/* Sources */}
                      <td className="py-7 px-6 text-center">
                        {hotel.otaCount > 0 ? (
                          <span className="text-[11px] font-mono clay-inset px-2.5 py-1 rounded-lg"
                            style={{ color: 'var(--color-warm-slate)' }}>
                            {hotel.otaCount}/{hotel.otasChecked}
                          </span>
                        ) : <span style={{ color: 'var(--color-warm-slate)', fontSize: 12 }}>—</span>}
                      </td>

                      {/* Confidence */}
                      <td className="py-7 px-6">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-md"
                          style={{ background: confBg(hotel.confidenceLabel), color: confColor(hotel.confidenceLabel) }}>
                          {hotel.confidenceLabel}
                        </span>
                      </td>

                      {/* Freshness */}
                      <td className="py-7 px-6">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: freshColor(hotel.freshness) }} />
                          <span className="text-[10px] font-bold" style={{ color: freshColor(hotel.freshness) }}>
                            {freshLabel(hotel.freshness)}
                          </span>
                        </div>
                      </td>

                      {/* vs HKI */}
                      <td className="py-7 px-6 text-right">
                        {vsHki != null && !hotel.isTarget ? (
                          <span className="text-[12px] font-bold"
                            style={{ color: vsHki > 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                            {vsHki > 0 ? '+' : ''}{vsHki.toFixed(1)}%
                          </span>
                        ) : hotel.isTarget ? (
                          <span className="text-[9px] font-bold" style={{ color: 'var(--color-gold)' }}>BASELINE</span>
                        ) : <span style={{ color: 'var(--color-warm-slate)', fontSize: 12 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Footer */}
          <div className="px-6 py-3 flex items-center gap-4 flex-wrap" style={{ borderTop: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.015)' }}>
            {[['#10b981','HIGH = 2+ OTAs'], ['#f59e0b','MED = 1 OTA'], ['#ef4444','LOW = stale/unverified']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                <span className="text-[9px] font-semibold" style={{ color: 'var(--color-warm-slate)' }}>{l}</span>
              </div>
            ))}
            <span className="ml-auto text-[9px] font-mono" style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>
              BAR = Lowest MAP · Room+B+D · 2 adults · Tax incl.
            </span>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden flex flex-col gap-5">
          {loading ? Array(4).fill(0).map((_, i) => <div key={i} className="h-48 clay-card shimmer rounded-3xl" />)
            : sorted.map((hotel, i) => {
              const vsHki = hotel.currentMapRate && hki?.currentMapRate && !hotel.isTarget
                ? ((hotel.currentMapRate - hki.currentMapRate) / hki.currentMapRate * 100) : null;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="clay-card p-7 flex flex-col gap-5"
                  style={{ borderLeft: `3px solid ${hotel.isTarget ? 'var(--color-gold)' : confColor(hotel.confidenceLabel)}` }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight" style={{ color: hotel.isTarget ? 'var(--color-deep-bronze)' : 'var(--color-luxury-black)' }}>
                        {hotel.hotelName}
                      </h3>
                      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-warm-slate)' }}>{hotel.category}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-md"
                      style={{ background: confBg(hotel.confidenceLabel), color: confColor(hotel.confidenceLabel) }}>
                      {hotel.confidenceLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ['MAP BAR', fmt(hotel.currentMapRate)],
                      ['Day Δ', hotel.deltaPercent != null ? `${hotel.deltaPercent > 0 ? '+' : ''}${hotel.deltaPercent}%` : '—'],
                      ['vs HKI', vsHki != null ? `${vsHki > 0 ? '+' : ''}${vsHki.toFixed(1)}%` : hotel.isTarget ? 'BASE' : '—'],
                    ].map(([label, val]) => (
                      <div key={label} className="clay-inset p-3 rounded-xl text-center">
                        <p className="text-[8px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-warm-slate)' }}>{label}</p>
                        <p className="text-sm font-bold">{val}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold capitalize" style={{ color: 'var(--color-warm-slate)' }}>
                      {hotel.cheapestOta || '—'}
                      {hotel.otaCount > 0 && <span className="ml-1.5 opacity-50">({hotel.otaCount} OTAs)</span>}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: freshColor(hotel.freshness) }}>
                      {freshLabel(hotel.freshness)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
        </div>
      </section>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">

        {/* 30-day BAR Movement */}
        <section className="clay-card p-8 flex flex-col" style={{ height: 440 }}>
          <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
            <div>
              <h2 className="text-editorial-title">BAR Movement</h2>
              <p className="text-sm font-light" style={{ color: 'var(--color-warm-slate)' }}>Verified lowest MAP per hotel</p>
            </div>
            <div className="clay-inset p-1 rounded-xl flex gap-0.5">
              {[7, 30].map(d => (
                <button key={d} onClick={() => setHistoryDays(d)}
                  className="px-4 py-1.5 rounded-lg text-[9px] font-bold tracking-widest uppercase transition-all"
                  style={{ background: historyDays === d ? '#fff' : 'transparent', color: historyDays === d ? 'var(--color-luxury-black)' : 'var(--color-warm-slate)', boxShadow: historyDays === d ? '0 2px 8px rgba(17,17,17,0.08)' : 'none' }}>
                  {d}D
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 clay-inset rounded-2xl overflow-hidden p-4">
            {historyData.length < 2 ? (
              <div className="w-full h-full flex items-center justify-center text-sm font-light italic"
                style={{ color: 'var(--color-warm-slate)' }}>
                Awaiting verified history…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(17,17,17,0.05)" />
                  <XAxis dataKey="date" tickFormatter={v => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    stroke="var(--color-warm-slate)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-warm-slate)" fontSize={10} tickLine={false} axisLine={false}
                    tickFormatter={v => `₹${v / 1000}k`} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', borderRadius: 14, fontSize: 11 }}
                    formatter={(v: any, name: any) => [`₹${Number(v).toLocaleString('en-IN')}`, name]} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                  {Object.entries(HOTEL_COLORS).map(([slug, color]) => (
                    <Line key={slug} type="monotone" dataKey={slug}
                      name={slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      stroke={color} strokeWidth={slug === 'hotel-kodai-international' ? 3 : 1.5}
                      dot={false} strokeOpacity={slug === 'hotel-kodai-international' ? 1 : 0.55} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* OTA Variance */}
        <section className="clay-card p-8 flex flex-col">
          <div className="flex justify-between items-center mb-8 flex-wrap gap-3">
            <div>
              <h2 className="text-editorial-title">OTA Variance</h2>
              <p className="text-sm font-light" style={{ color: 'var(--color-warm-slate)' }}>
                {compAvg > 0
                  ? `Market avg MAP: ${fmt(compAvg)}`
                  : 'Verified BAR spread across competitive set'}
              </p>
            </div>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-negative)' }}>money_off</span>
          </div>

          <div className="flex flex-col gap-5 flex-1">
            {loading ? (
              Array(5).fill(0).map((_, i) => <div key={i} className="h-10 shimmer rounded-xl bg-black/5" />)
            ) : sorted.map((hotel, i) => {
              if (!hotel.currentMapRate) return null;
              const vsAvg = compAvg > 0 && !hotel.isTarget
                ? ((hotel.currentMapRate - compAvg) / compAvg * 100) : null;
              const barPct = compAvg > 0
                ? Math.min(100, Math.max(5, (hotel.currentMapRate / compAvg) * 60)) : 50;
              const barColor = hotel.isTarget ? 'var(--color-gold)' : vsAvg != null && vsAvg > 5 ? '#10b981' : vsAvg != null && vsAvg < -5 ? '#ef4444' : '#38bdf8';

              return (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                  className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[11px] font-bold tracking-tight" style={{ color: hotel.isTarget ? 'var(--color-deep-bronze)' : 'var(--color-warm-slate)' }}>
                      {hotel.hotelName.split(' ').slice(0, 3).join(' ')}
                      {hotel.isTarget && <span className="ml-1.5 badge-gold" style={{ fontSize: '7px', verticalAlign: 'middle' }}>TARGET</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold font-mono">{fmt(hotel.currentMapRate)}</span>
                      {vsAvg != null && (
                        <span className="text-[9px] font-bold"
                          style={{ color: vsAvg > 5 ? '#10b981' : vsAvg < -5 ? '#ef4444' : 'var(--color-warm-slate)' }}>
                          {vsAvg > 0 ? '+' : ''}{vsAvg.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-3 w-full rounded-full overflow-hidden clay-inset">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.06 }}
                      className="h-full rounded-full"
                      style={{ background: barColor }}
                    />
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[9px]" style={{ color: confColor(hotel.confidenceLabel), fontWeight: 700 }}>
                      {hotel.confidenceLabel} · {hotel.cheapestOta || '—'}
                    </span>
                    <span className="text-[9px]" style={{ color: freshColor(hotel.freshness) }}>
                      {freshLabel(hotel.freshness)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Parity status footer */}
          <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="clay-inset p-5 rounded-2xl"
              style={{ background: 'rgba(155,75,75,0.03)', border: '1px solid rgba(155,75,75,0.1)' }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-negative)' }}>info</span>
                <span className="text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--color-negative)' }}>
                  Rate Parity Status
                </span>
              </div>
              <p className="text-xs font-light leading-relaxed" style={{ color: 'var(--color-warm-slate)' }}>
                {hki?.cheapestOta && !hki.cheapestOta.startsWith('official')
                  ? `HKI lowest MAP found on ${hki.cheapestOta} — not the official site. Rate parity action recommended.`
                  : hki?.currentMapRate
                    ? 'HKI rate parity appears intact — lowest MAP is on official channel.'
                    : 'Awaiting HKI scrape data to assess parity.'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
