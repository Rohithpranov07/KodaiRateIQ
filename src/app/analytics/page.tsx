'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const HOTEL_COLORS: Record<string, string> = {
  hki:      'var(--color-gold)',
  sterling: '#38bdf8',
  lePoshe:  '#a78bfa',
  carlton:  'var(--color-warm-slate)',
  tamara:   'var(--color-deep-bronze)',
};

const AVAILABILITY_LABEL: Record<string, string> = {
  'sold-out': 'Sold Out',
  'limited':  'Limited',
  'available':'Available',
  'no-data':  'No Data',
};

export default function AnalyticsPage() {
  const [data, setData]             = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [timeRange, setTimeRange]   = useState('30D');
  const [loading, setLoading]       = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const days = timeRange === '7D' ? 7 : timeRange === '90D' ? 90 : timeRange === '1Y' ? 365 : 30;
      const [analyticsRes, historyRes] = await Promise.all([
        fetch(`/api/analytics?days=${timeRange}`),
        fetch(`/api/rates/history?days=${days}`),
      ]);
      const [analyticsJson, historyJson] = await Promise.all([
        analyticsRes.json(), historyRes.json(),
      ]);
      if (analyticsJson.success) setData(analyticsJson.data);
      if (historyJson.success)   setHistoryData(historyJson.data?.history ?? []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [timeRange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const kpis: any[]            = data?.kpis ?? [];
  const heatmap: any[]         = data?.heatmap ?? [];
  const competitorTrend: any[] = data?.competitorTrend ?? [];
  const otaWinners: any[]      = data?.otaWinnerRanking ?? [];
  const hasData: boolean       = data?.hasData ?? false;
  const dateRange              = data?.dateRange;

  const timeRanges = ['7D', '30D', '90D', 'YTD', '1Y'];

  return (
    <DashboardLayout>

      {/* ── Header ── */}
      <section className="mb-8">
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="section-eyebrow">
          <span className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'var(--color-gold)' }}>
            Quantitative Intelligence
          </span>
        </motion.div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-display-luxury mb-3 -mt-1">Market Analytics</h1>
            <p className="text-base font-light leading-relaxed max-w-2xl" style={{ color: 'var(--color-warm-slate)' }}>
              Real data only — all metrics derived exclusively from verified OTA scrapes.
              {dateRange && <span className="ml-2 text-[10px] font-mono opacity-60">{dateRange.from} → {dateRange.to} · {dateRange.dataPoints} data points</span>}
            </p>
          </div>
          <button onClick={fetchAll} className="clay-inset px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase hover:opacity-70 transition-opacity shrink-0"
            style={{ color: 'var(--color-gold)' }}>
            Refresh
          </button>
        </div>
      </section>

      {/* ── Time range ── */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1 scrollbar-hide">
        <div className="clay-inset p-1 rounded-2xl flex gap-1 shrink-0">
          {timeRanges.map(p => (
            <button key={p} onClick={() => setTimeRange(p)}
              className="px-5 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all whitespace-nowrap"
              style={{
                background: timeRange === p ? 'var(--color-luxury-black)' : 'transparent',
                color: timeRange === p ? '#fff' : 'var(--color-warm-slate)',
                boxShadow: timeRange === p ? '0 2px 8px rgba(17,17,17,0.2)' : 'none',
              }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* No data state */}
      {!loading && !hasData && (
        <div className="clay-card p-12 text-center mb-8">
          <span className="material-symbols-outlined text-5xl mb-4 block" style={{ color: 'var(--color-warm-slate)', opacity: 0.2 }}>analytics</span>
          <p className="text-lg font-light" style={{ color: 'var(--color-warm-slate)' }}>No verified data yet</p>
          <p className="text-sm mt-2 opacity-60" style={{ color: 'var(--color-warm-slate)' }}>
            Run a scrape cycle to populate real BAR analytics.
          </p>
        </div>
      )}

      {/* ── KPI Grid ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
        {(kpis.length > 0 ? kpis : Array(4).fill(null)).map((kpi: any, i: number) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="clay-card p-6">
            <p className="text-label-luxury mb-3">{kpi?.label ?? '—'}</p>
            <div className="text-3xl font-semibold mb-3"
              style={{ color: kpi?.color ?? 'var(--color-luxury-black)', letterSpacing: '-0.03em' }}>
              {loading ? <div className="h-8 w-24 shimmer rounded-lg bg-black/5" /> : (kpi?.value ?? '—')}
            </div>
            {!loading && kpi && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className={kpi.delta?.toString().startsWith('+') ? 'badge-positive' : 'badge-gold'}>
                  {kpi.delta}
                </span>
                {!kpi.isReal && (
                  <span className="text-[8px] font-bold tracking-widest" style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>
                    PENDING DATA
                  </span>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </section>

      {/* ── BAR Volatility Chart ── */}
      <section className="clay-card p-8 mb-8 flex flex-col" style={{ height: 460 }}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-7">
          <div>
            <div className="section-eyebrow">
              <span className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'var(--color-gold)' }}>Verified Historical Snapshots</span>
            </div>
            <h2 className="text-editorial-title -mt-1">BAR Trajectory</h2>
            <p className="text-sm font-light mt-0.5" style={{ color: 'var(--color-warm-slate)' }}>
              All lines = lowest verified MAP rate per hotel per day
            </p>
          </div>
        </div>

        <div className="flex-1 clay-inset rounded-2xl overflow-hidden p-5">
          {loading ? (
            <div className="w-full h-full shimmer flex items-center justify-center text-sm font-light italic"
              style={{ color: 'var(--color-warm-slate)' }}>
              Loading verified rate history…
            </div>
          ) : historyData.length < 2 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center">
              <p className="text-lg font-light" style={{ color: 'var(--color-warm-slate)' }}>Awaiting data</p>
              <p className="text-xs mt-2 opacity-60" style={{ color: 'var(--color-warm-slate)' }}>
                At least 2 scrape cycles needed to plot trajectory.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="gradHki" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-gold)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(17,17,17,0.04)" />
                <XAxis dataKey="date"
                  tickFormatter={v => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  stroke="var(--color-warm-slate)" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="var(--color-warm-slate)" fontSize={10} tickLine={false} axisLine={false}
                  tickFormatter={v => `₹${v / 1000}k`} dx={-10} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 8px 32px rgba(17,17,17,0.1)', fontSize: 12 }}
                  labelFormatter={v => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  formatter={(v: any, name: any) => [`₹${Number(v).toLocaleString('en-IN')}`, name]} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 12 }} />
                <Area type="monotone" dataKey="hotel-kodai-international" name="HKI"
                  stroke={HOTEL_COLORS.hki} strokeWidth={3} fill="url(#gradHki)" />
                <Area type="monotone" dataKey="sterling-kodai-lake" name="Sterling"
                  stroke={HOTEL_COLORS.sterling} strokeWidth={1.5} fillOpacity={0} strokeOpacity={0.6} />
                <Area type="monotone" dataKey="le-poshe-by-sparsa" name="Le Poshe"
                  stroke={HOTEL_COLORS.lePoshe} strokeWidth={1.5} fillOpacity={0} strokeOpacity={0.6} />
                <Area type="monotone" dataKey="the-carlton" name="Carlton"
                  stroke={HOTEL_COLORS.carlton} strokeWidth={1} fillOpacity={0} strokeOpacity={0.3} />
                <Area type="monotone" dataKey="the-tamara-kodai" name="Tamara"
                  stroke={HOTEL_COLORS.tamara} strokeWidth={1} fillOpacity={0} strokeOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ── Competitor BAR Trend (from analytics API) ── */}
      {competitorTrend.length > 1 && (
        <section className="clay-card p-8 mb-8 flex flex-col" style={{ height: 380 }}>
          <div className="mb-6">
            <div className="section-eyebrow">
              <span className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'var(--color-gold)' }}>Cross-Hotel Comparison</span>
            </div>
            <h2 className="text-editorial-title -mt-1">BAR Spread vs Market</h2>
            <p className="text-sm font-light mt-0.5" style={{ color: 'var(--color-warm-slate)' }}>
              Daily lowest MAP rate per hotel from verified snapshots
            </p>
          </div>
          <div className="flex-1 clay-inset rounded-2xl overflow-hidden p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={competitorTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(17,17,17,0.04)" />
                <XAxis dataKey="date"
                  tickFormatter={v => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  stroke="var(--color-warm-slate)" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="var(--color-warm-slate)" fontSize={10} tickLine={false} axisLine={false}
                  tickFormatter={v => `₹${v / 1000}k`} dx={-10} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', borderRadius: 14, fontSize: 11 }}
                  formatter={(v: any, name: any) => [`₹${Number(v).toLocaleString('en-IN')}`, name]} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                <Line type="monotone" dataKey="hki"      name="HKI"     stroke={HOTEL_COLORS.hki}     strokeWidth={3} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="sterling" name="Sterling" stroke={HOTEL_COLORS.sterling} strokeWidth={1.5} dot={false} strokeOpacity={0.7} />
                <Line type="monotone" dataKey="lePoshe"  name="Le Poshe" stroke={HOTEL_COLORS.lePoshe}  strokeWidth={1.5} dot={false} strokeOpacity={0.7} />
                <Line type="monotone" dataKey="carlton"  name="Carlton"  stroke={HOTEL_COLORS.carlton}  strokeWidth={1}   dot={false} strokeOpacity={0.4} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── Bottom two columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">

        {/* OTA Winner Ranking */}
        <section className="clay-card p-8">
          <div className="flex justify-between items-start mb-7">
            <div>
              <div className="section-eyebrow">
                <span className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'var(--color-gold)' }}>Real OTA Data</span>
              </div>
              <h3 className="text-editorial-title -mt-1">OTA Winner Ranking</h3>
              <p className="text-sm font-light mt-0.5" style={{ color: 'var(--color-warm-slate)' }}>
                Which OTA had the lowest verified MAP BAR most often
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)' }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-gold)' }}>leaderboard</span>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => <div key={i} className="h-10 shimmer rounded-xl bg-black/5" />)}
            </div>
          ) : otaWinners.length === 0 ? (
            <div className="text-center py-10">
              <p className="font-light italic" style={{ color: 'var(--color-warm-slate)' }}>
                No winner data yet — scrape cycles needed.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {otaWinners.slice(0, 8).map((ota: any, i: number) => (
                <motion.div key={ota.source} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-4">
                  <span className="text-[11px] font-bold w-5 text-right" style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[12px] font-semibold capitalize"
                        style={{ color: i === 0 ? 'var(--color-gold)' : 'var(--color-luxury-black)' }}>
                        {ota.source.replace('official:', '★ ').replace(/\//g, '/')}
                      </span>
                      <span className="text-[10px] font-bold font-mono" style={{ color: 'var(--color-warm-slate)' }}>
                        {ota.pct}% · {ota.count}×
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden"
                      style={{ background: 'rgba(17,17,17,0.06)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${ota.pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.05 }}
                        className="h-full rounded-full"
                        style={{ background: i === 0 ? 'var(--color-gold)' : i < 3 ? '#38bdf8' : 'rgba(107,101,96,0.3)' }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Demand Density Heatmap */}
        <section className="clay-card p-8">
          <div className="flex justify-between items-start mb-7">
            <div>
              <div className="section-eyebrow">
                <span className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'var(--color-gold)' }}>Availability Patterns</span>
              </div>
              <h3 className="text-editorial-title -mt-1">Demand Density</h3>
              <p className="text-sm font-light mt-0.5" style={{ color: 'var(--color-warm-slate)' }}>
                Based on availability snapshots — darker = higher pressure
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)' }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-gold)' }}>grid_view</span>
            </div>
          </div>

          <div className="grid gap-1.5 mb-4" style={{ gridTemplateColumns: 'repeat(7, 1fr)', height: 160 }}>
            {heatmap.length > 0
              ? heatmap.map((h: any, i: number) => (
                <motion.div key={i}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.008 }}
                  className="rounded-lg transition-transform hover:scale-110 cursor-default"
                  title={`${h.date} — ${AVAILABILITY_LABEL[h.availability] ?? h.availability}`}
                  style={{
                    background: `rgba(${h.availability === 'sold-out' ? '239,68,68' : h.availability === 'limited' ? '245,158,11' : '198,167,105'},${h.intensity})`,
                    minHeight: 18,
                  }}
                />
              ))
              : Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="rounded-lg bg-black/5 shimmer" style={{ minHeight: 18 }} />
              ))}
          </div>

          <div className="flex items-center justify-between px-1 mt-4">
            <div className="flex items-center gap-4 flex-wrap">
              {[['#ef4444', 'Sold Out'], ['#f59e0b', 'Limited'], ['rgba(198,167,105,0.8)', 'Available'], ['rgba(0,0,0,0.08)', 'No data']].map(([c, l]) => (
                <div key={String(l)} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm" style={{ background: String(c) }} />
                  <span className="text-[9px] font-semibold" style={{ color: 'var(--color-warm-slate)' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
