'use client';

import { HOTEL_NAMES } from '@/lib/utils';

interface FacilityComparisonProps {
  data: any[] | null;
  loading: boolean;
}

const FACILITY_ICONS: Record<string, string> = {
  'lake-view': '🏔️',
  'spa': '💆',
  'pool': '🏊',
  'bar': '🍸',
  'restaurant': '🍽️',
  'wifi': '📶',
  'parking': '🅿️',
  'gym': '💪',
  'room-service': '🛎️',
  'concierge': '🤵',
  'butler': '🎩',
  'travel-desk': '✈️',
  'kids-play': '🎮',
  'conference': '💼',
};

const HOTEL_SLUGS = [
  'the-carlton',
  'the-tamara-kodai',
  'hotel-kodai-international',
  'sterling-kodai-lake',
  'le-poshe-by-sparsa',
];

const SHORT_NAMES: Record<string, string> = {
  'the-carlton': 'Carlton',
  'the-tamara-kodai': 'Tamara',
  'hotel-kodai-international': 'HKI',
  'sterling-kodai-lake': 'Sterling',
  'le-poshe-by-sparsa': 'Le Poshe',
};

export function FacilityComparison({ data, loading }: FacilityComparisonProps) {
  if (loading) {
    return (
      <section className="glass-card p-6">
        <div className="shimmer h-6 w-48 mb-6" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="shimmer h-10 w-full" />)}
        </div>
      </section>
    );
  }

  const facilities = data ?? [];

  return (
    <section id="facilities" className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold">Facility Comparison</h3>
          <p className="text-xs text-[#5a5a6e]">Amenities & Services Matrix</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] text-[#5a5a6e] uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Facility</th>
              {HOTEL_SLUGS.map(slug => (
                <th key={slug} className={`text-center px-2 py-3 font-medium ${slug === 'hotel-kodai-international' ? 'text-indigo-400' : ''}`}>
                  {SHORT_NAMES[slug]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {facilities.map((fac: any, i: number) => (
              <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{FACILITY_ICONS[fac.facility] || '•'}</span>
                    <span className="text-xs capitalize text-[#8b8b9e]">{fac.facility.replace(/-/g, ' ')}</span>
                  </div>
                </td>
                {HOTEL_SLUGS.map(slug => {
                  const hotelFac = fac.hotels[slug];
                  return (
                    <td key={slug} className="text-center px-2 py-3">
                      {hotelFac?.available ? (
                        <div className="flex items-center justify-center gap-0.5">
                          {[...Array(5)].map((_, idx) => (
                            <div
                              key={idx}
                              className={`w-1.5 h-1.5 rounded-full ${
                                idx < (hotelFac.quality || 0) ? 'bg-emerald-500' : 'bg-white/10'
                              }`}
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#5a5a6e] text-xs">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {facilities.length === 0 && (
        <div className="p-8 text-center text-[#5a5a6e] text-sm">No facility data available</div>
      )}
    </section>
  );
}
