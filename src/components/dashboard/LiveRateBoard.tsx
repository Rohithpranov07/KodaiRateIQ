'use client';

import { formatINR, formatDelta } from '@/lib/utils';

interface LiveRateBoardProps {
  rates: any[] | undefined;
  loading: boolean;
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

  const starIcons = (count: number) => '★'.repeat(count) + '☆'.repeat(5 - count);

  return (
    <section id="live-rates" className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </div>
          <h3 className="text-lg font-bold">Live Rate Board</h3>
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-live" />
            <span className="text-[10px] uppercase tracking-wider text-[#8b8b9e]">Live</span>
          </div>
        </div>
        <span className="text-xs text-[#5a5a6e] font-mono">
          MAP Rates • Double Occupancy
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-[#5a5a6e] uppercase tracking-wider">
              <th className="text-left px-6 py-3 font-medium">Hotel</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-right px-4 py-3 font-medium">Current MAP</th>
              <th className="text-right px-4 py-3 font-medium">Yesterday</th>
              <th className="text-right px-4 py-3 font-medium">Change</th>
              <th className="text-center px-4 py-3 font-medium">Trend</th>
              <th className="text-left px-4 py-3 font-medium">Best OTA</th>
              <th className="text-right px-6 py-3 font-medium">Rec. Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((hotel: any, index: number) => {
              const isTarget = hotel.isTarget;
              const trendArrow = hotel.trend === 'up' ? '↑' : hotel.trend === 'down' ? '↓' : '→';
              const trendClass = hotel.trend === 'up' ? 'delta-up' : hotel.trend === 'down' ? 'delta-down' : 'delta-stable';

              return (
                <tr
                  key={hotel.hotelId || index}
                  className={`border-t border-white/[0.04] transition-colors hover:bg-white/[0.02] ${
                    isTarget ? 'bg-indigo-500/[0.04]' : ''
                  }`}
                >
                  {/* Hotel Name */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {isTarget && (
                        <div className="w-1.5 h-8 rounded-full bg-indigo-500" />
                      )}
                      <div>
                        <p className={`font-semibold text-sm ${isTarget ? 'text-indigo-400' : 'text-white'}`}>
                          {hotel.hotelName}
                        </p>
                        <p className="text-[10px] text-amber-500/70 tracking-wider mt-0.5">
                          {starIcons(hotel.starRating)}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-4">
                    <span className="text-xs text-[#8b8b9e] capitalize">{hotel.role?.replace(/-/g, ' ')}</span>
                  </td>

                  {/* Current Rate */}
                  <td className="px-4 py-4 text-right">
                    <span className="font-mono font-bold text-sm">
                      {hotel.currentMapRate ? formatINR(hotel.currentMapRate) : '—'}
                    </span>
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
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium ${trendClass}`}>
                        {formatDelta(hotel.deltaPercent)}
                      </span>
                    ) : (
                      <span className="text-[#5a5a6e] text-xs">—</span>
                    )}
                  </td>

                  {/* Trend Arrow */}
                  <td className="px-4 py-4 text-center">
                    <span className={`text-lg ${
                      hotel.trend === 'up' ? 'text-emerald-500' : hotel.trend === 'down' ? 'text-rose-500' : 'text-[#5a5a6e]'
                    }`}>
                      {trendArrow}
                    </span>
                  </td>

                  {/* Best OTA */}
                  <td className="px-4 py-4">
                    <span className="text-xs text-[#8b8b9e] capitalize">
                      {hotel.cheapestOta || '—'}
                    </span>
                  </td>

                  {/* Recommended */}
                  <td className="px-6 py-4 text-right">
                    {isTarget && hotel.recommendedRate ? (
                      <span className="font-mono font-bold text-sm text-emerald-400">
                        {formatINR(hotel.recommendedRate)}
                      </span>
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

      {data.length === 0 && (
        <div className="px-6 py-12 text-center text-[#5a5a6e]">
          <p>No rate data available. Run a scrape to populate data.</p>
        </div>
      )}
    </section>
  );
}
