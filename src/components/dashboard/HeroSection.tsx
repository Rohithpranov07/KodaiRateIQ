'use client';

import { formatINR } from '@/lib/utils';

interface HeroProps {
  recommendation: any;
  loading: boolean;
}

export function HeroSection({ recommendation, loading }: HeroProps) {
  if (loading) {
    return (
      <section className="relative overflow-hidden rounded-2xl p-8 lg:p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent" />
        <div className="relative space-y-6">
          <div className="shimmer h-6 w-64" />
          <div className="shimmer h-16 w-48" />
          <div className="shimmer h-4 w-96" />
        </div>
      </section>
    );
  }

  const rate = recommendation?.recommendedMapRate ?? 8400;
  const confidence = recommendation?.confidenceScore ?? 0.85;
  const strategy = recommendation?.strategy ?? 'balanced';
  const season = recommendation?.seasonType ?? 'shoulder';
  const demand = recommendation?.demandLevel ?? 'medium';
  const position = recommendation?.marketPosition ?? 'at-market';

  const positionLabel: Record<string, string> = {
    'below-market': 'Below Market',
    'at-market': 'At Market',
    'above-market': 'Above Market',
  };

  const strategyColors: Record<string, string> = {
    aggressive: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    conservative: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    balanced: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    premium: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };

  return (
    <section className="relative overflow-hidden rounded-2xl glass-card glow-primary">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-8 lg:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Main Rate */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 pulse-live" />
              <span className="text-xs uppercase tracking-widest text-[#8b8b9e] font-medium">
                Recommended HKI Rate — Today
              </span>
            </div>

            <div className="flex items-baseline gap-4">
              <h2 className="text-5xl lg:text-7xl font-black tracking-tight gradient-text font-mono">
                {formatINR(rate)}
              </h2>
              <span className="text-lg text-[#8b8b9e]">/night MAP</span>
            </div>

            <p className="text-[#8b8b9e] max-w-2xl leading-relaxed">
              {recommendation?.reasoning ?? 'AI-powered pricing recommendation based on real-time competitor analysis, seasonal demand patterns, and market positioning strategy for Hotel Kodai International.'}
            </p>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-3 pt-2">
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium border ${strategyColors[strategy] || strategyColors.balanced}`}>
                {strategy.charAt(0).toUpperCase() + strategy.slice(1)} Strategy
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                {season.charAt(0).toUpperCase() + season.slice(1)} Season
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20">
                {positionLabel[position] || 'At Market'}
              </span>
            </div>
          </div>

          {/* Side metrics */}
          <div className="space-y-4">
            <MetricCard
              label="Confidence Score"
              value={`${Math.round(confidence * 100)}%`}
              color={confidence > 0.8 ? 'emerald' : confidence > 0.6 ? 'amber' : 'rose'}
              progress={confidence}
            />
            <MetricCard
              label="Demand Level"
              value={demand.charAt(0).toUpperCase() + demand.slice(1)}
              color={demand === 'high' ? 'emerald' : demand === 'medium' ? 'amber' : 'rose'}
            />
            <MetricCard
              label="Rate Range"
              value={`${formatINR(recommendation?.minRate ?? 7800)} – ${formatINR(recommendation?.maxRate ?? 9200)}`}
              color="indigo"
              small
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value, color, progress, small }: {
  label: string;
  value: string;
  color: string;
  progress?: number;
  small?: boolean;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    indigo: 'text-indigo-400',
  };

  const bgMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    indigo: 'bg-indigo-500',
  };

  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <p className="text-xs text-[#8b8b9e] mb-1">{label}</p>
      <p className={`${small ? 'text-sm font-mono' : 'text-xl'} font-bold ${colorMap[color]}`}>
        {value}
      </p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full ${bgMap[color]} transition-all duration-1000`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
