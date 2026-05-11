'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState('30D');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const [analyticsRes, historyRes] = await Promise.all([
          fetch(`/api/analytics?days=${timeRange}`),
          fetch(`/api/rates/history?days=${timeRange === '1D' ? 1 : timeRange === '3D' ? 3 : timeRange === '7D' ? 7 : timeRange === '90D' ? 90 : timeRange === '1Y' ? 365 : 30}`)
        ]);
        const analyticsJson = await analyticsRes.json();
        const historyJson = await historyRes.json();
        
        if (analyticsJson.success) setData(analyticsJson.data);
        if (historyJson.success) setHistoryData(historyJson.data.history);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchAnalytics();
  }, [timeRange]);

  const kpis = data?.kpis || [
    { label: 'GLOBAL REVPAR', value: '--', delta: '--', color: 'var(--color-text-secondary)' },
    { label: 'ADR VOLATILITY', value: '--', delta: '--', color: 'var(--color-text-secondary)' },
    { label: 'YIELD LEAKAGE', value: '--', delta: '--', color: 'var(--color-text-secondary)' },
    { label: 'AVG OCCUPANCY', value: '--', delta: '--', color: 'var(--color-text-secondary)' },
  ];
  return (
    <DashboardLayout>
      <div className="mb-phi-xl">
        <h1 className="text-headline-lg" style={{ color: 'var(--color-text-primary)' }}>Historical Analytics</h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--color-text-secondary)' }}>Quantitative analysis of past performance, volatility patterns, and unrealized revenue opportunities.</p>
      </div>

      {/* Time Range */}
      <div className="flex gap-2 mb-phi-xl justify-end">
        {['7D','30D','90D','YTD','1Y'].map((p) => (
          <span key={p} onClick={() => setTimeRange(p)} className="text-label-caps px-4 py-2 rounded-xl cursor-pointer transition-colors" style={{
            background: p === timeRange ? 'var(--color-gold)' : 'var(--color-soft-ivory)',
            color: p === timeRange ? 'white' : 'var(--color-text-secondary)',
            fontWeight: p === timeRange ? 600 : 400,
          }}>{p}</span>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter mb-gutter">
        {kpis.map((kpi: any, i: number) => (
          <div key={i} className="clay-card p-phi-lg flex flex-col justify-between items-start group hover:scale-[1.02] transition-transform">
            <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>{kpi.label}</span>
            <div className="text-metric-xl mt-4 mb-2" style={{ color: 'var(--color-text-primary)' }}>{loading ? '--' : kpi.value}</div>
            <span className="text-data-mono px-2 py-1 rounded clay-inset" style={{ color: kpi.color, fontSize: '12px' }}>{loading ? '--' : kpi.delta}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <section className="clay-panel p-phi-lg mb-gutter">
        <h3 className="text-headline-mobile mb-phi-md" style={{ color: 'var(--color-text-primary)' }}>Rate Volatility Distribution ({timeRange})</h3>
        <div className="h-[350px] w-full relative rounded-xl clay-inset overflow-hidden p-4">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">Loading chart data...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="colorMapRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })} stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} domain={['dataMin - 500', 'dataMax + 500']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                />
                <Area type="monotone" dataKey="hotel-kodai-international" name="Kodai Int." stroke="var(--color-gold)" fillOpacity={1} fill="url(#colorMapRate)" />
                <Area type="monotone" dataKey="the-carlton" name="The Carlton" stroke="var(--color-analytics)" fillOpacity={0} strokeWidth={2} />
                <Area type="monotone" dataKey="the-tamara-kodai" name="Tamara" stroke="var(--color-warning)" fillOpacity={0} strokeWidth={2} />
                <Area type="monotone" dataKey="sterling-kodai-lake" name="Sterling" stroke="var(--color-positive)" fillOpacity={0} strokeWidth={1.5} strokeDasharray="3 3" />
                <Area type="monotone" dataKey="le-poshe-by-sparsa" name="Le Poshe" stroke="var(--color-negative)" fillOpacity={0} strokeWidth={1.5} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Bottom */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <section className="clay-card p-phi-lg flex flex-col items-center justify-center">
          <h3 className="text-headline-mobile mb-8 self-start" style={{ color: 'var(--color-text-primary)' }}>Yield Leakage Impact</h3>
          <div className="relative w-40 h-40 bg-[var(--color-soft-ivory)] rounded-full shadow-inner border border-white/50">
            <svg className="absolute w-[110%] h-[110%] -left-[5%] -top-[5%] -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(17,17,17,0.05)" strokeWidth="10" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-negative)" strokeWidth="10" strokeDasharray={`${(data?.leakagePercent || 12) * 2.827} 282.7`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-display-hero" style={{ color: 'var(--color-negative)', fontSize: '2.5rem' }}>-{data?.leakagePercent || 12}<span className="text-xl">%</span></span>
              <span className="text-label-caps mt-1" style={{ color: 'var(--color-text-secondary)' }}>OTA LOSS</span>
            </div>
          </div>
        </section>
        <section className="clay-card p-phi-lg">
          <h3 className="text-headline-mobile mb-4" style={{ color: 'var(--color-text-primary)' }}>Demand Density Heatmap</h3>
          <div className="grid grid-cols-7 gap-2 h-[200px]">
            {data?.heatmap ? data.heatmap.map((h: any, i: number) => (
              <div key={i} className="rounded-md transition-transform hover:scale-110 shadow-sm" style={{ 
                background: `rgba(198,167,105,${h.intensity})`,
                border: '1px solid rgba(198,167,105,0.2)'
              }} title={`Intensity: ${(h.intensity * 100).toFixed(0)}%`} />
            )) : Array.from({length: 35}).map((_, i) => (
              <div key={i} className="rounded-md bg-gray-100" />
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
