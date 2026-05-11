'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function HotelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const fetchHotelData = async () => {
      setLoading(true);
      try {
        const [hotelRes, allHistoryRes] = await Promise.all([
          fetch(`/api/hotels/${slug}`),
          fetch(`/api/rates/history?days=90`)
        ]);
        const hotelJson = await hotelRes.json();
        const historyJson = await allHistoryRes.json();

        if (hotelJson.success) setData(hotelJson.data);
        if (historyJson.success) setHistory(historyJson.data.history);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchHotelData();
  }, [slug]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64 text-gray-500">Loading hotel data...</div>
      </DashboardLayout>
    );
  }

  if (!data?.hotel) {
    return (
      <DashboardLayout>
        <div className="flex flex-col justify-center items-center h-64 text-gray-500">
          <p>Hotel not found.</p>
          <button onClick={() => router.push('/hotels')} className="mt-4 px-4 py-2 bg-[var(--color-soft-ivory)] rounded">Back to List</button>
        </div>
      </DashboardLayout>
    );
  }

  const { hotel, snapshot, rates, recommendation } = data;

  return (
    <DashboardLayout>
      <div className="mb-phi-xl flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <span className="text-label-caps px-3 py-1 rounded-lg mb-2 inline-block clay-inset" style={{ color: hotel.isTarget ? 'var(--color-gold)' : 'var(--color-text-secondary)' }}>
            {hotel.category.replace('-', ' ').toUpperCase()} TIER
          </span>
          <h1 className="text-headline-lg mt-2" style={{ color: 'var(--color-text-primary)' }}>{hotel.name}</h1>
          <div className="flex items-center gap-1 mt-2">
            {Array.from({ length: hotel.starRating }).map((_, i) => (
              <span key={i} className="material-symbols-outlined text-lg" style={{ color: 'var(--color-gold)', fontVariationSettings: "'FILL' 1" }}>star</span>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button className="px-6 py-3 rounded-xl text-label-caps transition-colors bg-white hover:bg-white/80 shadow-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>EXPORT BRIEF</button>
          <button className="px-6 py-3 rounded-xl text-label-caps transition-colors clay-button-gold">EDIT PROFILE</button>
        </div>
      </div>

      <p className="text-body-md mb-phi-xl max-w-3xl" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        {hotel.description}
      </p>

      {/* KPI Strip */}
      <div className="flex gap-phi-lg mb-phi-xl flex-wrap">
        {[
          { label: 'YTD OCCUPANCY', value: snapshot?.availability === 'sold-out' ? '100%' : snapshot?.availability === 'high' ? '85%' : '65%', delta: '+2%' },
          { label: 'REVPAR INDEX', value: '112.5', delta: '+3.1' },
          { label: 'MAP TARGET', value: rates?.mapRate ? `₹${rates.mapRate.toLocaleString()}` : '--', delta: rates?.mapRate ? '+₹800' : '--' },
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
              <div className="text-metric-xl mt-2" style={{ color: 'var(--color-text-primary)' }}>{rates?.mapRate ? `₹${rates.mapRate.toLocaleString()}` : '--'} <span className="text-sm font-light text-gray-500">avg</span></div>
            </div>
            <div className="clay-inset rounded-xl p-4">
              <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>BASE CP</span>
              <div className="text-metric-xl mt-2" style={{ color: 'var(--color-text-primary)' }}>{rates?.cpRate ? `₹${rates.cpRate.toLocaleString()}` : '--'} <span className="text-sm font-light text-gray-500">avg</span></div>
            </div>
            <div className="clay-inset rounded-xl p-4">
              <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>BASE EP</span>
              <div className="text-metric-xl mt-2" style={{ color: 'var(--color-text-primary)' }}>{rates?.epRate ? `₹${rates.epRate.toLocaleString()}` : '--'} <span className="text-sm font-light text-gray-500">avg</span></div>
            </div>
            <div className="clay-inset rounded-xl p-4">
              <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>PROJECTED Q3 MAP</span>
              <div className="text-metric-xl mt-2" style={{ color: 'var(--color-gold)' }}>{rates?.mapRate ? `₹${(rates.mapRate * 1.15).toLocaleString()}` : '--'} <span className="text-sm font-light text-gray-500">proj.</span></div>
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
              {recommendation?.reasoning || `Categorized as a Market Leader (${hotel.category}). The algorithm recommends maintaining current pricing strategy based on recent market trends.`}
            </p>
            <div className="flex gap-3 mt-4">
              <span className="text-label-caps px-3 py-1 rounded-md" style={{ background: 'rgba(198,167,105,0.1)', color: 'var(--color-gold)' }}>
                CONFIDENCE: {recommendation ? Math.round(recommendation.confidenceScore * 100) : '85'}%
              </span>
            </div>
          </section>

          <section className="clay-card rounded-2xl p-phi-lg">
            <h3 className="text-headline-mobile mb-4" style={{ color: 'var(--color-text-primary)' }}>Core Facilities Matrix</h3>
            <div className="flex flex-wrap gap-2">
              {hotel.facilities.length > 0 ? hotel.facilities.map((fac: any, i: number) => (
                <span key={i} className="text-data-mono px-3 py-1.5 rounded-full clay-inset" style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                  {fac.name.replace('-', ' ').toUpperCase()}
                </span>
              )) : (
                <span className="text-data-mono text-gray-400">No facilities recorded</span>
              )}
            </div>
          </section>
        </div>

        {/* Historical Trend Chart */}
        <section className="clay-panel rounded-2xl p-phi-lg md:col-span-2 h-[350px] flex flex-col">
          <h3 className="text-headline-mobile mb-phi-md" style={{ color: 'var(--color-text-primary)' }}>Historical MAP Trend vs Competitors (90 Days)</h3>
          <div className="flex-1 w-full relative rounded-xl clay-inset overflow-hidden pt-4 pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })} stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} domain={['dataMin - 1000', 'dataMax + 1000']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                />
                <Line type="monotone" dataKey={slug} name={hotel.name} stroke="var(--color-gold)" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                {slug !== 'hotel-kodai-international' && (
                  <Line type="monotone" dataKey="hotel-kodai-international" name="Kodai Int." stroke="var(--color-analytics)" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                )}
                {slug !== 'the-carlton' && slug === 'hotel-kodai-international' && (
                  <Line type="monotone" dataKey="the-carlton" name="The Carlton" stroke="var(--color-analytics)" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
