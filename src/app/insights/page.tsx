'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';

export default function InsightsPage() {
  return (
    <DashboardLayout>
      <div className="mb-phi-xxl">
        <div className="flex items-center gap-phi-sm mb-2">
          <span className="w-2 h-2 rounded-full animate-pulse bg-[var(--color-gold)] shadow-sm" />
          <span className="text-label-caps tracking-[0.2em]" style={{ color: 'var(--color-gold)' }}>Intelligence Center</span>
        </div>
        <h2 className="text-display-hero text-[var(--color-text-primary)]">AI Insights Engine</h2>
        <p className="text-body-md mt-phi-md max-w-2xl text-[var(--color-text-secondary)]">
          Real-time market surveillance and predictive analytics. The system has identified <strong className="text-[var(--color-gold)] font-medium">4 critical opportunities</strong> for immediate revenue optimization.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        {/* Demand Surge (7 cols) */}
        <div className="md:col-span-7 clay-card rounded-2xl p-phi-lg group hover:scale-[1.005] transition-transform duration-500">
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-phi-xl">
              <h3 className="text-metric-xl flex items-center gap-3 text-[var(--color-text-primary)]">
                <span className="material-symbols-outlined text-[var(--color-positive)]">trending_up</span>
                Demand Surge Alerts
              </h3>
              <span className="text-label-caps px-3 py-1 rounded-md text-[var(--color-positive)] clay-inset font-bold">High Confidence</span>
            </div>
            {[
              { date: 'MAY 20 - 25 • KODAI', title: 'Summer Season Onset', delta: '+42% Comp.', sub: 'Market Constraint' },
              { date: 'JUN 15 - 20 • KODAI', title: 'School Holiday Volume Spike', delta: '+28% Vol.', sub: 'Inbound Traffic' },
              { date: 'JUL 01 - 05 • KODAI', title: 'Festival Weekend Confirmed', delta: '+15% ADR', sub: 'Premium Tier' },
            ].map((alert, i) => (
              <div key={i} className="flex justify-between items-center p-phi-md transition-colors hover:bg-black/5"
                style={{ borderBottom: i < 2 ? '1px solid var(--color-border)' : 'none' }}>
                <div>
                  <p className="text-data-mono mb-1 text-[var(--color-text-secondary)]">{alert.date}</p>
                  <p className="text-body-md font-medium text-[var(--color-text-primary)]">{alert.title}</p>
                </div>
                <div className="text-right">
                  <p className="text-data-mono text-[var(--color-positive)] font-medium">{alert.delta}</p>
                  <p className="text-label-caps text-[var(--color-text-secondary)]">{alert.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Anomalies (5 cols) */}
        <div className="md:col-span-5 clay-card rounded-2xl p-phi-lg group hover:scale-[1.005] transition-transform duration-500">
          <div className="flex justify-between items-center mb-phi-xl">
            <h3 className="text-metric-xl flex items-center gap-3 text-[var(--color-text-primary)]">
              <span className="material-symbols-outlined text-[var(--color-negative)]">warning</span>
              Pricing Anomalies
            </h3>
            <span className="w-2 h-2 rounded-full animate-pulse bg-[var(--color-negative)] shadow-sm" />
          </div>
          <div className="p-phi-md rounded-xl clay-inset" style={{ border: '1px solid rgba(122,75,75,0.2)' }}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-label-caps px-2 py-0.5 rounded text-[var(--color-negative)] border border-[rgba(122,75,75,0.3)]">DETECTED</span>
              <span className="text-data-mono text-[var(--color-text-primary)] font-medium">The Carlton, Kodai</span>
            </div>
            <p className="text-body-md leading-relaxed text-[var(--color-text-secondary)]">Competitor has initiated aggressive undercutting strategy (-12% ADR) for the upcoming peak season segment.</p>
            <div className="mt-phi-md pt-phi-md flex justify-between items-center border-t border-[var(--color-border)]">
              <span className="text-data-mono text-[var(--color-negative)] font-medium">Est. Impact: -₹45K</span>
              <button className="text-label-caps px-4 py-2 rounded-lg transition-colors border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-black/5 bg-white shadow-sm">COUNTER STRATEGY</button>
            </div>
          </div>
        </div>

        {/* Holiday Forecasting (Full Width) */}
        <div className="md:col-span-12 clay-panel rounded-2xl p-phi-lg mt-phi-md group hover:scale-[1.005] transition-transform duration-500">
          <div className="flex flex-col md:flex-row gap-phi-xl items-center relative z-10">
            <div className="w-full md:w-1/3">
              <div className="flex items-center gap-3 mb-phi-sm">
                <span className="material-symbols-outlined text-[var(--color-analytics)]">calendar_month</span>
                <h3 className="text-metric-xl text-[var(--color-text-primary)]">Holiday Forecasting</h3>
              </div>
              <p className="text-body-md mb-phi-lg text-[var(--color-text-secondary)]">Predictive models indicate unprecedented compression for the upcoming peak season period.</p>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-data-mono mb-2">
                    <span className="text-[var(--color-text-primary)]">Projected Occupancy</span>
                    <span className="text-[var(--color-analytics)] font-medium">94.2%</span>
                  </div>
                  <div className="h-2 w-full rounded-full overflow-hidden clay-inset">
                    <div className="h-full rounded-full bg-[var(--color-analytics)]" style={{ width: '94.2%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-data-mono mb-2">
                    <span className="text-[var(--color-text-primary)]">Rate Elasticity</span>
                    <span className="text-[var(--color-positive)] font-medium">High</span>
                  </div>
                  <div className="h-2 w-full rounded-full overflow-hidden clay-inset">
                    <div className="h-full rounded-full bg-[var(--color-positive)]" style={{ width: '85%' }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="w-full md:w-2/3 h-[200px] relative flex items-end justify-between px-6 pb-2 border-l border-b border-[var(--color-border)]">
              {[30, 45, 85, 100, 60].map((h, i) => (
                <div key={i} className="w-12 rounded-t-md transition-all hover:opacity-80 shadow-sm" style={{
                  height: `${h}%`,
                  background: i === 3 ? 'var(--color-gold)' : i === 2 ? 'var(--color-analytics)' : 'var(--color-soft-ivory)',
                  border: '1px solid var(--color-border)',
                  borderBottom: 'none'
                }}>
                  <div className="text-data-mono text-center -mt-8 font-medium" style={{ color: i === 3 ? 'var(--color-gold)' : i === 2 ? 'var(--color-analytics)' : 'var(--color-text-secondary)' }}>
                    W{i + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
