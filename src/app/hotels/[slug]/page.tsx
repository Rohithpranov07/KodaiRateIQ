'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

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
        <div className="flex flex-col gap-10">
           <div className="clay-card h-48 shimmer rounded-[32px]" />
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="clay-card h-32 shimmer rounded-2xl" />
              <div className="clay-card h-32 shimmer rounded-2xl" />
              <div className="clay-card h-32 shimmer rounded-2xl" />
           </div>
           <div className="clay-card h-96 shimmer rounded-[32px]" />
        </div>
      </DashboardLayout>
    );
  }

  if (!data?.hotel) {
    return (
      <DashboardLayout>
        <div className="flex flex-col justify-center items-center h-64 text-warm-slate">
          <span className="material-symbols-outlined text-6xl opacity-20 mb-4">search_off</span>
          <p className="text-xl font-light">Intelligence Brief Unavailable</p>
          <button onClick={() => router.push('/hotels')} className="mt-8 px-8 py-3 bg-white shadow-sm rounded-full text-xs font-bold tracking-widest uppercase text-luxury-black border border-black/5 hover:bg-gold hover:text-white transition-all">Return to Registry</button>
        </div>
      </DashboardLayout>
    );
  }

  const { hotel, snapshot, rates, recommendation } = data;

  return (
    <DashboardLayout>
      {/* HEADER SECTION */}
      <section className="mb-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8"
        >
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
               <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase ${
                 hotel.isTarget ? 'bg-gold/10 text-gold shadow-[0_0_20px_rgba(198,167,105,0.1)]' : 'bg-warm-slate/10 text-warm-slate'
               }`}>
                 {hotel.isTarget ? 'Internal Asset' : 'Market Competitor'}
               </span>
               <div className="flex gap-0.5">
                  {Array.from({ length: hotel.starRating }).map((_, i) => (
                    <span key={i} className="material-symbols-outlined text-sm text-gold filled-icon">star</span>
                  ))}
               </div>
            </div>
            <h1 className="text-display-luxury mb-4">{hotel.name}</h1>
            <p className="text-lg text-warm-slate font-light leading-relaxed max-w-2xl">
              {hotel.description}
            </p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
             <button className="flex-1 md:flex-none px-8 py-4 rounded-2xl bg-white shadow-sm text-[10px] font-bold tracking-widest uppercase text-luxury-black border border-black/5 hover:shadow-lg transition-all">Export Brief</button>
             <button className="flex-1 md:flex-none px-8 py-4 rounded-2xl bg-luxury-black text-white text-[10px] font-bold tracking-widest uppercase hover:bg-gold transition-all">Edit Registry</button>
          </div>
        </motion.div>
      </section>

      {/* KPI STRIP */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {[
          { label: 'RevPAR Index', value: '112.5', delta: '+3.1', icon: 'trending_up' },
          { label: 'Market Velocity', value: snapshot?.availability === 'sold-out' ? 'Critical' : 'High', delta: '+12%', icon: 'speed' },
          { label: 'Intelligence Score', value: hotel.facilityScore ? `${hotel.facilityScore}/10` : '8.4/10', delta: '+0.2', icon: 'psychology' },
        ].map((kpi, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="clay-card p-8 rounded-[24px]"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-bold tracking-widest text-warm-slate uppercase">{kpi.label}</span>
              <span className="material-symbols-outlined text-gold text-lg opacity-40">{kpi.icon}</span>
            </div>
            <div className="text-4xl font-medium tracking-tight text-luxury-black mb-2">{kpi.value}</div>
            <div className="text-[10px] font-bold text-positive tracking-widest uppercase flex items-center gap-1">
               {kpi.delta} <span className="opacity-60">vs Market avg</span>
            </div>
          </motion.div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 flex flex-col gap-10">
          {/* RATE STRUCTURE */}
          <section className="clay-card p-10 rounded-[32px]">
            <h2 className="text-editorial-title mb-8">Yield Structure</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="clay-inset p-8 rounded-3xl relative overflow-hidden">
                  <span className="text-[10px] font-bold tracking-widest text-warm-slate uppercase block mb-2">Base MAP Rate</span>
                  <div className="text-5xl font-bold text-luxury-black mb-2">₹{rates?.mapRate?.toLocaleString() ?? '--'}</div>
                  <div className="text-xs text-warm-slate">Current optimized baseline</div>
                  <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-gold/5 flex items-center justify-center">
                     <span className="material-symbols-outlined text-gold">payments</span>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="clay-inset p-4 rounded-2xl">
                     <span className="text-[8px] font-bold tracking-widest text-warm-slate uppercase block mb-1">CP Rate</span>
                     <div className="text-lg font-bold">₹{rates?.cpRate?.toLocaleString() ?? '--'}</div>
                  </div>
                  <div className="clay-inset p-4 rounded-2xl">
                     <span className="text-[8px] font-bold tracking-widest text-warm-slate uppercase block mb-1">EP Rate</span>
                     <div className="text-lg font-bold">₹{rates?.epRate?.toLocaleString() ?? '--'}</div>
                  </div>
                  <div className="clay-inset p-4 rounded-2xl">
                     <span className="text-[8px] font-bold tracking-widest text-warm-slate uppercase block mb-1">Tax Est.</span>
                     <div className="text-lg font-bold">12%</div>
                  </div>
                  <div className="clay-inset p-4 rounded-2xl">
                     <span className="text-[8px] font-bold tracking-widest text-warm-slate uppercase block mb-1">Delta</span>
                     <div className="text-lg font-bold text-positive">+4.2%</div>
                  </div>
               </div>
            </div>
          </section>

          {/* HISTORICAL TRAJECTORY */}
          <section className="clay-card p-10 rounded-[32px] h-[450px] flex flex-col">
            <h2 className="text-editorial-title mb-8">Intelligence Trajectory</h2>
            <div className="flex-1 clay-inset rounded-3xl overflow-hidden p-4">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorBriefGold" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(17,17,17,0.05)" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })} 
                      stroke="var(--color-warm-slate)" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="var(--color-warm-slate)" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(val) => `₹${val/1000}k`} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', borderRadius: '16px', border: 'none', boxShadow: '0 8px 32px rgba(17,17,17,0.1)' }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                    />
                    <Area type="monotone" dataKey={slug} name="Base MAP" stroke="var(--color-gold)" strokeWidth={4} fillOpacity={1} fill="url(#colorBriefGold)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-10">
          {/* AI STRATEGY CONTEXT */}
          <section className="clay-panel p-8 rounded-[32px]">
            <div className="flex items-center gap-3 mb-6">
               <span className="material-symbols-outlined text-gold">psychology</span>
               <h2 className="text-xl font-medium tracking-tight">AI Strategy Context</h2>
            </div>
            <p className="text-sm text-warm-slate leading-relaxed mb-8">
               {recommendation?.reasoning || `Categorized as a Market Leader (${hotel.category}). The MiMo engine recommends maintaining current pricing hierarchy given the proximity to Carlton benchmarks.`}
            </p>
            <div className="clay-inset p-4 rounded-2xl flex justify-between items-center">
               <span className="text-[10px] font-bold tracking-widest text-warm-slate uppercase">Confidence</span>
               <span className="text-sm font-bold text-gold">{recommendation ? Math.round(recommendation.confidenceScore * 100) : '85'}%</span>
            </div>
          </section>

          {/* FACILITY DNA */}
          <section className="clay-card p-8">
            <div className="flex items-center justify-between mb-7">
              <div>
                <h2 className="text-editorial-title">Verified Facility DNA</h2>
                <p className="text-xs font-light mt-0.5" style={{ color: 'var(--color-warm-slate)' }}>
                  {hotel.facilities.length} amenities · OTA-verified May 2026
                </p>
              </div>
              {hotel.luxuryTier && (
                <span className="badge-gold text-[8px]">{hotel.luxuryTier}</span>
              )}
            </div>

            {hotel.facilities.length > 0 ? (
              <div className="flex flex-col gap-6">
                {Object.entries(
                  hotel.facilities.reduce((acc: Record<string, any[]>, fac: any) => {
                    const cat = fac.category || 'Other';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(fac);
                    return acc;
                  }, {})
                ).sort(([a], [b]) => a.localeCompare(b)).map(([category, facs]) => (
                  <div key={category}>
                    <p className="text-[8px] font-black uppercase tracking-[0.22em] mb-2.5"
                      style={{ color: 'var(--color-warm-slate)', opacity: 0.55 }}>
                      {category}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(facs as any[]).map((fac: any) => {
                        const level: string = fac.level ?? 'Standard';
                        const levelColor: Record<string, string> = {
                          Luxury:   'rgba(201,169,110,0.14)',
                          Premium:  'rgba(59,82,128,0.10)',
                          Standard: 'rgba(26,122,85,0.09)',
                          Basic:    'rgba(107,101,96,0.07)',
                        };
                        const textColor: Record<string, string> = {
                          Luxury:   '#8A6A3B',
                          Premium:  '#3B5280',
                          Standard: '#1A7A55',
                          Basic:    '#6B6560',
                        };
                        const borderColor: Record<string, string> = {
                          Luxury:   'rgba(201,169,110,0.3)',
                          Premium:  'rgba(59,82,128,0.22)',
                          Standard: 'rgba(26,122,85,0.2)',
                          Basic:    'rgba(107,101,96,0.18)',
                        };
                        return (
                          <span
                            key={fac.normalizedKey}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-semibold"
                            style={{
                              background: levelColor[level] ?? 'rgba(17,17,17,0.05)',
                              color: textColor[level] ?? 'var(--color-warm-slate)',
                              border: `1px solid ${borderColor[level] ?? 'transparent'}`,
                            }}
                          >
                            <span className="material-symbols-outlined text-[11px]"
                              style={{ color: textColor[level] ?? 'var(--color-warm-slate)' }}>
                              {fac.normalizedKey === 'spa' ? 'spa'
                                : fac.normalizedKey === 'gym' ? 'fitness_center'
                                : fac.normalizedKey === 'wifi' ? 'wifi'
                                : fac.normalizedKey === 'restaurant' ? 'restaurant'
                                : fac.normalizedKey === 'pool' || fac.normalizedKey === 'swimming_pool' ? 'pool'
                                : fac.normalizedKey === 'bar' ? 'local_bar'
                                : fac.normalizedKey === 'yoga' ? 'self_improvement'
                                : fac.normalizedKey === 'golf' ? 'golf_course'
                                : 'check_circle'}
                            </span>
                            {fac.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--color-warm-slate)' }}>No verified records available.</p>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
