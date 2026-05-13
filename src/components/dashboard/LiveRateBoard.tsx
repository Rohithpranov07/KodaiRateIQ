'use client';

import { formatINR, formatDelta } from '@/lib/utils';

interface LiveRateBoardProps {
  rates: any[] | undefined;
  loading: boolean;
}

// ── Confidence badge config ───────────────────────────────────
const CONFIDENCE_CONFIG = {
  HIGH:   { label: 'HIGH',   bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-500', tooltip: 'Verified across 2+ OTA sources' },
  MEDIUM: { label: 'MED',    bg: 'bg-amber-500/15',   text: 'text-amber-400',   dot: 'bg-amber-500',   tooltip: 'Single-source verified' },
  LOW:    { label: 'LOW',    bg: 'bg-rose-500/15',    text: 'text-rose-400',    dot: 'bg-rose-500',    tooltip: 'Limited or stale data' },
};

const FRESHNESS_CONFIG = {
  fresh:    { label: 'LIVE',    color: 'text-emerald-400', dot: 'bg-emerald-500 pulse-live' },
  recent:   { label: 'RECENT',  color: 'text-sky-400',     dot: 'bg-sky-400' },
  aging:    { label: 'AGING',   color: 'text-amber-400',   dot: 'bg-amber-400' },
  stale:    { label: 'STALE',   color: 'text-rose-400',    dot: 'bg-rose-500' },
  'no-data':{ label: 'NO DATA', color: 'text-[#5a5a6e]',  dot: 'bg-[#5a5a6e]' },
};

function ConfidenceBadge({ label, count, checked }: { label: string; count: number; checked: number }) {
  const cfg = CONFIDENCE_CONFIG[label as keyof typeof CONFIDENCE_CONFIG] ?? CONFIDENCE_CONFIG.LOW;
  return (
    <span title={cfg.tooltip} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
      {count > 0 && <span className="opacity-70 font-mono text-[9px]">{count}/{checked}</span>}
    </span>
  );
}

function FreshnessDot({ freshness, lastVerifiedAt }: { freshness: string; lastVerifiedAt: string | null }) {
  const cfg = FRESHNESS_CONFIG[freshness as keyof typeof FRESHNESS_CONFIG] ?? FRESHNESS_CONFIG['no-data'];
  const timeStr = lastVerifiedAt ? formatTimeAgo(lastVerifiedAt) : '—';
  return (
    <span title={`Last verified: ${timeStr}`} className="inline-flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      <span className={`text-[10px] font-mono ${cfg.color}`}>{cfg.label}</span>
    </span>
  );
}

function OtaWinnerBadge({ source, breakdown }: { source: string | null; breakdown: Record<string, number> | null }) {
  if (!source) return <span className="text-[#5a5a6e] text-xs">—</span>;

  const otaLabel = source.replace('official:', '').replace(/\//g, ' / ').replace(/-/g, '.');
  const winnerRate = breakdown?.[source];

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[#8b8b9e] capitalize font-medium">{otaLabel}</span>
      {winnerRate && (
        <span className="text-[10px] font-mono text-emerald-400/70">
          {formatINR(winnerRate)}
        </span>
      )}
    </div>
  );
}

function OtaBreakdownTooltip({ breakdown }: { breakdown: Record<string, number> | null }) {
  if (!breakdown || Object.keys(breakdown).length === 0) return null;

  const sorted = Object.entries(breakdown).sort(([, a], [, b]) => a - b);
  const minRate = sorted[0]?.[1];

  return (
    <div className="group relative inline-flex">
      <button className="text-[10px] text-[#5a5a6e] hover:text-[#8b8b9e] border border-white/[0.08] rounded px-1.5 py-0.5 font-mono transition-colors">
        {sorted.length} OTAs ▾
      </button>
      {/* Dropdown on hover */}
      <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover:block z-50 min-w-[180px] glass-card border border-white/[0.08] rounded-lg p-2 shadow-xl">
        <p className="text-[9px] text-[#5a5a6e] uppercase tracking-wider mb-1.5">MAP Rate by OTA</p>
        {sorted.map(([src, rate]) => (
          <div key={src} className="flex items-center justify-between gap-3 py-0.5">
            <span className={`text-[10px] capitalize ${rate === minRate ? 'text-emerald-400 font-semibold' : 'text-[#8b8b9e]'}`}>
              {src.replace('official:', '').replace(/\//g, '/')}
              {rate === minRate && <span className="ml-1 text-[9px] opacity-70">★ BAR</span>}
            </span>
            <span className={`text-[10px] font-mono ${rate === minRate ? 'text-emerald-400 font-bold' : 'text-[#5a5a6e]'}`}>
              {formatINR(rate)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnomalyFlag({ flags }: { flags: string[] }) {
  if (!flags || flags.length === 0) return null;
  return (
    <span title={flags.join('\n')} className="inline-flex items-center gap-1 text-[10px] text-amber-400/80 cursor-help">
      ⚠ {flags.length}
    </span>
  );
}

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function LiveRateBoard({ rates, loading }: LiveRateBoardProps) {
  if (loading) {
    return (
      <section className="glass-card p-6">
        <div className="shimmer h-6 w-48 mb-6" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="shimmer h-16 w-full" />
          ))}
        </div>
      </section>
    );
  }

  const data = rates ?? [];
  const starIcons = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

  // Overall data quality from avg confidence
  const avgConf = data.length > 0
    ? data.reduce((s: number, r: any) => s + (r.confidence ?? 0), 0) / data.length
    : 0;
  const qualityLabel = avgConf >= 0.80 ? 'ENTERPRISE VERIFIED' : avgConf >= 0.60 ? 'PRODUCTION' : 'BASELINE';
  const qualityColor = avgConf >= 0.80 ? 'text-emerald-400' : avgConf >= 0.60 ? 'text-amber-400' : 'text-rose-400';

  return (
    <section id="live-rates" className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold leading-none">Live Rate Board</h3>
            <p className="text-[10px] text-[#5a5a6e] mt-0.5">Lowest Verified MAP BAR · Double Occupancy · Tax Inclusive</p>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-live" />
            <span className="text-[10px] uppercase tracking-wider text-[#8b8b9e]">Live</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${qualityColor}`}>{qualityLabel}</span>
          <span className="text-xs text-[#5a5a6e] font-mono">
            {data.filter((r: any) => r.otaCount > 0).length}/{data.length} hotels verified
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] text-[#5a5a6e] uppercase tracking-wider bg-white/[0.01]">
              <th className="text-left px-6 py-3 font-medium">Hotel</th>
              <th className="text-right px-4 py-3 font-medium">
                <span title="Lowest verified MAP rate (double occupancy, tax-inclusive)">BAR MAP ↓</span>
              </th>
              <th className="text-right px-4 py-3 font-medium">Yesterday</th>
              <th className="text-right px-4 py-3 font-medium">Δ Day</th>
              <th className="text-left px-4 py-3 font-medium">OTA Winner</th>
              <th className="text-left px-4 py-3 font-medium">OTA Sources</th>
              <th className="text-left px-4 py-3 font-medium">Confidence</th>
              <th className="text-left px-4 py-3 font-medium">Freshness</th>
              <th className="text-right px-6 py-3 font-medium">Rec. Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((hotel: any, index: number) => {
              const isTarget = hotel.isTarget;
              const trendClass = hotel.trend === 'up' ? 'delta-up' : hotel.trend === 'down' ? 'delta-down' : 'delta-stable';
              const trendArrow = hotel.trend === 'up' ? '↑' : hotel.trend === 'down' ? '↓' : '→';
              const isStale = hotel.isStale || hotel.freshness === 'stale';

              return (
                <tr
                  key={hotel.hotelId || index}
                  className={`border-t border-white/[0.04] transition-colors hover:bg-white/[0.02] ${
                    isTarget ? 'bg-indigo-500/[0.04]' : ''
                  } ${isStale ? 'opacity-60' : ''}`}
                >
                  {/* Hotel Name */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {isTarget && <div className="w-1 h-8 rounded-full bg-indigo-500 flex-shrink-0" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-semibold text-sm truncate ${isTarget ? 'text-indigo-400' : 'text-white'}`}>
                            {hotel.hotelName}
                          </p>
                          {isTarget && (
                            <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-bold tracking-wider flex-shrink-0">TARGET</span>
                          )}
                          <AnomalyFlag flags={hotel.anomalyFlags ?? []} />
                        </div>
                        <p className="text-[10px] text-amber-500/70 tracking-wider mt-0.5">
                          {starIcons(hotel.starRating)}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Current MAP BAR */}
                  <td className="px-4 py-4 text-right">
                    {hotel.currentMapRate ? (
                      <div>
                        <span className="font-mono font-bold text-sm">{formatINR(hotel.currentMapRate)}</span>
                        {isStale && (
                          <p className="text-[10px] text-rose-400/70 font-mono mt-0.5">STALE</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#5a5a6e] text-sm">—</span>
                    )}
                  </td>

                  {/* Yesterday */}
                  <td className="px-4 py-4 text-right">
                    <span className="font-mono text-sm text-[#8b8b9e]">
                      {hotel.yesterdayMapRate ? formatINR(hotel.yesterdayMapRate) : '—'}
                    </span>
                  </td>

                  {/* Delta */}
                  <td className="px-4 py-4 text-right">
                    {hotel.deltaPercent != null ? (
                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-mono font-medium ${trendClass}`}>
                        {trendArrow} {formatDelta(hotel.deltaPercent)}
                      </span>
                    ) : (
                      <span className="text-[#5a5a6e] text-xs">—</span>
                    )}
                  </td>

                  {/* OTA Winner */}
                  <td className="px-4 py-4">
                    <OtaWinnerBadge source={hotel.cheapestOta} breakdown={hotel.otaBreakdown} />
                  </td>

                  {/* OTA Source Count + Breakdown */}
                  <td className="px-4 py-4">
                    {hotel.otaCount > 0 ? (
                      <OtaBreakdownTooltip breakdown={hotel.otaBreakdown} />
                    ) : (
                      <span className="text-[#5a5a6e] text-xs">—</span>
                    )}
                  </td>

                  {/* Confidence Badge */}
                  <td className="px-4 py-4">
                    <ConfidenceBadge
                      label={hotel.confidenceLabel ?? 'LOW'}
                      count={hotel.otaCount ?? 0}
                      checked={hotel.otasChecked ?? 0}
                    />
                  </td>

                  {/* Freshness */}
                  <td className="px-4 py-4">
                    <FreshnessDot freshness={hotel.freshness ?? 'no-data'} lastVerifiedAt={hotel.lastVerifiedAt} />
                  </td>

                  {/* Recommended Rate */}
                  <td className="px-6 py-4 text-right">
                    {isTarget && hotel.recommendedRate ? (
                      <div>
                        <span className="font-mono font-bold text-sm text-emerald-400">
                          {formatINR(hotel.recommendedRate)}
                        </span>
                        {hotel.currentMapRate && hotel.recommendedRate && (
                          <p className={`text-[10px] font-mono mt-0.5 ${
                            hotel.recommendedRate > hotel.currentMapRate ? 'text-emerald-400/70' :
                            hotel.recommendedRate < hotel.currentMapRate ? 'text-rose-400/70' : 'text-[#5a5a6e]'
                          }`}>
                            {hotel.recommendedRate > hotel.currentMapRate ? '↑ Raise' :
                             hotel.recommendedRate < hotel.currentMapRate ? '↓ Lower' : '→ Hold'}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#5a5a6e] text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer legend */}
      {data.length > 0 && (
        <div className="px-6 py-3 border-t border-white/[0.04] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4 text-[10px] text-[#5a5a6e]">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> HIGH = 2+ OTAs confirmed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> MED = Single OTA
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> LOW = Unverified / stale
            </span>
          </div>
          <span className="text-[10px] text-[#5a5a6e] font-mono">
            BAR = Lowest verified MAP · Room + B+D · 2 adults · Tax incl.
          </span>
        </div>
      )}

      {data.length === 0 && (
        <div className="px-6 py-14 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>No rates collected yet</p>
            <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--color-warm-slate)', opacity: 0.7 }}>
              Scrape pending — the automated pipeline runs at 6 AM, 12 PM, and 6 PM IST.
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest"
            style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.15)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ animation: 'pulse 1.5s infinite' }} />
            Awaiting first scrape cycle
          </div>
        </div>
      )}
    </section>
  );
}
