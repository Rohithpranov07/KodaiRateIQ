'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect } from 'react';
import type { LiveRateRow, PricingRecommendation } from '@/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const [liveRates, setLiveRates] = useState<LiveRateRow[]>([]);
  const [recommendation, setRecommendation] = useState<PricingRecommendation | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('Never');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [healthInfo, setHealthInfo] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [insightsData, setInsightsData] = useState<any[]>([]);
  const [historyDays, setHistoryDays] = useState<number>(30);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [ratesRes, recRes, healthRes, historyRes, insightsRes] = await Promise.all([
        fetch('/api/rates/live'),
        fetch('/api/recommendation'),
        fetch('/api/health'),
        fetch(`/api/rates/history?days=${historyDays}`),
        fetch('/api/insights')
      ]);

      if (!ratesRes.ok || !recRes.ok || !healthRes.ok || !historyRes.ok || !insightsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const ratesData = await ratesRes.json();
      const recData = await recRes.json();
      const healthData = await healthRes.json();
      const historyJson = await historyRes.json();
      const insightsJson = await insightsRes.json();

      if (ratesData.success && ratesData.data) {
        setLiveRates(ratesData.data.rates);
        setLastUpdated(new Date(ratesData.data.lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      }
      
      if (recData.success && recData.data) {
        setRecommendation(recData.data);
      }
      if (healthData.success && healthData.data) {
        setHealthInfo(healthData.data);
      }
      if (historyJson.success && historyJson.data) {
        setHistoryData(historyJson.data.history);
      }
      if (insightsJson.success && insightsJson.data) {
        setInsightsData(insightsJson.data.slice(0, 3));
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching data.');
    } finally {
      setLoading(false);
    }
  };

  const applyStrategy = async (type: string) => {
    if (!recommendation) return;
    try {
      const res = await fetch('/api/strategy/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: (recommendation as any).id, strategy: type }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Success: ${data.message}`);
        fetchData(); // Refresh to show applied status
      }
    } catch (err) {
      console.error(err);
      alert('Failed to apply strategy.');
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Poll every 60 seconds
    return () => clearInterval(interval);
  }, [historyDays]);

  const targetHotelRate = liveRates.find(r => r.isTarget);
  
  // Scraper Health logic (simplified for dashboard)
  const isHealthy = !error;
  const healthStatus = isHealthy ? 'Online' : 'Failing';

  return (
    <DashboardLayout>
      {/* A. EXECUTIVE HERO SECTION */}
      <section className="clay-panel p-phi-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-gutter mb-phi-xl">
        <div>
          <span className="text-label-caps px-3 py-1 rounded-full mb-4 inline-block" style={{ background: 'rgba(198,167,105,0.15)', color: 'var(--color-gold)' }}>
            HKI EXECUTIVE SUMMARY
          </span>
          <h1 className="text-display-hero mt-2 flex items-center gap-3" style={{ color: 'var(--color-text-primary)', fontWeight: 300 }}>
            {loading && !recommendation ? (
              <span className="animate-pulse bg-gray-200/20 rounded w-48 h-12 inline-block"></span>
            ) : (
              <>₹{recommendation?.recommendedMapRate?.toLocaleString() ?? '---'} <span className="text-metric-xl text-gray-500 font-light">MAP Target</span></>
            )}
          </h1>
          <p className="text-data-mono mt-3" style={{ color: 'var(--color-text-secondary)' }}>
            Last Sync: {lastUpdated} IST • {isHealthy ? 'Real-Time Engine Active' : 'System Degraded'}
            {loading && <span className="ml-2 text-[var(--color-gold)] animate-pulse">(Refreshing...)</span>}
          </p>
        </div>
        
        <div className="flex gap-phi-lg flex-wrap">
          <div className="clay-inset p-phi-md rounded-xl min-w-[160px]">
            <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>AI CONFIDENCE</span>
            <div className="text-metric-xl mt-1" style={{ color: 'var(--color-positive)' }}>
              {recommendation ? `${Math.round(recommendation.confidenceScore * 100)}%` : '--'}
            </div>
            <div className="text-data-mono mt-1" style={{ color: 'var(--color-text-secondary)' }}>High Conviction</div>
          </div>
          <div className="clay-inset p-phi-md rounded-xl min-w-[160px]">
            <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>MARKET POSITION</span>
            <div className="text-metric-xl mt-1" style={{ color: 'var(--color-text-primary)' }}>
              {recommendation?.marketPosition === 'above-market' ? '#1' : recommendation?.marketPosition === 'below-market' ? 'Value' : 'Parity'}
            </div>
            <div className="text-data-mono mt-1" style={{ color: 'var(--color-text-secondary)' }}>Tier 1 Luxury</div>
          </div>
          <div className="clay-inset p-phi-md rounded-xl min-w-[160px]">
            <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>OCCUPANCY SENTIMENT</span>
            <div className="text-metric-xl mt-1 capitalize" style={{ color: 'var(--color-gold)' }}>
              {recommendation?.demandLevel || '--'}
            </div>
            <div className="text-data-mono mt-1" style={{ color: 'var(--color-text-secondary)' }}>Next 7 Days</div>
          </div>
        </div>
      </section>

      {/* B. LIVE RATE COMPARISON TABLE */}
      <section className="clay-card p-phi-lg mb-phi-xl">
        <h2 className="text-headline-mobile mb-phi-md" style={{ color: 'var(--color-text-primary)' }}>Live Pricing Matrix</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-label-caps" style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <th className="py-4 px-4 font-normal">Hotel</th>
                <th className="py-4 px-4 font-normal text-right">MAP Rate</th>
                <th className="py-4 px-4 font-normal text-right">CP Rate</th>
                <th className="py-4 px-4 font-normal text-right">EP Rate</th>
                <th className="py-4 px-4 font-normal text-right">Yday MAP</th>
                <th className="py-4 px-4 font-normal text-right">Day %</th>
                <th className="py-4 px-4 font-normal">Cheapest OTA</th>
                <th className="py-4 px-4 font-normal">Availability</th>
                <th className="py-4 px-4 font-normal">AI Signal</th>
              </tr>
            </thead>
            <tbody className="text-data-mono">
              {loading && liveRates.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-gray-500">Loading live data from pipelines...</td></tr>
              ) : liveRates.map((hotel, i) => (
                <tr key={i} className="hover:bg-black/5 transition-colors" style={{ borderBottom: i < liveRates.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td className="py-4 px-4 font-medium" style={{ color: hotel.isTarget ? 'var(--color-gold)' : 'var(--color-text-primary)' }}>
                    {hotel.hotelName}
                  </td>
                  <td className="py-4 px-4 text-right" style={{ fontWeight: hotel.isTarget ? 600 : 400 }}>
                    {hotel.currentMapRate ? `₹${hotel.currentMapRate.toLocaleString()}` : '--'}
                  </td>
                  <td className="py-4 px-4 text-right">{hotel.currentCpRate ? `₹${hotel.currentCpRate.toLocaleString()}` : '--'}</td>
                  <td className="py-4 px-4 text-right">{hotel.currentEpRate ? `₹${hotel.currentEpRate.toLocaleString()}` : '--'}</td>
                  <td className="py-4 px-4 text-right" style={{ color: 'var(--color-text-secondary)' }}>{hotel.yesterdayMapRate ? `₹${hotel.yesterdayMapRate.toLocaleString()}` : '--'}</td>
                  <td className="py-4 px-4 text-right" style={{ color: (hotel.deltaPercent || 0) > 0 ? 'var(--color-positive)' : (hotel.deltaPercent === 0 ? 'var(--color-text-secondary)' : 'var(--color-negative)') }}>
                    {hotel.deltaPercent ? (hotel.deltaPercent > 0 ? `+${hotel.deltaPercent}%` : `${hotel.deltaPercent}%`) : '0.0%'}
                  </td>
                  <td className="py-4 px-4 capitalize" style={{ color: 'var(--color-text-secondary)' }}>{hotel.cheapestOta || '--'}</td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-1 rounded text-[10px] font-bold uppercase" style={{ background: hotel.availability === 'high' ? 'rgba(45,106,79,0.1)' : hotel.availability === 'sold-out' ? 'rgba(255,180,171,0.1)' : 'rgba(168,121,69,0.1)', color: hotel.availability === 'high' ? 'var(--color-positive)' : hotel.availability === 'sold-out' ? 'var(--color-negative)' : 'var(--color-warning)' }}>
                      {hotel.availability}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="material-symbols-outlined" style={{ color: hotel.trend === 'up' ? 'var(--color-positive)' : hotel.trend === 'stable' ? 'var(--color-gold)' : 'var(--color-text-secondary)' }}>
                      {hotel.trend === 'up' ? 'arrow_upward' : hotel.trend === 'stable' ? 'horizontal_rule' : 'arrow_downward'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-phi-xl">
        {/* C. PRICE TREND CHARTS & D. AI RECOMMENDATION ENGINE */}
        <div className="lg:col-span-8 flex flex-col gap-phi-xl">
          {/* Trend Chart (Requires separate history API call - mocking SVG visually based on real delta) */}
          <section className="clay-card p-phi-lg h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-phi-md">
              <h2 className="text-headline-mobile" style={{ color: 'var(--color-text-primary)' }}>{historyDays}-Day MAP Trajectory</h2>
              <div className="flex gap-2">
                <button onClick={() => setHistoryDays(7)} className="text-label-caps px-3 py-1 rounded" style={{ background: historyDays === 7 ? 'var(--color-gold)' : 'transparent', color: historyDays === 7 ? 'white' : 'var(--color-text-primary)', border: historyDays !== 7 ? '1px solid var(--color-border)' : 'none' }}>7D</button>
                <button onClick={() => setHistoryDays(30)} className="text-label-caps px-3 py-1 rounded" style={{ background: historyDays === 30 ? 'var(--color-gold)' : 'transparent', color: historyDays === 30 ? 'white' : 'var(--color-text-primary)', border: historyDays !== 30 ? '1px solid var(--color-border)' : 'none' }}>30D</button>
              </div>
            </div>
            <div className="flex-1 w-full relative rounded-xl clay-inset overflow-hidden pt-4 pr-4">
              {loading && historyData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">Loading chart data...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })} stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--color-text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}`} domain={['dataMin - 1000', 'dataMax + 1000']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      labelFormatter={(val) => new Date(val).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      formatter={(val: number) => [`₹${val.toLocaleString()}`, 'MAP Rate']}
                    />
                    <Line type="monotone" dataKey="hotel-kodai-international" name="Kodai Int." stroke="var(--color-gold)" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="the-carlton" name="The Carlton" stroke="var(--color-analytics)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="the-tamara-kodai" name="The Tamara" stroke="var(--color-warning)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="sterling-kodai-lake" name="Sterling" stroke="var(--color-positive)" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="le-poshe-by-sparsa" name="Le Poshe" stroke="var(--color-negative)" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* AI Recommendation */}
          <section className="clay-panel p-phi-lg relative overflow-hidden">
            <h2 className="text-headline-mobile mb-phi-md flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-gold)' }}>psychology</span>
              Gemini AI Strategy
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              <div className="clay-inset p-phi-md rounded-xl">
                <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>OPTIMAL TARGET</span>
                <div className="text-metric-xl mt-2" style={{ color: 'var(--color-text-primary)' }}>₹{recommendation?.recommendedMapRate?.toLocaleString() ?? '--'} <span className="text-body-md" style={{ color: 'var(--color-text-secondary)' }}>/ MAP</span></div>
                <div className="text-data-mono mt-2" style={{ color: 'var(--color-positive)' }}>
                  {targetHotelRate?.deltaPercent ? (targetHotelRate.deltaPercent > 0 ? `+${targetHotelRate.deltaPercent}%` : `${targetHotelRate.deltaPercent}%`) : '0.0%'} vs Yesterday
                </div>
                <p className="text-body-md mt-4" style={{ color: 'var(--color-text-secondary)' }}>
                  {recommendation?.reasoning || 'Awaiting AI analysis...'}
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <div onClick={() => applyStrategy('aggressive')} className="clay-card p-4 flex justify-between items-center cursor-pointer hover:bg-black/5 transition-colors">
                  <div>
                    <div className="text-label-caps mb-1" style={{ color: 'var(--color-warning)' }}>AGGRESSIVE (Volume Focus)</div>
                    <div className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>₹{recommendation?.minRate?.toLocaleString() ?? '--'} MAP</div>
                  </div>
                  <span className="material-symbols-outlined text-gray-400">chevron_right</span>
                </div>
                <div onClick={() => applyStrategy('conservative')} className="clay-card p-4 flex justify-between items-center cursor-pointer hover:bg-black/5 transition-colors">
                  <div>
                    <div className="text-label-caps mb-1" style={{ color: 'var(--color-text-secondary)' }}>CONSERVATIVE (Yield Focus)</div>
                    <div className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>₹{recommendation?.maxRate?.toLocaleString() ?? '--'} MAP</div>
                  </div>
                  <span className="material-symbols-outlined text-gray-400">chevron_right</span>
                </div>
                <button 
                  onClick={() => applyStrategy('optimal')}
                  disabled={(recommendation as any)?.isApplied}
                  className={`w-full py-4 mt-auto rounded-xl font-bold transition-all ${
                    (recommendation as any)?.isApplied 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
                      : 'clay-button-gold'
                  }`}
                >
                  {(recommendation as any)?.isApplied ? 'OPTIMAL STRATEGY APPLIED' : 'APPLY OPTIMAL STRATEGY'}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* E. POSITIONING MATRIX & H. SYSTEM HEALTH */}
        <div className="lg:col-span-4 flex flex-col gap-phi-xl">
          {/* Positioning Matrix */}
          <section className="clay-card p-phi-lg h-[350px] flex flex-col">
            <h2 className="text-headline-mobile mb-4" style={{ color: 'var(--color-text-primary)' }}>Positioning Matrix</h2>
            <div className="flex-1 clay-inset rounded-xl relative p-4">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>PRICE (MAP)</span>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>LUXURY TIER</span>
              
              {/* Plot Points mapped loosely from live data */}
              {liveRates.map((hotel, idx) => {
                const yPos = hotel.currentMapRate ? Math.max(10, 90 - ((hotel.currentMapRate - 8000) / 12000) * 80) : 50;
                const xPos = hotel.starRating === 5 ? 20 : hotel.starRating === 4 ? 40 : 60;
                return (
                  <div key={idx} className={`absolute w-3 h-3 rounded-full shadow-md ${hotel.isTarget ? 'bg-[var(--color-gold)] ring-4 ring-gold/20 w-4 h-4' : 'bg-[var(--color-analytics)]'}`} 
                       style={{ top: `${yPos}%`, left: `${xPos}%` }} title={hotel.hotelName}></div>
                );
              })}
            </div>
          </section>

          {/* System Health */}
          <section className="clay-panel p-phi-lg">
            <h2 className="text-label-caps mb-phi-md" style={{ color: 'var(--color-text-secondary)' }}>SYSTEM HEALTH</h2>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>Scraper Engine</span>
                <span className="text-data-mono flex items-center gap-1" style={{ color: healthInfo?.status === 'healthy' ? 'var(--color-positive)' : 'var(--color-warning)' }}>
                  <span className={`w-2 h-2 rounded-full ${healthInfo?.status === 'healthy' ? 'bg-[var(--color-positive)]' : 'bg-[var(--color-warning)]'}`}></span> {healthInfo?.status === 'healthy' ? 'Online' : healthInfo ? 'Degraded' : 'Loading...'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>Last Scrape</span>
                <span className="text-data-mono flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {healthInfo?.lastRun ? new Date(healthInfo.lastRun).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-data-mono" style={{ color: 'var(--color-text-primary)' }}>Gemini AI Context</span>
                <span className="text-data-mono flex items-center gap-1" style={{ color: recommendation ? 'var(--color-positive)' : 'var(--color-text-secondary)' }}>
                  <span className={`w-2 h-2 rounded-full ${recommendation ? 'bg-[var(--color-positive)]' : 'bg-[var(--color-text-secondary)]'}`}></span>
                  {recommendation ? 'Fully Active' : 'Awaiting Data'}
                </span>
              </div>
            </div>
          </section>

          {/* AI Insights Panel */}
          <section className="clay-panel p-phi-lg">
            <div className="flex justify-between items-center mb-phi-md">
              <h2 className="text-label-caps" style={{ color: 'var(--color-gold)' }}>LIVE AI ALERTS</h2>
              <span className="w-2 h-2 rounded-full animate-pulse bg-[var(--color-gold)] shadow-sm"></span>
            </div>
            <div className="flex flex-col gap-3">
              {insightsData.length === 0 ? (
                <div className="text-data-mono text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>No active alerts</div>
              ) : (
                insightsData.map(insight => (
                  <div key={insight.id} className="p-3 rounded-lg clay-inset" style={{ border: insight.severity === 'warning' || insight.severity === 'critical' ? '1px solid rgba(168,121,69,0.2)' : 'none' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-label-caps text-[10px]" style={{ color: insight.severity === 'warning' || insight.severity === 'critical' ? 'var(--color-warning)' : 'var(--color-positive)' }}>
                        {insight.type.replace('-', ' ').toUpperCase()}
                      </span>
                      <span className="text-[10px] text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>{Math.round(insight.confidence * 100)}% conf</span>
                    </div>
                    <p className="text-body-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{insight.title}</p>
                    <p className="text-body-sm mt-1" style={{ color: 'var(--color-text-secondary)', fontSize: '11px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{insight.summary}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
