'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="mb-phi-xl">
        <h1 className="text-headline-lg" style={{ color: 'var(--color-text-primary)' }}>Historical Analytics</h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--color-text-secondary)' }}>Quantitative analysis of past performance, volatility patterns, and unrealized revenue opportunities.</p>
      </div>

      {/* Time Range */}
      <div className="flex gap-2 mb-phi-xl justify-end">
        {['1D','3D','7D','90D','YTD','1Y'].map((p) => (
          <span key={p} className="text-label-caps px-4 py-2 rounded-xl cursor-pointer transition-colors" style={{
            background: p === '90D' ? 'var(--color-gold)' : 'var(--color-soft-ivory)',
            color: p === '90D' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontWeight: p === '90D' ? 600 : 400,
          }}>{p}</span>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter mb-gutter">
        {[
          { label: 'GLOBAL REVPAR', value: '₹9,840', delta: '+6%', color: 'var(--color-positive)' },
          { label: 'ADR VOLATILITY', value: '14.2', delta: '±₹810', color: 'var(--color-warning)' },
          { label: 'YIELD LEAKAGE', value: '₹1.24M', delta: 'High', color: 'var(--color-negative)' },
          { label: 'AVG OCCUPANCY', value: '78.5%', delta: '+6%', color: 'var(--color-positive)' },
        ].map((kpi, i) => (
          <div key={i} className="clay-card p-phi-lg flex flex-col justify-between items-start group hover:scale-[1.02] transition-transform">
            <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>{kpi.label}</span>
            <div className="text-metric-xl mt-4 mb-2" style={{ color: 'var(--color-text-primary)' }}>{kpi.value}</div>
            <span className="text-data-mono px-2 py-1 rounded clay-inset" style={{ color: kpi.color, fontSize: '12px' }}>{kpi.delta}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <section className="clay-panel p-phi-lg mb-gutter">
        <h3 className="text-headline-mobile mb-phi-md" style={{ color: 'var(--color-text-primary)' }}>Rate Volatility Distribution (30D vs 90D)</h3>
        <div className="h-[350px] w-full relative rounded-xl clay-inset overflow-hidden">
          <svg className="absolute inset-0 w-full h-full p-4" preserveAspectRatio="none" viewBox="0 0 100 100">
            {/* 30D Moving Average */}
            <path d="M0,70 C25,60 40,45 50,40 C60,35 70,32 80,35 C90,42 100,48 100,48 L100,100 L0,100 Z" fill="rgba(198,167,105,0.1)" />
            <path d="M0,70 C25,60 40,45 50,40 C60,35 70,32 80,35 C90,42 100,48 100,48" fill="none" stroke="var(--color-gold)" strokeWidth="2" />
            {/* 90D Moving Average */}
            <path d="M0,75 C30,70 50,55 70,40 C80,50 100,60 100,60" fill="none" stroke="var(--color-analytics)" strokeDasharray="4 4" strokeWidth="1.5" />
          </svg>
        </div>
      </section>

      {/* Bottom */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <section className="clay-card p-phi-lg flex flex-col items-center justify-center">
          <h3 className="text-headline-mobile mb-8 self-start" style={{ color: 'var(--color-text-primary)' }}>Yield Leakage Impact</h3>
          <div className="relative w-40 h-40 bg-[var(--color-soft-ivory)] rounded-full shadow-inner border border-white/50">
            <svg className="absolute w-[110%] h-[110%] -left-[5%] -top-[5%] -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(17,17,17,0.05)" strokeWidth="10" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-negative)" strokeWidth="10" strokeDasharray="50 282.7" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-display-hero" style={{ color: 'var(--color-negative)', fontSize: '2.5rem' }}>-12<span className="text-xl">%</span></span>
              <span className="text-label-caps mt-1" style={{ color: 'var(--color-text-secondary)' }}>OTA LOSS</span>
            </div>
          </div>
        </section>
        <section className="clay-card p-phi-lg">
          <h3 className="text-headline-mobile mb-4" style={{ color: 'var(--color-text-primary)' }}>Demand Density Heatmap</h3>
          <div className="grid grid-cols-7 gap-2 h-[200px]">
            {Array.from({length: 35}).map((_, i) => {
              const intensity = Math.random() * 0.8 + 0.1;
              return (
                <div key={i} className="rounded-md transition-transform hover:scale-110 shadow-sm" style={{ 
                  background: `rgba(198,167,105,${intensity})`,
                  border: '1px solid rgba(198,167,105,0.2)'
                }} />
              );
            })}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
