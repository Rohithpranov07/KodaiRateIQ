'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';

export default function HotelsPage() {
  return (
    <DashboardLayout>
      <div className="mb-phi-xl flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <span className="text-label-caps px-3 py-1 rounded-lg mb-2 inline-block clay-inset" style={{ color: 'var(--color-gold)' }}>LUXURY TIER</span>
          <h1 className="text-headline-lg mt-2" style={{ color: 'var(--color-text-primary)' }}>Hotel Kodai International</h1>
          <div className="flex items-center gap-1 mt-2">
            {[1,2,3,4,5].map(s => (
              <span key={s} className="material-symbols-outlined text-lg" style={{ color: 'var(--color-gold)', fontVariationSettings: "'FILL' 1" }}>star</span>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button className="px-6 py-3 rounded-xl text-label-caps transition-colors bg-white hover:bg-white/80 shadow-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>EXPORT BRIEF</button>
          <button className="px-6 py-3 rounded-xl text-label-caps transition-colors clay-button-gold">EDIT PROFILE</button>
        </div>
      </div>

      <p className="text-body-md mb-phi-xl max-w-3xl" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        A premier luxury property occupying a dominant market position in the southern hill station quadrant. Demonstrating exceptional yield stability and high ADR retention in off-peak seasons.
      </p>

      {/* KPI Strip */}
      <div className="flex gap-phi-lg mb-phi-xl flex-wrap">
        {[
          { label: 'YTD OCCUPANCY', value: '78.4%', delta: '+2%' },
          { label: 'REVPAR INDEX', value: '112.5', delta: '+3.1' },
          { label: 'MAP TARGET', value: '₹14,250', delta: '+₹800' },
        ].map((m, i) => (
          <div key={i} className="flex-1 min-w-[200px] clay-card p-phi-md rounded-2xl">
            <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>{m.label}</span>
            <div className="text-metric-xl mt-2 mb-1" style={{ color: 'var(--color-text-primary)' }}>{m.value}</div>
            <span className="text-data-mono font-medium" style={{ color: 'var(--color-positive)' }}>{m.delta} YoY</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        {/* Pricing / Plan Breakdown */}
        <section className="clay-panel rounded-2xl p-phi-lg">
          <h3 className="text-headline-mobile mb-phi-md" style={{ color: 'var(--color-text-primary)' }}>Yield & Rate Structure</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="clay-inset rounded-xl p-4">
              <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>BASE MAP</span>
              <div className="text-metric-xl mt-2" style={{ color: 'var(--color-text-primary)' }}>₹14,250 <span className="text-sm font-light text-gray-500">avg</span></div>
            </div>
            <div className="clay-inset rounded-xl p-4">
              <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>BASE CP</span>
              <div className="text-metric-xl mt-2" style={{ color: 'var(--color-text-primary)' }}>₹12,500 <span className="text-sm font-light text-gray-500">avg</span></div>
            </div>
            <div className="clay-inset rounded-xl p-4">
              <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>BASE EP</span>
              <div className="text-metric-xl mt-2" style={{ color: 'var(--color-text-primary)' }}>₹11,000 <span className="text-sm font-light text-gray-500">avg</span></div>
            </div>
            <div className="clay-inset rounded-xl p-4">
              <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>PROJECTED Q3 MAP</span>
              <div className="text-metric-xl mt-2" style={{ color: 'var(--color-gold)' }}>₹16,400 <span className="text-sm font-light text-gray-500">proj.</span></div>
            </div>
          </div>
        </section>

        {/* AI Positioning & Facilities */}
        <div className="flex flex-col gap-gutter">
          <section className="clay-panel rounded-2xl p-phi-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined" style={{ color: 'var(--color-gold)' }}>psychology</span>
              <h3 className="text-headline-mobile" style={{ color: 'var(--color-text-primary)' }}>AI Positioning</h3>
            </div>
            <p className="text-body-md mb-4" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Categorized as a Market Leader (Tier 1). The algorithm recommends a pricing strategy of +4.2% for weekend MAP packages without reducing occupancy targets.
            </p>
            <div className="flex gap-3 mt-4">
              <span className="text-label-caps px-3 py-1 rounded-md" style={{ background: 'rgba(198,167,105,0.1)', color: 'var(--color-gold)' }}>CONFIDENCE: 92%</span>
            </div>
          </section>

          <section className="clay-card rounded-2xl p-phi-lg">
            <h3 className="text-headline-mobile mb-4" style={{ color: 'var(--color-text-primary)' }}>Core Facilities Matrix</h3>
            <div className="flex flex-wrap gap-2">
              {['Spa & Wellness', 'Multi-Cuisine Restaurant', 'Executive Bar', 'Banquet Hall', 'Valet Parking', 'High-Speed WiFi', 'Family Suites', 'Lake Proximity'].map((fac, i) => (
                <span key={i} className="text-data-mono px-3 py-1.5 rounded-full clay-inset" style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                  {fac}
                </span>
              ))}
            </div>
          </section>
        </div>

        {/* Historical Trend Chart */}
        <section className="clay-panel rounded-2xl p-phi-lg md:col-span-2 h-[350px] flex flex-col">
          <h3 className="text-headline-mobile mb-phi-md" style={{ color: 'var(--color-text-primary)' }}>Historical MAP Trend vs Competitors (90 Days)</h3>
          <div className="flex-1 clay-inset rounded-xl relative p-4 overflow-hidden">
            <svg className="absolute inset-0 w-full h-full p-4" preserveAspectRatio="none" viewBox="0 0 100 100">
              {/* Carlton */}
              <path d="M0,20 L25,18 L50,22 L75,15 L100,20" fill="none" stroke="var(--color-analytics)" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
              {/* HKI */}
              <path d="M0,50 L25,48 L50,42 L75,45 L100,35" fill="none" stroke="var(--color-gold)" strokeWidth="2.5" />
              <path d="M0,50 L25,48 L50,42 L75,45 L100,35 L100,100 L0,100 Z" fill="rgba(198,167,105,0.05)" />
              {/* Sterling */}
              <path d="M0,70 L25,75 L50,72 L75,68 L100,70" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
            </svg>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
