'use client';

import { formatINR } from '@/lib/utils';

interface RecommendationPanelProps {
  recommendation: any;
  loading: boolean;
}

export function RecommendationPanel({ recommendation, loading }: RecommendationPanelProps) {
  if (loading) {
    return (
      <section className="glass-card p-6">
        <div className="shimmer h-6 w-64 mb-6" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="shimmer h-24 w-full" />)}
        </div>
      </section>
    );
  }

  const rec = recommendation;
  if (!rec) {
    return (
      <section className="glass-card p-8 text-center text-[#5a5a6e]">
        <p>No recommendation available. Run the AI engine to generate recommendations.</p>
      </section>
    );
  }

  const strategies = [
    {
      label: 'Aggressive',
      rate: Math.round(rec.minRate * 0.95),
      desc: 'Maximize occupancy, sacrifice margin',
      color: 'rose',
    },
    {
      label: 'Balanced',
      rate: rec.optimalRate || rec.recommendedMapRate,
      desc: 'Optimal balance of rate and occupancy',
      color: 'emerald',
      active: rec.strategy === 'balanced',
    },
    {
      label: 'Conservative',
      rate: rec.maxRate,
      desc: 'Maximize revenue per room',
      color: 'amber',
    },
    {
      label: 'Premium',
      rate: Math.round(rec.maxRate * 1.08),
      desc: 'Premium positioning for peak demand',
      color: 'purple',
    },
  ];

  const colorMap: Record<string, { text: string; bg: string; border: string }> = {
    rose: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  };

  return (
    <section id="recommendation" className="glass-card overflow-hidden">
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold">Pricing Strategy</h3>
          <p className="text-xs text-[#5a5a6e]">AI-Generated Pricing Scenarios</p>
        </div>
      </div>

      <div className="p-6">
        {/* Strategy cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {strategies.map((s) => {
            const c = colorMap[s.color];
            return (
              <div
                key={s.label}
                className={`p-4 rounded-xl border transition-all ${
                  s.active ? `${c.border} ${c.bg} glow-success` : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium uppercase tracking-wider ${s.active ? c.text : 'text-[#8b8b9e]'}`}>
                    {s.label}
                  </span>
                  {s.active && (
                    <span className={`px-1.5 py-0.5 text-[9px] rounded-full ${c.bg} ${c.text} border ${c.border}`}>
                      Active
                    </span>
                  )}
                </div>
                <p className={`text-2xl font-bold font-mono ${s.active ? c.text : 'text-white'}`}>
                  {formatINR(s.rate)}
                </p>
                <p className="text-[10px] text-[#5a5a6e] mt-1">{s.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Rate details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <DetailCard label="MAP Rate" value={formatINR(rec.recommendedMapRate)} subtitle="Room + Breakfast + Dinner" />
          <DetailCard label="CP Rate" value={formatINR(rec.recommendedCpRate)} subtitle="Room + Breakfast" />
          <DetailCard label="EP Rate" value={formatINR(rec.recommendedEpRate)} subtitle="Room Only" />
        </div>

        {/* AI Reasoning */}
        <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider">AI Reasoning</span>
            <span className="px-1.5 py-0.5 text-[9px] rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Gemini 2.5
            </span>
          </div>
          <p className="text-sm text-[#8b8b9e] leading-relaxed">{rec.reasoning}</p>
        </div>

        {/* Competitor positioning */}
        {rec.competitorRates && rec.competitorRates.length > 0 && (
          <div className="mt-6">
            <h4 className="text-xs font-medium text-[#5a5a6e] uppercase tracking-wider mb-3">Market Positioning</h4>
            <div className="relative h-12 bg-white/[0.03] rounded-lg overflow-hidden">
              {rec.competitorRates.filter((c: any) => c.bestMapRate).map((c: any, i: number) => {
                const maxRate = Math.max(...rec.competitorRates.filter((r: any) => r.bestMapRate).map((r: any) => r.bestMapRate));
                const position = (c.bestMapRate / maxRate) * 100;
                const colors = ['#f59e0b', '#a855f7', '#6366f1', '#06b6d4', '#10b981'];
                return (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 flex items-center"
                    style={{ left: `${Math.max(5, Math.min(95, position * 0.85 + 5))}%` }}
                    title={`${c.hotelName}: ${formatINR(c.bestMapRate)}`}
                  >
                    <div className="flex flex-col items-center">
                      <div
                        className="w-3 h-3 rounded-full border-2"
                        style={{ borderColor: colors[i % colors.length], background: `${colors[i % colors.length]}40` }}
                      />
                      <span className="text-[8px] text-[#5a5a6e] mt-1 whitespace-nowrap">
                        {c.hotelName.split(' ').slice(-1)[0]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-[#5a5a6e] mt-1">
              <span>Lower</span>
              <span>Higher</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function DetailCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <p className="text-xs text-[#5a5a6e] mb-1">{label}</p>
      <p className="text-xl font-bold font-mono text-white">{value}</p>
      <p className="text-[10px] text-[#5a5a6e] mt-0.5">{subtitle}</p>
    </div>
  );
}
