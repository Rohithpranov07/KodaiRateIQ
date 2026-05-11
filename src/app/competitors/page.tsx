'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect } from 'react';

interface CompetitorRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  isTarget: boolean;
  map: number | null;
  cp: number | null;
  ep: number | null;
  ota: number | null;
  vol: string;
  facilities: string[];
}

export default function CompetitorsPage() {
  const [compSet, setCompSet] = useState<CompetitorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompetitors = async () => {
      try {
        const res = await fetch('/api/competitors');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        if (data.success && data.data) {
          setCompSet(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCompetitors();
  }, []);

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-phi-xl gap-4">
        <div>
          <h1 className="text-headline-lg" style={{ color: 'var(--color-text-primary)' }}>Competitor Analytics</h1>
          <p className="text-body-md mt-2" style={{ color: 'var(--color-text-secondary)' }}>Market spread, historical movement, and OTA disparities.</p>
        </div>
        <div className="flex gap-4">
          <button className="px-6 py-3 rounded-xl text-label-caps transition-colors bg-white hover:bg-white/80 shadow-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>DOWNLOAD REPORT</button>
        </div>
      </div>

      {/* Competitor Spread Matrix */}
      <section className="clay-card p-phi-lg mb-phi-xl">
        <h2 className="text-headline-mobile mb-phi-md" style={{ color: 'var(--color-text-primary)' }}>Competitor Parity Matrix</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-label-caps" style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <th className="py-4 px-4 font-normal">Property</th>
                <th className="py-4 px-4 font-normal">Tier</th>
                <th className="py-4 px-4 font-normal text-right">Direct MAP</th>
                <th className="py-4 px-4 font-normal text-right">Direct CP</th>
                <th className="py-4 px-4 font-normal text-right">OTA Lowest (CP)</th>
                <th className="py-4 px-4 font-normal text-center">Volatility</th>
                <th className="py-4 px-4 font-normal">Key Facilities</th>
              </tr>
            </thead>
            <tbody className="text-data-mono">
              {loading ? (
                <tr><td colSpan={7} className="py-8 text-center text-gray-500">Loading competitor data...</td></tr>
              ) : compSet.map((hotel, i) => (
                <tr key={i} className="hover:bg-black/5 transition-colors" style={{ borderBottom: i < compSet.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td className="py-4 px-4 font-medium" style={{ color: hotel.isTarget ? 'var(--color-gold)' : 'var(--color-text-primary)' }}>
                    {hotel.name}
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-1 rounded text-[10px] uppercase font-semibold clay-inset" style={{ color: 'var(--color-text-secondary)' }}>
                      {hotel.category}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right" style={{ color: 'var(--color-text-primary)' }}>{hotel.map ? `₹${hotel.map.toLocaleString()}` : '--'}</td>
                  <td className="py-4 px-4 text-right" style={{ color: 'var(--color-text-secondary)' }}>{hotel.cp ? `₹${hotel.cp.toLocaleString()}` : '--'}</td>
                  <td className="py-4 px-4 text-right">
                    {hotel.ota ? (
                      <span style={{ color: hotel.cp && hotel.ota < hotel.cp ? 'var(--color-negative)' : 'var(--color-text-secondary)' }}>
                        ₹{hotel.ota.toLocaleString()}
                      </span>
                    ) : '--'}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="material-symbols-outlined text-[18px]" style={{ color: hotel.vol === 'High' ? 'var(--color-negative)' : hotel.vol === 'Low' ? 'var(--color-positive)' : 'var(--color-warning)' }}>
                      {hotel.vol === 'High' ? 'show_chart' : hotel.vol === 'Low' ? 'horizontal_rule' : 'stacked_line_chart'}
                    </span>
                  </td>
                  <td className="py-4 px-4 capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                    {hotel.facilities.slice(0, 3).join(' • ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        {/* Historical Movement Chart */}
        <section className="clay-panel p-phi-lg h-[400px] flex flex-col">
          <h2 className="text-headline-mobile mb-phi-md" style={{ color: 'var(--color-text-primary)' }}>30-Day Rate Movement</h2>
          <div className="flex-1 clay-inset rounded-xl relative overflow-hidden p-4">
            {/* Horizontal Grid lines */}
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="absolute w-full h-[1px] bg-[var(--color-border)]" style={{ top: `${20 + i * 20}%` }} />
            ))}
            {/* SVG Chart Lines */}
            <svg className="absolute inset-0 w-full h-full p-4" preserveAspectRatio="none" viewBox="0 0 100 100">
              {/* Carlton */}
              <path d="M0,20 L20,15 L40,15 L60,18 L80,20 L100,20" fill="none" stroke="var(--color-analytics)" strokeWidth="1.5" opacity="0.6" />
              {/* Tamara */}
              <path d="M0,35 L20,35 L40,30 L60,25 L80,30 L100,35" fill="none" stroke="var(--color-warning)" strokeWidth="1.5" opacity="0.8" />
              {/* HKI */}
              <path d="M0,50 L20,45 L40,55 L60,40 L80,40 L100,45" fill="none" stroke="var(--color-gold)" strokeWidth="2.5" />
              {/* Sterling */}
              <path d="M0,70 L20,65 L40,75 L60,65 L80,70 L100,75" fill="none" stroke="var(--color-analytics)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" />
            </svg>
          </div>
        </section>

        {/* OTA Pricing Disparity Distribution */}
        <section className="clay-panel p-phi-lg h-[400px] flex flex-col">
          <h2 className="text-headline-mobile mb-phi-md" style={{ color: 'var(--color-text-primary)' }}>OTA Pricing Spread (Variance vs Direct)</h2>
          <div className="flex-1 clay-inset rounded-xl relative p-6 flex flex-col justify-around">
             {loading ? (
               <p className="text-center text-gray-500">Calculating disparities...</p>
             ) : compSet.map((hotel, i) => {
               if (!hotel.cp || !hotel.ota) return null;
               const variance = hotel.cp - hotel.ota;
               const variancePercent = variance > 0 ? (variance / hotel.cp) * 100 : 0;
               return (
                 <div key={i} className="flex items-center gap-4">
                   <div className="w-32 text-data-mono truncate" style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{hotel.name}</div>
                   <div className="flex-1 h-3 rounded-full bg-[var(--color-soft-ivory)] shadow-inner relative">
                     {variancePercent > 0 ? (
                       <div className="absolute top-0 right-1/2 h-full rounded-l-full bg-[var(--color-negative)]" style={{ width: `${variancePercent * 2}%` }} />
                     ) : (
                       <div className="absolute top-0 left-1/2 w-1 h-full bg-[var(--color-text-secondary)]" />
                     )}
                   </div>
                   <div className="w-16 text-right text-data-mono font-medium" style={{ color: variancePercent > 0 ? 'var(--color-negative)' : 'var(--color-text-secondary)' }}>
                     {variancePercent > 0 ? `-${variancePercent.toFixed(1)}%` : 'Parity'}
                   </div>
                 </div>
               );
             })}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
