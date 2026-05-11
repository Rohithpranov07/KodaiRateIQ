'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect } from 'react';
import type { PricingRecommendation } from '@/types';

export default function RecommendationsPage() {
  const [recommendation, setRecommendation] = useState<PricingRecommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendation = async () => {
      try {
        const res = await fetch('/api/recommendation');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        if (data.success && data.data) {
          setRecommendation(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRecommendation();
    const interval = setInterval(fetchRecommendation, 60000);
    return () => clearInterval(interval);
  }, []);

  const confScore = recommendation ? Math.round(recommendation.confidenceScore * 100) : 0;
  const strokeDash = confScore > 0 ? (confScore / 100) * 289 : 0;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-phi-xl gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-label-caps px-3 py-1 rounded-md" style={{ color: 'var(--color-gold)', background: 'rgba(198,167,105,0.1)' }}>HOTEL KODAI INTERNATIONAL</span>
            <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)' }}>STRATEGIC PRICING INTELLIGENCE</span>
          </div>
          <h1 className="text-headline-lg" style={{ color: 'var(--color-text-primary)' }}>MAP Rate Optimization</h1>
        </div>
        <div className="flex gap-4">
          <button className="px-6 py-3 rounded-xl text-label-caps transition-colors bg-transparent hover:bg-black/5" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>EXPORT DATA</button>
          <button className="px-6 py-3 rounded-xl text-label-caps transition-colors clay-button-gold">APPLY STRATEGY</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Hero AI Recommendation Panel (8 cols) */}
        <div className="col-span-12 lg:col-span-8 clay-panel rounded-2xl p-phi-xl relative overflow-hidden flex flex-col justify-between min-h-[400px]">
          <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full blur-[100px] pointer-events-none" style={{ background: 'rgba(198,167,105,0.15)' }} />
          <div className="flex flex-col md:flex-row justify-between items-start z-10 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined" style={{ color: 'var(--color-gold)' }}>auto_awesome</span>
                <h3 className="text-label-caps tracking-widest" style={{ color: 'var(--color-gold)' }}>OPTIMAL MAP RATE RECOMMENDATION</h3>
              </div>
              <div className="flex items-baseline gap-4 mt-6">
                <span className="text-data-mono text-2xl" style={{ color: 'var(--color-text-secondary)' }}>INR</span>
                <span className="text-display-hero tracking-tighter" style={{ color: 'var(--color-text-primary)', fontWeight: 300 }}>
                  {loading ? '...' : recommendation?.recommendedMapRate?.toLocaleString() ?? '--'}
                </span>
                <span className="text-body-md" style={{ color: 'var(--color-text-secondary)' }}>/ night</span>
              </div>
              <div className="mt-8 flex gap-8">
                <div className="clay-inset p-4 rounded-xl">
                  <p className="text-label-caps mb-1" style={{ color: 'var(--color-text-secondary)' }}>STRATEGY TYPE</p>
                  <p className="text-metric-xl capitalize" style={{ color: 'var(--color-positive)' }}>
                    {loading ? '...' : recommendation?.strategy || 'Balanced'}
                  </p>
                </div>
                <div className="clay-inset p-4 rounded-xl">
                  <p className="text-label-caps mb-1" style={{ color: 'var(--color-text-secondary)' }}>DEMAND LEVEL</p>
                  <p className="text-metric-xl capitalize" style={{ color: 'var(--color-text-primary)' }}>
                    {loading ? '...' : recommendation?.demandLevel || 'Medium'}
                    <span className="text-sm ml-2 capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                      {recommendation?.seasonType ? `(${recommendation.seasonType} Season)` : ''}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            
            {/* Confidence Meter */}
            <div className="relative w-48 h-48 flex items-center justify-center shrink-0 bg-white/40 rounded-full shadow-inner border border-white/50">
              <svg className="absolute w-[110%] h-[110%] -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(17,17,17,0.05)" strokeWidth="6" strokeDasharray="289 289" />
                <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-gold)" strokeWidth="6" strokeDasharray={`${strokeDash} 289`} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-display-hero" style={{ color: 'var(--color-text-primary)', fontSize: '3rem' }}>
                  {loading ? '--' : confScore}<span className="text-2xl">%</span>
                </span>
                <span className="text-label-caps mt-1" style={{ color: 'var(--color-text-secondary)' }}>CONFIDENCE</span>
              </div>
            </div>
          </div>
          
          <div className="mt-8 z-10 clay-inset p-4 rounded-xl">
            <p className="text-body-md" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              <strong>AI Reasoning: </strong> 
              {loading ? 'Analyzing market conditions...' : recommendation?.reasoning || 'No analysis available for current date.'}
            </p>
          </div>
        </div>

        {/* Strategy Selection (4 cols) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-phi-md">
          {/* Premium (Recommended) */}
          <div className="clay-card rounded-2xl p-phi-lg cursor-pointer transition-transform hover:scale-[1.02] relative group"
            style={{ border: '2px solid var(--color-gold)' }}>
            <div className="absolute top-4 right-4">
              <span className="material-symbols-outlined" style={{ color: 'var(--color-gold)' }}>check_circle</span>
            </div>
            <h4 className="text-label-caps tracking-widest mb-2" style={{ color: 'var(--color-gold)' }}>OPTIMAL POSITIONING</h4>
            <p className="text-metric-xl mb-1" style={{ color: 'var(--color-text-primary)' }}>
              {loading ? '...' : `₹${recommendation?.optimalRate?.toLocaleString() ?? '--'}`}
            </p>
            <p className="text-data-mono capitalize" style={{ color: 'var(--color-text-secondary)' }}>
              {recommendation?.strategy || 'Balanced'} Focus
            </p>
          </div>
          
          {/* Aggressive */}
          <div className="clay-elevated rounded-2xl p-phi-lg cursor-pointer transition-transform hover:scale-[1.02] group"
            style={{ border: '1px solid transparent' }}>
            <h4 className="text-label-caps tracking-widest mb-2" style={{ color: 'var(--color-text-secondary)' }}>AGGRESSIVE (Volume Focus)</h4>
            <p className="text-metric-xl mb-1" style={{ color: 'var(--color-text-primary)' }}>
              {loading ? '...' : `₹${recommendation?.minRate?.toLocaleString() ?? '--'}`}
            </p>
            <p className="text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>Maximize Occupancy</p>
          </div>
          
          {/* Conservative */}
          <div className="clay-elevated rounded-2xl p-phi-lg cursor-pointer transition-transform hover:scale-[1.02] group"
            style={{ border: '1px solid transparent' }}>
            <h4 className="text-label-caps tracking-widest mb-2" style={{ color: 'var(--color-text-secondary)' }}>CONSERVATIVE (Yield Focus)</h4>
            <p className="text-metric-xl mb-1" style={{ color: 'var(--color-text-primary)' }}>
              {loading ? '...' : `₹${recommendation?.maxRate?.toLocaleString() ?? '--'}`}
            </p>
            <p className="text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>Maximize RevPAR</p>
          </div>
        </div>

        {/* Occupancy vs Revenue Chart (7 cols) */}
        <div className="col-span-12 lg:col-span-7 clay-card rounded-2xl p-margin relative">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-label-caps tracking-widest" style={{ color: 'var(--color-text-primary)' }}>OCCUPANCY PREDICTION VS REVENUE IMPACT</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: 'var(--color-analytics)' }} /><span className="text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>Revenue (Est)</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ border: '2px solid var(--color-gold)' }} /><span className="text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>Occupancy %</span></div>
            </div>
          </div>
          {/* Chart Bars - Visual approximation based on demandLevel */}
          <div className="h-64 w-full flex items-end gap-3 relative pb-4 border-b border-[var(--color-border)]">
            {[40, 50, 65, recommendation?.demandLevel === 'high' ? 95 : recommendation?.demandLevel === 'low' ? 60 : 75, 70, 60, 45].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-md transition-all hover:opacity-80 clay-inset" style={{
                height: `${h}%`,
                background: i === 3 ? 'var(--color-gold)' : 'var(--color-analytics)',
                opacity: i === 3 ? 1 : 0.4,
              }} />
            ))}
            <svg className="absolute inset-0 w-full h-full pointer-events-none pb-4" preserveAspectRatio="none" viewBox="0 0 100 100">
              <path d={`M 5 60 L 20 50 L 35 40 L 50 ${recommendation?.demandLevel === 'high' ? 10 : recommendation?.demandLevel === 'low' ? 35 : 20} L 65 35 L 80 45 L 95 65`} fill="none" stroke="var(--color-gold)" strokeLinejoin="round" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              <circle cx="50" cy={recommendation?.demandLevel === 'high' ? 10 : recommendation?.demandLevel === 'low' ? 35 : 20} r="2.5" fill="var(--color-gold)" stroke="white" strokeWidth="1" />
            </svg>
          </div>
          <div className="flex justify-between mt-4 text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>
            {['Mon', 'Tue', 'Wed', 'Thu (Target)', 'Fri', 'Sat', 'Sun'].map((d, i) => (
              <span key={i} style={{ color: i === 3 ? 'var(--color-gold)' : 'var(--color-text-secondary)', fontWeight: i === 3 ? 600 : 400 }}>{d}</span>
            ))}
          </div>
        </div>

        {/* Competitor Pressure Radar (5 cols) */}
        <div className="col-span-12 lg:col-span-5 clay-card rounded-2xl p-margin relative flex flex-col items-center justify-center">
          <h3 className="text-label-caps tracking-widest absolute top-margin left-margin" style={{ color: 'var(--color-text-primary)' }}>COMPETITOR PRESSURE ANALYSIS</h3>
          <div className="relative w-64 h-64 mt-12 bg-[var(--color-soft-ivory)] rounded-full shadow-inner flex items-center justify-center">
            {/* Radar Grid */}
            <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-text-primary)" strokeWidth="0.5" />
              <circle cx="50" cy="50" r="25" fill="none" stroke="var(--color-text-primary)" strokeWidth="0.5" />
              <circle cx="50" cy="50" r="10" fill="none" stroke="var(--color-text-primary)" strokeWidth="0.5" />
              <line x1="50" y1="10" x2="50" y2="90" stroke="var(--color-text-primary)" strokeWidth="0.5" />
              <line x1="15" y1="30" x2="85" y2="70" stroke="var(--color-text-primary)" strokeWidth="0.5" />
              <line x1="15" y1="70" x2="85" y2="30" stroke="var(--color-text-primary)" strokeWidth="0.5" />
            </svg>
            
            {/* Data Polygons - Visual approximation */}
            <svg className="w-full h-full relative z-10" viewBox="0 0 100 100">
              {/* Comp Set Avg */}
              <polygon points="50,25 75,40 65,65 50,70 25,60 30,35" fill="var(--color-analytics)" stroke="var(--color-text-primary)" strokeWidth="1" opacity="0.3" />
              {/* Kodai Int */}
              <polygon points={`50,${recommendation?.marketPosition === 'above-market' ? 10 : 20} 80,40 75,75 50,60 20,65 20,25`} fill="rgba(198,167,105,0.4)" stroke="var(--color-gold)" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-data-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>Rate Power</div>
            <div className="absolute top-1/4 -right-12 text-data-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>Amenities</div>
            <div className="absolute bottom-1/4 -right-10 text-data-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>Location</div>
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-data-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>Brand Equity</div>
            <div className="absolute bottom-1/4 -left-12 text-data-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>Guest Score</div>
            <div className="absolute top-1/4 -left-12 text-data-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>Inventory</div>
          </div>
          <div className="mt-12 flex gap-6">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[var(--color-gold)] shadow-sm" /><span className="text-data-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>Kodai Int.</span></div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-[var(--color-analytics)] opacity-40 shadow-sm" /><span className="text-data-mono" style={{ color: 'var(--color-text-secondary)' }}>Comp Set Avg</span></div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
