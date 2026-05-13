'use client';

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { formatINR, HOTEL_NAMES } from '@/lib/utils';

interface PriceChartProps {
  data: { history: any[]; hotels: { slug: string; name: string }[] } | null;
  loading: boolean;
}

const HOTEL_COLORS: Record<string, string> = {
  'the-carlton': '#f59e0b',
  'the-tamara-kodai': '#a855f7',
  'hotel-kodai-international': '#6366f1',
  'sterling-kodai-lake': '#06b6d4',
  'le-poshe-by-sparsa': '#10b981',
};

export function PriceChart({ data, loading }: PriceChartProps) {
  const [period, setPeriod] = useState<'7' | '14' | '30'>('30');

  if (loading) {
    return (
      <section className="glass-card p-6">
        <div className="shimmer h-6 w-56 mb-6" />
        <div className="shimmer h-80 w-full" />
      </section>
    );
  }

  const history = data?.history ?? [];
  const hotels = data?.hotels ?? [];

  // Filter by period
  const periodDays = parseInt(period);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - periodDays);
  const filtered = history.filter(h => new Date(h.date) >= cutoff);

  // Format dates for display
  const chartData = filtered.map(point => ({
    ...point,
    dateLabel: new Date(point.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  }));

  return (
    <section id="price-chart" className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold">Price Movement</h3>
            <p className="text-xs text-[#5a5a6e]">MAP Rate Trends — All Hotels</p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-1">
          {(['7', '14', '30'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                period === p
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-[#8b8b9e] hover:text-white'
              }`}
            >
              {p}D
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {hotels.map(hotel => (
                  <linearGradient key={hotel.slug} id={`gradient-${hotel.slug}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={HOTEL_COLORS[hotel.slug] || '#6366f1'} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={HOTEL_COLORS[hotel.slug] || '#6366f1'} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fill: '#5a5a6e', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#5a5a6e', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
                tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}K`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(13, 13, 20, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}
                labelStyle={{ color: '#8b8b9e', fontSize: 12, marginBottom: 8 }}
                itemStyle={{ padding: '2px 0' }}
                formatter={(value: any, name: any) => [
                  formatINR(value),
                  HOTEL_NAMES[name] || name,
                ]}
              />
              <Legend
                wrapperStyle={{ paddingTop: 20, fontSize: 12 }}
                formatter={(value: string) => (
                  <span style={{ color: '#8b8b9e' }}>{HOTEL_NAMES[value] || value}</span>
                )}
              />
              {hotels.map(hotel => (
                <Area
                  key={hotel.slug}
                  type="monotone"
                  dataKey={hotel.slug}
                  stroke={HOTEL_COLORS[hotel.slug] || '#6366f1'}
                  strokeWidth={hotel.slug === 'hotel-kodai-international' ? 3 : 1.5}
                  fill={`url(#gradient-${hotel.slug})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-80 flex items-center justify-center text-[#5a5a6e]">
            No historical data available
          </div>
        )}
      </div>
    </section>
  );
}
