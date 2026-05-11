'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect } from 'react';
import type { LiveRateRow } from '@/types';

export default function LiveRatesPage() {
  const [liveRates, setLiveRates] = useState<LiveRateRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('Never');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/rates/live');
      if (!res.ok) throw new Error('Failed to fetch live rates');
      const data = await res.json();
      if (data.success && data.data) {
        setLiveRates(data.data.rates);
        setLastUpdated(new Date(data.data.lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Compute stats
  const hkiRate = liveRates.find(r => r.isTarget);
  const carltonRate = liveRates.find(r => r.slug === 'the-carlton');
  const tamaraRate = liveRates.find(r => r.slug === 'the-tamara-kodai');
  const sterlingRate = liveRates.find(r => r.slug === 'sterling-kodai-lake');
  const lePosheRate = liveRates.find(r => r.slug === 'le-poshe-by-sparsa');

  // Compute average of competitors
  const competitors = liveRates.filter(r => !r.isTarget && r.currentMapRate != null);
  const compAvg = competitors.length > 0 
    ? competitors.reduce((sum, r) => sum + (r.currentMapRate || 0), 0) / competitors.length 
    : 0;

  // Extract all OTAs used across all hotels to show disparity.
  // In a real scenario, this would come from a dedicated /api/rates/ota endpoint.
  // We'll aggregate them here for demonstration.
  const allOTAs = Array.from(new Set(liveRates.map(r => r.cheapestOta).filter(Boolean))) as string[];

  return (
    <DashboardLayout>
      {/* Header Ticker Bar */}
      <div className="flex items-center gap-6 mb-phi-lg overflow-x-auto pb-2"
        style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>LIVE PULSE</span>
          <span className="text-data-mono" style={{ color: 'var(--color-gold)' }}>HKI-01</span>
          <span className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>{hkiRate?.currentMapRate ? `₹${hkiRate.currentMapRate.toLocaleString()}` : '--'}</span>
          <span className="text-data-mono" style={{ color: (hkiRate?.deltaPercent || 0) >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
            {hkiRate?.deltaPercent ? (hkiRate.deltaPercent > 0 ? `+${hkiRate.deltaPercent}%` : `${hkiRate.deltaPercent}%`) : '0.0%'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>CARL-01</span>
          <span className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>{carltonRate?.currentMapRate ? `₹${carltonRate.currentMapRate.toLocaleString()}` : '--'}</span>
          <span className="text-data-mono" style={{ color: (carltonRate?.deltaPercent || 0) >= 0 ? 'var(--color-text-secondary)' : 'var(--color-negative)' }}>
            {carltonRate?.deltaPercent ? (carltonRate.deltaPercent > 0 ? `+${carltonRate.deltaPercent}%` : `${carltonRate.deltaPercent}%`) : '0.0%'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>TAM-01</span>
          <span className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>{tamaraRate?.currentMapRate ? `₹${tamaraRate.currentMapRate.toLocaleString()}` : '--'}</span>
          <span className="text-data-mono" style={{ color: (tamaraRate?.deltaPercent || 0) >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
            {tamaraRate?.deltaPercent ? (tamaraRate.deltaPercent > 0 ? `+${tamaraRate.deltaPercent}%` : `${tamaraRate.deltaPercent}%`) : '0.0%'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>STER-01</span>
          <span className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>{sterlingRate?.currentMapRate ? `₹${sterlingRate.currentMapRate.toLocaleString()}` : '--'}</span>
          <span className="text-data-mono" style={{ color: (sterlingRate?.deltaPercent || 0) >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
            {sterlingRate?.deltaPercent ? (sterlingRate.deltaPercent > 0 ? `+${sterlingRate.deltaPercent}%` : `${sterlingRate.deltaPercent}%`) : '0.0%'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>POSH-01</span>
          <span className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>{lePosheRate?.currentMapRate ? `₹${lePosheRate.currentMapRate.toLocaleString()}` : '--'}</span>
          <span className="text-data-mono" style={{ color: (lePosheRate?.deltaPercent || 0) >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
            {lePosheRate?.deltaPercent ? (lePosheRate.deltaPercent > 0 ? `+${lePosheRate.deltaPercent}%` : `${lePosheRate.deltaPercent}%`) : '0.0%'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-auto">
           <span className="text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>Last updated: {lastUpdated}</span>
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
                  {loading && liveRates.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-gray-500">Loading data...</td></tr>
                  ) : liveRates.map((rate, i) => {
                    const variance = rate.currentMapRate ? (((rate.currentMapRate - compAvg) / compAvg) * 100) : 0;
                    return (
                      <tr key={i} className="transition-colors hover:bg-black/5"
                        style={{ borderBottom: i < liveRates.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                        <td className="py-4 px-4">
                          <div style={{ color: rate.isTarget ? 'var(--color-gold)' : 'var(--color-text-primary)', fontWeight: rate.isTarget ? 600 : 400 }}>{rate.hotelName}</div>
                          <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px', textTransform: 'capitalize' }}>{rate.category}</div>
                        </td>
                        <td className="py-4 px-4 text-right" style={{ color: 'var(--color-text-primary)' }}>{rate.currentMapRate ? `₹${rate.currentMapRate.toLocaleString()}` : '--'}</td>
                        <td className="py-4 px-4 text-right" style={{ color: 'var(--color-text-secondary)' }}>₹{Math.round(compAvg).toLocaleString()}</td>
                        <td className="py-4 px-4 text-right" style={{ color: variance > 0 ? 'var(--color-positive)' : variance < 0 ? 'var(--color-negative)' : 'var(--color-text-secondary)' }}>
                          {variance > 0 ? `+${variance.toFixed(1)}%` : `${variance.toFixed(1)}%`}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="w-3 h-3 rounded-full mx-auto" style={{
                            background: rate.availability === 'sold-out' ? 'var(--color-negative)' : rate.availability === 'high' ? 'var(--color-positive)' : 'var(--color-warning)',
                            opacity: rate.availability === 'sold-out' ? 0.3 : 1,
                            boxShadow: rate.availability === 'high' ? '0 0 8px rgba(45, 106, 79, 0.5)' : 'none',
                          }} />
                        </td>
                      </tr>
                    );
                  })}
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
            {hkiRate && hkiRate.cheapestOta && hkiRate.cheapestOta !== 'official' && (
              <div className="p-4 rounded-xl mb-phi-lg clay-inset" style={{ border: '1px solid rgba(168, 121, 69, 0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-warning)' }}>warning</span>
                  <span className="text-label-caps" style={{ color: 'var(--color-warning)' }}>Rate Leakage Detected</span>
                </div>
                <p className="text-body-md" style={{ color: 'var(--color-text-secondary)' }}>
                  <span className="capitalize">{hkiRate.cheapestOta}</span> is offering a lower rate than official channels.
                </p>
              </div>
            )}

            {/* OTA Source List */}
            <div className="flex flex-col gap-4">
              {allOTAs.length === 0 ? (
                <p className="text-body-md text-gray-500">No OTA data available.</p>
              ) : allOTAs.map((source, i) => (
                <div key={i} className="flex items-center justify-between" style={{ borderBottom: i < allOTAs.length - 1 ? '1px solid var(--color-border)' : 'none', paddingBottom: i < allOTAs.length - 1 ? '16px' : '0' }}>
                  <span className="text-data-mono capitalize" style={{ color: 'var(--color-text-primary)' }}>{source}</span>
                  <div className="h-2 flex-1 mx-4 rounded-full overflow-hidden clay-inset">
                    <div className="h-full rounded-full" style={{
                      width: `${95 - i * 12}%`,
                      background: source === 'official' || source === 'direct' ? 'var(--color-positive)' : i % 2 === 0 ? 'var(--color-warning)' : 'var(--color-analytics)',
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
