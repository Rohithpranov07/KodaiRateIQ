'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';

const liveRates = [
  { hotel: 'Hotel Kodai International', map: 14250, cp: 12500, ep: 11000, ydayMap: 14000, change: '+1.7%', ota: 'Direct', avail: 'High', updated: 'Just now', signal: 'hold' },
  { hotel: 'The Carlton', map: 18500, cp: 16000, ep: 14500, ydayMap: 18500, change: '0.0%', ota: 'Agoda', avail: 'Med', updated: '2m ago', signal: 'watch' },
  { hotel: 'The Tamara Kodai', map: 16200, cp: 14800, ep: 13500, ydayMap: 15800, change: '+2.5%', ota: 'Booking.com', avail: 'Low', updated: '5m ago', signal: 'up' },
  { hotel: 'Sterling Kodai Lake', map: 11500, cp: 10200, ep: 9000, ydayMap: 11200, change: '+2.6%', ota: 'MakeMyTrip', avail: 'High', updated: '12m ago', signal: 'up' },
  { hotel: 'Le Poshe by Sparsa', map: 9800, cp: 8500, ep: 7500, ydayMap: 9800, change: '0.0%', ota: 'Expedia', avail: 'High', updated: '15m ago', signal: 'hold' },
];

export default function DashboardPage() {
  return (
    <DashboardLayout>
      {/* A. EXECUTIVE HERO SECTION */}
      <section className="clay-panel p-phi-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-gutter mb-phi-xl">
        <div>
          <span className="text-label-caps px-3 py-1 rounded-full mb-4 inline-block" style={{ background: 'rgba(198,167,105,0.15)', color: 'var(--color-gold)' }}>
            HKI EXECUTIVE SUMMARY
          </span>
          <h1 className="text-display-hero mt-2" style={{ color: 'var(--color-text-primary)', fontWeight: 300 }}>
            ₹14,250 <span className="text-metric-xl text-gray-500 font-light">MAP Target</span>
          </h1>
          <p className="text-data-mono mt-3" style={{ color: 'var(--color-text-secondary)' }}>
            Last Sync: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} IST • Real-Time Engine Active
          </p>
        </div>
        
        <div className="flex gap-phi-lg flex-wrap">
          <div className="clay-inset p-phi-md rounded-xl min-w-[160px]">
            <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>AI CONFIDENCE</span>
            <div className="text-metric-xl mt-1" style={{ color: 'var(--color-positive)' }}>94%</div>
            <div className="text-data-mono mt-1" style={{ color: 'var(--color-text-secondary)' }}>High Conviction</div>
          </div>
          <div className="clay-inset p-phi-md rounded-xl min-w-[160px]">
            <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>MARKET POSITION</span>
            <div className="text-metric-xl mt-1" style={{ color: 'var(--color-text-primary)' }}>#3</div>
            <div className="text-data-mono mt-1" style={{ color: 'var(--color-text-secondary)' }}>Tier 1 Luxury</div>
          </div>
          <div className="clay-inset p-phi-md rounded-xl min-w-[160px]">
            <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>OCCUPANCY SENTIMENT</span>
            <div className="text-metric-xl mt-1" style={{ color: 'var(--color-gold)' }}>Surge</div>
            <div className="text-data-mono mt-1" style={{ color: 'var(--color-text-secondary)' }}>Next 7 Days</div>
          </div>
        </div>
      </section>

      {/* B. LIVE RATE COMPARISON TABLE */}
      <section className="clay-card p-phi-lg mb-phi-xl">
        <h2 className="text-headline-mobile mb-phi-md" style={{ color: 'var(--color-text-primary)' }}>Live Pricing Matrix</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-label-caps" style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <th className="py-4 px-4 font-normal">Hotel</th>
                <th className="py-4 px-4 font-normal text-right">MAP Rate</th>
                <th className="py-4 px-4 font-normal text-right">CP Rate</th>
                <th className="py-4 px-4 font-normal text-right">EP Rate</th>
                <th className="py-4 px-4 font-normal text-right">Yday MAP</th>
                <th className="py-4 px-4 font-normal text-right">Day %</th>
                <th className="py-4 px-4 font-normal">Cheapest OTA</th>
                <th className="py-4 px-4 font-normal">Availability</th>
                <th className="py-4 px-4 font-normal">AI Signal</th>
              </tr>
            </thead>
            <tbody className="text-data-mono">
              {liveRates.map((hotel, i) => (
                <tr key={i} className="hover:bg-black/5 transition-colors" style={{ borderBottom: i < liveRates.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td className="py-4 px-4 font-medium" style={{ color: hotel.hotel === 'Hotel Kodai International' ? 'var(--color-gold)' : 'var(--color-text-primary)' }}>
                    {hotel.hotel}
                  </td>
                  <td className="py-4 px-4 text-right" style={{ fontWeight: hotel.hotel === 'Hotel Kodai International' ? 600 : 400 }}>
                    ₹{hotel.map.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right">₹{hotel.cp.toLocaleString()}</td>
                  <td className="py-4 px-4 text-right">₹{hotel.ep.toLocaleString()}</td>
                  <td className="py-4 px-4 text-right" style={{ color: 'var(--color-text-secondary)' }}>₹{hotel.ydayMap.toLocaleString()}</td>
                  <td className="py-4 px-4 text-right" style={{ color: hotel.change.startsWith('+') ? 'var(--color-positive)' : hotel.change === '0.0%' ? 'var(--color-text-secondary)' : 'var(--color-negative)' }}>
                    {hotel.change}
                  </td>
                  <td className="py-4 px-4" style={{ color: 'var(--color-text-secondary)' }}>{hotel.ota}</td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-1 rounded text-[10px] font-bold uppercase" style={{ background: hotel.avail === 'High' ? 'rgba(45,106,79,0.1)' : 'rgba(168,121,69,0.1)', color: hotel.avail === 'High' ? 'var(--color-positive)' : 'var(--color-warning)' }}>
                      {hotel.avail}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="material-symbols-outlined" style={{ color: hotel.signal === 'up' ? 'var(--color-positive)' : hotel.signal === 'hold' ? 'var(--color-gold)' : 'var(--color-text-secondary)' }}>
                      {hotel.signal === 'up' ? 'arrow_upward' : hotel.signal === 'hold' ? 'horizontal_rule' : 'visibility'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-phi-xl">
        {/* C. PRICE TREND CHARTS & D. AI RECOMMENDATION ENGINE */}
        <div className="lg:col-span-8 flex flex-col gap-phi-xl">
          {/* Trend Chart */}
          <section className="clay-card p-phi-lg h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-phi-md">
              <h2 className="text-headline-mobile" style={{ color: 'var(--color-text-primary)' }}>30-Day MAP Trajectory</h2>
              <div className="flex gap-2">
                <span className="text-label-caps px-3 py-1 rounded clay-inset" style={{ color: 'var(--color-text-primary)' }}>7D</span>
                <span className="text-label-caps px-3 py-1 rounded" style={{ background: 'var(--color-gold)', color: 'white' }}>30D</span>
              </div>
            </div>
            <div className="flex-1 w-full relative rounded-xl clay-inset overflow-hidden">
              {/* Financial Chart Abstract */}
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                {/* Tamara */}
                <path d="M0,40 L20,35 L40,38 L60,30 L80,32 L100,25" fill="none" stroke="var(--color-analytics)" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
                {/* HKI */}
                <path d="M0,60 L20,55 L40,65 L60,45 L80,50 L100,30" fill="none" stroke="var(--color-gold)" strokeWidth="2" />
                <path d="M0,60 L20,55 L40,65 L60,45 L80,50 L100,30 L100,100 L0,100 Z" fill="rgba(198,167,105,0.1)" />
              </svg>
            </div>
          </section>

          {/* AI Recommendation */}
          <section className="clay-panel p-phi-lg relative overflow-hidden">
            <h2 className="text-headline-mobile mb-phi-md flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-gold)' }}>psychology</span>
              Gemini AI Strategy
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              <div className="clay-inset p-phi-md rounded-xl">
                <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>OPTIMAL TARGET</span>
                <div className="text-metric-xl mt-2" style={{ color: 'var(--color-text-primary)' }}>₹14,250 <span className="text-body-md" style={{ color: 'var(--color-text-secondary)' }}>/ MAP</span></div>
                <div className="text-data-mono mt-2" style={{ color: 'var(--color-positive)' }}>+1.8% vs Yesterday</div>
                <p className="text-body-md mt-4" style={{ color: 'var(--color-text-secondary)' }}>
                  Tamara occupancy rising rapidly for the weekend. Recommend matching their +2.5% increase while maintaining a ₹1,950 buffer to secure price-sensitive luxury bookings.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <div className="clay-card p-4 flex justify-between items-center cursor-pointer hover:bg-black/5 transition-colors">
                  <div>
                    <div className="text-label-caps mb-1" style={{ color: 'var(--color-warning)' }}>AGGRESSIVE (Volume Focus)</div>
                    <div className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>₹13,800 MAP</div>
                  </div>
                  <span className="material-symbols-outlined text-gray-400">chevron_right</span>
                </div>
                <div className="clay-card p-4 flex justify-between items-center cursor-pointer hover:bg-black/5 transition-colors">
                  <div>
                    <div className="text-label-caps mb-1" style={{ color: 'var(--color-text-secondary)' }}>CONSERVATIVE (Yield Focus)</div>
                    <div className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>₹14,800 MAP</div>
                  </div>
                  <span className="material-symbols-outlined text-gray-400">chevron_right</span>
                </div>
                <button className="clay-button-gold w-full py-4 mt-auto">APPLY OPTIMAL STRATEGY</button>
              </div>
            </div>
          </section>
        </div>

        {/* E. POSITIONING MATRIX & H. SYSTEM HEALTH */}
        <div className="lg:col-span-4 flex flex-col gap-phi-xl">
          {/* Positioning Matrix */}
          <section className="clay-card p-phi-lg h-[350px] flex flex-col">
            <h2 className="text-headline-mobile mb-4" style={{ color: 'var(--color-text-primary)' }}>Positioning Matrix</h2>
            <div className="flex-1 clay-inset rounded-xl relative p-4">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>PRICE (MAP)</span>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>LUXURY TIER</span>
              
              {/* Plot Points */}
              <div className="absolute top-[20%] right-[20%] w-3 h-3 rounded-full bg-[var(--color-analytics)] shadow-md" title="The Carlton"></div>
              <div className="absolute top-[35%] right-[40%] w-3 h-3 rounded-full bg-[var(--color-analytics)] shadow-md" title="Tamara"></div>
              <div className="absolute top-[45%] left-[50%] w-4 h-4 rounded-full bg-[var(--color-gold)] shadow-lg ring-4 ring-gold/20" title="HKI"></div>
              <div className="absolute top-[65%] left-[30%] w-3 h-3 rounded-full bg-[var(--color-analytics)] shadow-md" title="Sterling"></div>
              <div className="absolute top-[80%] left-[20%] w-3 h-3 rounded-full bg-[var(--color-analytics)] shadow-md" title="Le Poshe"></div>
            </div>
          </section>

          {/* System Health */}
          <section className="clay-panel p-phi-lg">
            <h2 className="text-label-caps mb-phi-md" style={{ color: 'var(--color-text-secondary)' }}>SYSTEM HEALTH</h2>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>Scraper Engine</span>
                <span className="text-data-mono flex items-center gap-1" style={{ color: 'var(--color-positive)' }}>
                  <span className="w-2 h-2 rounded-full bg-[var(--color-positive)]"></span> Online
                </span>
              </div>
              <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>API Sync</span>
                <span className="text-data-mono flex items-center gap-1" style={{ color: 'var(--color-positive)' }}>
                  <span className="w-2 h-2 rounded-full bg-[var(--color-positive)]"></span> 12ms ping
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>Active Nodes</span>
                <span className="text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>4/5 (Agoda throttled)</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
