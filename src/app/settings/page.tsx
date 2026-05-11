'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState } from 'react';

export default function SettingsPage() {
  const [toggles, setToggles] = useState({ booking: true, expedia: true, advisor: false, aggressive: true });

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-phi-xl gap-4">
        <div>
          <h1 className="text-headline-lg" style={{ color: 'var(--color-text-primary)' }}>Platform Settings</h1>
          <p className="text-body-md mt-1" style={{ color: 'var(--color-text-secondary)' }}>Configure global enterprise parameters, data acquisition nodes, and automated logic systems.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-6 py-3 rounded-xl text-label-caps transition-colors bg-white hover:bg-white/80 shadow-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>Audit Log</button>
          <button className="px-6 py-3 rounded-xl text-label-caps transition-colors clay-button">Save Configuration</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        {/* Data Acquisition */}
        <section className="clay-panel rounded-2xl p-phi-lg">
          <div className="flex justify-between items-center mb-phi-md">
            <h3 className="text-headline-mobile" style={{ color: 'var(--color-text-primary)' }}>Data Acquisition Nodes</h3>
            <span className="text-label-caps px-3 py-1 rounded-md clay-inset" style={{ color: 'var(--color-positive)', fontWeight: 600 }}>LIVE</span>
          </div>
          <p className="text-data-mono mb-phi-lg" style={{ color: 'var(--color-text-secondary)' }}>OTA Scraper Source Management</p>
          {[
            { name: 'Booking.com Global', interval: '15m', nodes: 42, key: 'booking' as const },
            { name: 'Expedia Partner API', interval: '30m', nodes: 18, key: 'expedia' as const },
            { name: 'TripAdvisor Meta', interval: '1h', nodes: 8, key: 'advisor' as const },
          ].map((source) => (
            <div key={source.key} className="flex justify-between items-center py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <div className="text-data-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>{source.name}</div>
                <div className="text-data-mono" style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>Interval: {source.interval} | Nodes: {source.nodes}</div>
              </div>
              <button
                onClick={() => setToggles(p => ({ ...p, [source.key]: !p[source.key] }))}
                className="w-12 h-6 rounded-full relative transition-colors duration-300 clay-inset"
                style={{ background: toggles[source.key] ? 'var(--color-positive)' : 'var(--color-soft-ivory)' }}
              >
                <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform duration-300 shadow-sm"
                  style={{ left: toggles[source.key] ? '26px' : '2px' }} />
              </button>
            </div>
          ))}
        </section>

        {/* Automated Logic */}
        <section className="clay-panel rounded-2xl p-phi-lg">
          <div className="flex items-center gap-2 mb-phi-md">
            <span className="material-symbols-outlined" style={{ color: 'var(--color-gold)' }}>bolt</span>
            <h3 className="text-headline-mobile" style={{ color: 'var(--color-text-primary)' }}>Automated Pricing Logic</h3>
          </div>
          <p className="text-data-mono mb-phi-lg" style={{ color: 'var(--color-text-secondary)' }}>Global AI Constraints</p>
          <div className="space-y-6">
            <div className="clay-inset p-4 rounded-xl">
              <div className="flex justify-between text-data-mono mb-2">
                <span style={{ color: 'var(--color-text-primary)' }}>Base Margin Minimum Threshold</span>
                <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>12.5%</span>
              </div>
              <input type="range" className="w-full h-2 rounded-lg appearance-none cursor-pointer" style={{ background: 'var(--color-border)' }} min="0" max="100" defaultValue="35" />
              <div className="flex justify-between text-data-mono mt-2" style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>
                <span>0%</span><span>Hard Max: 35%</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center py-2 px-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <div className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>Competitor Variance Limit</div>
                <div className="text-data-mono" style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>Maximum deviation from comp-set mean</div>
              </div>
              <div className="text-data-mono font-medium clay-inset px-3 py-1 rounded" style={{ color: 'var(--color-text-primary)' }}>₹ 1,500</div>
            </div>
            
            <div className="flex justify-between items-center py-2 px-2">
              <div>
                <div className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>Aggressive Volume Positioning</div>
                <div className="text-data-mono" style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>Undercut by 1% when occupancy {'<'} 60%</div>
              </div>
              <button
                onClick={() => setToggles(p => ({ ...p, aggressive: !p.aggressive }))}
                className="w-12 h-6 rounded-full relative transition-colors duration-300 clay-inset"
                style={{ background: toggles.aggressive ? 'var(--color-positive)' : 'var(--color-soft-ivory)' }}
              >
                <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform duration-300 shadow-sm"
                  style={{ left: toggles.aggressive ? '26px' : '2px' }} />
              </button>
            </div>
          </div>
        </section>

        {/* System Integration */}
        <section className="clay-card rounded-2xl p-phi-lg md:col-span-2">
          <div className="flex justify-between items-center mb-phi-md">
            <h3 className="text-headline-mobile" style={{ color: 'var(--color-text-primary)' }}>Gemini AI & PMS Integrations</h3>
            <button className="text-label-caps px-4 py-2 rounded-xl" style={{ color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>+ Generate New Key</button>
          </div>
          <p className="text-data-mono mb-6" style={{ color: 'var(--color-text-secondary)' }}>API Credentials & Webhooks</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-phi-lg">
            <div className="clay-inset p-4 rounded-xl">
              <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>Gemini Pro Vision Engine Key</span>
              <div className="flex items-center gap-2 mt-3">
                <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-gold)' }}>key</span>
                <span className="text-data-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>sk-gem-••••••••••••</span>
                <span className="text-data-mono ml-auto" style={{ color: 'var(--color-positive)', fontSize: '10px' }}>Active</span>
              </div>
            </div>
            <div className="clay-inset p-4 rounded-xl">
              <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>Kodai PMS Target Webhook</span>
              <div className="flex flex-col mt-3">
                <span className="text-data-mono truncate" style={{ color: 'var(--color-text-primary)' }}>https://api.kodaipms.internal/v2/rates/sync</span>
                <span className="text-data-mono mt-1" style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>Last push: 5m ago</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Status Bar */}
      <div className="mt-phi-xl flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[var(--color-positive)] shadow-sm" />
        <span className="text-data-mono font-medium" style={{ color: 'var(--color-positive)' }}>All Systems Operational</span>
      </div>
    </DashboardLayout>
  );
}
