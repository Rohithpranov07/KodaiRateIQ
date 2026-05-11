'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';

const liveRates = [
  { property: 'Hotel Kodai International', roomType: 'Premium Suite', baseRate: 14250, compAvg: 13200, variance: '+6.0%', pulse: true },
  { property: 'The Carlton', roomType: 'Executive Room', baseRate: 18500, compAvg: 16800, variance: '-5.82%', pulse: false },
  { property: 'The Tamara Kodai', roomType: 'Standard King', baseRate: 16200, compAvg: 14500, variance: '+10.2%', pulse: false },
  { property: 'Sterling Kodai Lake', roomType: 'Lake View', baseRate: 11500, compAvg: 12000, variance: '-4.1%', pulse: false },
  { property: 'Le Poshe by Sparsa', roomType: 'Deluxe Suite', baseRate: 9800, compAvg: 11500, variance: '-14.7%', pulse: false },
];

const otaSources = ['Direct', 'Booking.com', 'Expedia', 'Agoda', 'MakeMyTrip'];

export default function LiveRatesPage() {
  return (
    <DashboardLayout>
      {/* Header Ticker Bar */}
      <div className="flex items-center gap-6 mb-phi-lg overflow-x-auto pb-2"
        style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>LIVE PULSE</span>
          <span className="text-data-mono" style={{ color: 'var(--color-gold)' }}>HKI-01</span>
          <span className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>₹14,250</span>
          <span className="text-data-mono" style={{ color: 'var(--color-positive)' }}>+1.2%</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>CARL-01</span>
          <span className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>₹18,500</span>
          <span className="text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>+0.0%</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>TAM-01</span>
          <span className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>₹16,200</span>
          <span className="text-data-mono" style={{ color: 'var(--color-positive)' }}>+2.4%</span>
        </div>
      </div>

      {/* Page Header */}
      <div className="mb-phi-xl">
        <h1 className="text-headline-lg" style={{ color: 'var(--color-text-primary)' }}>Terminal View</h1>
        <p className="text-body-md mt-2" style={{ color: 'var(--color-text-secondary)' }}>Cross-market pricing analysis and competitor disparity.</p>
      </div>

      {/* Filtering Bar */}
      <div className="flex flex-wrap gap-4 mb-phi-lg p-4 clay-panel">
        <select className="bg-transparent text-body-md focus:outline-none" style={{ color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)' }}>
          <option>All OTAs</option>
          <option>Direct</option>
          <option>Booking.com</option>
          <option>MakeMyTrip</option>
        </select>
        <select className="bg-transparent text-body-md focus:outline-none" style={{ color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)' }}>
          <option>All Meal Plans (MAP/CP/EP)</option>
          <option>MAP Only</option>
          <option>CP Only</option>
          <option>EP Only</option>
        </select>
        <select className="bg-transparent text-body-md focus:outline-none" style={{ color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)' }}>
          <option>All Room Types</option>
          <option>Standard / Base</option>
          <option>Premium / Deluxe</option>
          <option>Suite / Villa</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Live Hotel Rate Board (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-gutter">
          <section className="clay-card rounded-xl p-phi-lg">
            <h3 className="text-headline-mobile mb-phi-md" style={{ color: 'var(--color-text-primary)' }}>Live Hotel Rate Board</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-label-caps" style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    <th className="py-4 px-4 font-normal">Property ID</th>
                    <th className="py-4 px-4 font-normal text-right">Base MAP</th>
                    <th className="py-4 px-4 font-normal text-right">Comp Avg</th>
                    <th className="py-4 px-4 font-normal text-right">Variance</th>
                    <th className="py-4 px-4 font-normal text-center">Pulse</th>
                  </tr>
                </thead>
                <tbody className="text-data-mono">
                  {liveRates.map((rate, i) => (
                    <tr key={i} className="transition-colors hover:bg-black/5"
                      style={{ borderBottom: i < liveRates.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <td className="py-4 px-4">
                        <div style={{ color: rate.property === 'Hotel Kodai International' ? 'var(--color-gold)' : 'var(--color-text-primary)', fontWeight: rate.property === 'Hotel Kodai International' ? 600 : 400 }}>{rate.property}</div>
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>{rate.roomType}</div>
                      </td>
                      <td className="py-4 px-4 text-right" style={{ color: 'var(--color-text-primary)' }}>₹{rate.baseRate.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right" style={{ color: 'var(--color-text-secondary)' }}>₹{rate.compAvg.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right" style={{ color: rate.variance.startsWith('+') ? 'var(--color-positive)' : 'var(--color-negative)' }}>{rate.variance}</td>
                      <td className="py-4 px-4 text-center">
                        <div className="w-3 h-3 rounded-full mx-auto" style={{
                          background: rate.pulse ? 'var(--color-positive)' : 'var(--color-text-secondary)',
                          opacity: rate.pulse ? 1 : 0.3,
                          boxShadow: rate.pulse ? '0 0 8px rgba(45, 106, 79, 0.5)' : 'none',
                        }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Detailed Hotel Breakdown Chart Placeholder */}
          <section className="clay-panel p-phi-lg h-[300px] flex flex-col">
            <h3 className="text-headline-mobile mb-phi-md" style={{ color: 'var(--color-text-primary)' }}>Historical Comparison (MAP vs CP)</h3>
            <div className="flex-1 clay-inset rounded-xl relative overflow-hidden">
               {/* Financial Chart Abstract */}
               <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path d="M0,70 L20,65 L40,68 L60,50 L80,55 L100,45" fill="none" stroke="var(--color-analytics)" strokeWidth="2" />
                <path d="M0,85 L20,80 L40,85 L60,70 L80,75 L100,60" fill="none" stroke="var(--color-text-secondary)" strokeDasharray="4 4" strokeWidth="1" />
              </svg>
            </div>
          </section>
        </div>

        {/* OTA Disparity Panel (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-gutter">
          <section className="clay-panel rounded-xl p-phi-lg">
            <h3 className="text-headline-mobile mb-phi-md" style={{ color: 'var(--color-text-primary)' }}>OTA Disparity</h3>

            {/* Alert */}
            <div className="p-4 rounded-xl mb-phi-lg clay-inset" style={{ border: '1px solid rgba(168, 121, 69, 0.2)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-warning)' }}>warning</span>
                <span className="text-label-caps" style={{ color: 'var(--color-warning)' }}>Rate Leakage Detected</span>
              </div>
              <p className="text-body-md" style={{ color: 'var(--color-text-secondary)' }}>Expedia is undercutting Direct by ₹450 on MAP rates.</p>
            </div>

            {/* OTA Source List */}
            <div className="flex flex-col gap-4">
              {otaSources.map((source, i) => (
                <div key={i} className="flex items-center justify-between" style={{ borderBottom: i < otaSources.length - 1 ? '1px solid var(--color-border)' : 'none', paddingBottom: i < otaSources.length - 1 ? '16px' : '0' }}>
                  <span className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>{source}</span>
                  <div className="h-2 flex-1 mx-4 rounded-full overflow-hidden clay-inset">
                    <div className="h-full rounded-full" style={{
                      width: `${95 - i * 12}%`,
                      background: i === 0 ? 'var(--color-positive)' : i === 2 ? 'var(--color-negative)' : 'var(--color-analytics)',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
