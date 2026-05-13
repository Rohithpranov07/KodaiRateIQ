'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

const fmt = (n: number | null | undefined) => n == null ? '—' : `₹${n.toLocaleString('en-IN')}`;
const confColor = (l: string) => ({ HIGH: '#10b981', MEDIUM: '#f59e0b', LOW: '#ef4444' }[l] ?? '#6b7280');
const confBg    = (l: string) => ({ HIGH: 'rgba(16,185,129,0.12)', MEDIUM: 'rgba(245,158,11,0.12)', LOW: 'rgba(239,68,68,0.12)' }[l] ?? 'rgba(0,0,0,0.05)');

export default function RecommendationsPage() {
  const [recommendation, setRecommendation] = useState<any>(null);
  const [liveRates, setLiveRates]           = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [applying, setApplying]             = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [recRes, ratesRes] = await Promise.all([
        fetch('/api/recommendation'),
        fetch('/api/rates/live'),
      ]);
      const [recData, ratesData] = await Promise.all([recRes.json(), ratesRes.json()]);
      if (recData.success && recData.data)     setRecommendation(recData.data);
      if (ratesData.success && ratesData.data) setLiveRates(ratesData.data.rates ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleApply = async (strategy: string) => {
    if (!recommendation || applying) return;
    setApplying(true);
    try {
      await fetch('/api/strategy/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: recommendation.id, strategy }),
      });
      fetchAll();
    } finally { setApplying(false); }
  };

  const confScore  = recommendation ? Math.round(recommendation.confidenceScore * 100) : 0;
  const strokeCirc = 289;
  const strokeDash = (confScore / 100) * strokeCirc;

  const hki = liveRates.find(r => r.isTarget);

  const strategies = [
    { key: 'optimal',      label: 'Optimal',      tag: 'RECOMMENDED',   value: recommendation?.optimalRate,      sub: `${recommendation?.strategy ?? 'Balanced'} focus`, highlight: true  },
    { key: 'aggressive',   label: 'Aggressive',   tag: 'VOLUME FOCUS',  value: recommendation?.minRate,          sub: 'Maximise occupancy',                                highlight: false },
    { key: 'conservative', label: 'Conservative', tag: 'YIELD FOCUS',   value: recommendation?.maxRate,          sub: 'Maximise RevPAR',                                  highlight: false },
  ];

  return (
    <DashboardLayout>

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-5">
        <div>
          <div className="section-eyebrow">
            <span className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'var(--color-gold)' }}>Strategic Pricing Intelligence</span>
          </div>
          <h1 className="text-display-luxury -mt-1">MAP Rate Optimization</h1>
          <p className="text-sm font-light mt-2" style={{ color: 'var(--color-warm-slate)' }}>
            Hotel Kodai International · AI recommendation from verified BAR data
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button onClick={fetchAll} className="clay-button-ghost px-5 py-2.5 text-[10px] font-bold tracking-widest uppercase">
            Refresh
          </button>
          <button onClick={() => handleApply('optimal')} disabled={applying || recommendation?.isApplied}
            className="clay-button-gold px-5 py-2.5 text-[10px] uppercase">
            {applying ? 'Applying…' : recommendation?.isApplied ? 'Active' : 'Apply Strategy'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Main recommendation panel ── */}
        <div className="lg:col-span-8 clay-panel p-8 relative overflow-hidden flex flex-col justify-between" style={{ minHeight: 380 }}>
          <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full pointer-events-none blur-3xl"
            style={{ background: 'rgba(201,169,110,0.12)' }} />

          <div className="flex flex-col md:flex-row justify-between items-start gap-8 z-10">
            {/* Rate info */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.25)' }}>
                  <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-gold)' }}>auto_awesome</span>
                </div>
                <span className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--color-gold)' }}>Optimal MAP Rate</span>
              </div>

              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-sm font-medium" style={{ color: 'var(--color-warm-slate)' }}>INR</span>
                <span className="text-display-luxury" style={{ fontWeight: 200 }}>
                  {loading ? <span className="inline-block w-48 h-12 shimmer rounded-xl bg-black/5" />
                    : (recommendation?.recommendedMapRate?.toLocaleString('en-IN') ?? '—')}
                </span>
                <span className="text-base font-light" style={{ color: 'var(--color-warm-slate)' }}>/ night</span>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="clay-inset px-5 py-3.5 rounded-2xl">
                  <p className="text-label-luxury mb-1.5">Strategy</p>
                  <p className="text-lg font-semibold capitalize" style={{ color: 'var(--color-positive)' }}>
                    {loading ? '—' : recommendation?.strategy ?? 'Balanced'}
                  </p>
                </div>
                <div className="clay-inset px-5 py-3.5 rounded-2xl">
                  <p className="text-label-luxury mb-1.5">Demand</p>
                  <p className="text-lg font-semibold capitalize" style={{ color: 'var(--color-luxury-black)' }}>
                    {loading ? '—' : recommendation?.demandLevel ?? 'Medium'}
                    {recommendation?.seasonType && (
                      <span className="text-sm ml-1.5 font-normal capitalize" style={{ color: 'var(--color-warm-slate)' }}>
                        ({recommendation.seasonType})
                      </span>
                    )}
                  </p>
                </div>
                {/* Current verified BAR vs recommendation */}
                {hki?.currentMapRate && recommendation?.recommendedMapRate && (
                  <div className="clay-inset px-5 py-3.5 rounded-2xl">
                    <p className="text-label-luxury mb-1.5">Current BAR</p>
                    <div>
                      <p className="text-lg font-semibold">{fmt(hki.currentMapRate)}</p>
                      <p className="text-[10px] font-bold mt-0.5"
                        style={{ color: recommendation.recommendedMapRate > hki.currentMapRate ? '#10b981' : recommendation.recommendedMapRate < hki.currentMapRate ? '#ef4444' : 'var(--color-warm-slate)' }}>
                        {recommendation.recommendedMapRate > hki.currentMapRate ? '↑ Raise recommended'
                          : recommendation.recommendedMapRate < hki.currentMapRate ? '↓ Lower recommended'
                          : '→ Hold current rate'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Confidence meter */}
            <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 rounded-full"
                style={{ background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: 'inset 0 2px 12px rgba(17,17,17,0.04)' }} />
              <svg className="absolute w-[115%] h-[115%] -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(17,17,17,0.06)" strokeWidth="5" strokeDasharray={`${strokeCirc} ${strokeCirc}`} />
                <motion.circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-gold)" strokeWidth="5"
                  strokeDasharray={`${strokeCirc} ${strokeCirc}`}
                  initial={{ strokeDashoffset: strokeCirc }}
                  animate={{ strokeDashoffset: strokeCirc - strokeDash }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  strokeLinecap="round" />
              </svg>
              <div className="relative flex flex-col items-center justify-center z-10">
                <span className="text-4xl font-semibold tracking-tight" style={{ color: 'var(--color-luxury-black)' }}>
                  {loading ? '—' : confScore}<span className="text-xl font-medium">%</span>
                </span>
                <span className="text-[9px] font-bold tracking-[0.16em] uppercase mt-1" style={{ color: 'var(--color-warm-slate)' }}>Confidence</span>
              </div>
            </div>
          </div>

          {/* AI Reasoning */}
          <div className="mt-7 z-10 clay-inset p-5 rounded-2xl">
            <p className="text-[10px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--color-warm-slate)' }}>AI Reasoning</p>
            <p className="text-sm font-light leading-relaxed" style={{ color: 'var(--color-luxury-black)' }}>
              {loading ? 'Analyzing market conditions…' : recommendation?.reasoning ?? 'No analysis available for current date.'}
            </p>
          </div>
        </div>

        {/* ── Strategy cards ── */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {strategies.map(({ key, label, tag, value, sub, highlight }) => (
            <motion.div key={key} whileHover={{ scale: 1.01 }}
              className={`p-6 rounded-2xl cursor-pointer transition-all relative ${highlight ? 'clay-panel' : 'clay-card'}`}
              style={highlight ? { border: '1.5px solid rgba(201,169,110,0.4)' } : {}}
              onClick={() => handleApply(key)}>
              {highlight && <div className="absolute top-4 right-4"><span className="badge-gold">Recommended</span></div>}
              <p className="text-label-luxury mb-3">{tag}</p>
              <p className="text-[15px] font-semibold mb-1" style={{ color: highlight ? 'var(--color-luxury-black)' : 'var(--color-warm-slate)' }}>
                {label}
              </p>
              <p className="text-2xl font-semibold mb-1" style={{ color: 'var(--color-luxury-black)' }}>
                {loading ? '—' : fmt(value)}
              </p>
              <p className="text-[11px] font-medium capitalize" style={{ color: 'var(--color-warm-slate)' }}>{sub}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Competitor BAR context (full width) ── */}
        <div className="lg:col-span-12 clay-card p-8">
          <div className="mb-6">
            <div className="section-eyebrow">
              <span className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'var(--color-gold)' }}>Live OTA Data</span>
            </div>
            <h3 className="text-editorial-title -mt-1">Competitor BAR Context</h3>
            <p className="text-sm font-light mt-0.5" style={{ color: 'var(--color-warm-slate)' }}>
              Verified lowest MAP rates informing this recommendation
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Array(5).fill(0).map((_, i) => <div key={i} className="h-28 shimmer rounded-2xl bg-black/5" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {liveRates.map((hotel, i) => {
                const vsRec = hotel.currentMapRate && recommendation?.recommendedMapRate
                  ? ((hotel.currentMapRate - recommendation.recommendedMapRate) / recommendation.recommendedMapRate * 100) : null;
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                    className="clay-inset p-5 rounded-2xl flex flex-col gap-2"
                    style={{ borderTop: `3px solid ${hotel.isTarget ? 'var(--color-gold)' : confColor(hotel.confidenceLabel)}` }}>
                    <p className="text-[10px] font-bold tracking-tight truncate"
                      style={{ color: hotel.isTarget ? 'var(--color-deep-bronze)' : 'var(--color-warm-slate)' }}>
                      {hotel.hotelName.split(' ').slice(0, 3).join(' ')}
                      {hotel.isTarget && ' ★'}
                    </p>
                    <p className="text-lg font-semibold" style={{ color: 'var(--color-luxury-black)' }}>
                      {fmt(hotel.currentMapRate)}
                    </p>
                    {hotel.cheapestOta && (
                      <p className="text-[9px] capitalize font-semibold truncate" style={{ color: 'var(--color-gold)' }}>
                        {hotel.cheapestOta}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: confBg(hotel.confidenceLabel), color: confColor(hotel.confidenceLabel) }}>
                        {hotel.confidenceLabel}
                      </span>
                      {vsRec != null && !hotel.isTarget && (
                        <span className="text-[9px] font-bold"
                          style={{ color: vsRec > 10 ? '#10b981' : vsRec < -10 ? '#ef4444' : 'var(--color-warm-slate)' }}>
                          {vsRec > 0 ? '+' : ''}{vsRec.toFixed(0)}% vs rec
                        </span>
                      )}
                    </div>
                    {hotel.otaCount > 0 && (
                      <p className="text-[9px] font-mono" style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>
                        {hotel.otaCount}/{hotel.otasChecked} OTAs
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Market position summary */}
          {!loading && recommendation && (
            <div className="mt-6 pt-5 grid grid-cols-2 md:grid-cols-4 gap-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              {[
                { label: 'Market Position',   value: recommendation.marketPosition?.replace(/-/g, ' ') ?? '—' },
                { label: 'Weekend Premium',   value: recommendation.weekendPremium ? `+${recommendation.weekendPremium}%` : '—' },
                { label: 'Range',             value: `${fmt(recommendation.minRate)} – ${fmt(recommendation.maxRate)}` },
                { label: 'Avg Competitor BAR',value: recommendation.competitorRates?.filter((r: any) => r.bestMapRate).length > 0
                  ? fmt(recommendation.competitorRates.filter((r: any) => r.bestMapRate).reduce((s: number, r: any) => s + r.bestMapRate, 0) / recommendation.competitorRates.filter((r: any) => r.bestMapRate).length)
                  : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="clay-inset p-4 rounded-xl">
                  <p className="text-label-luxury mb-1">{label}</p>
                  <p className="text-base font-semibold capitalize" style={{ color: 'var(--color-luxury-black)' }}>{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
