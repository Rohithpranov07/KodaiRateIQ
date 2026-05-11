'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect } from 'react';

interface FacilityRow {
  facility: string;
  category: string;
  hotels: Record<string, { available: boolean; quality: number }>;
}

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const res = await fetch('/api/facilities');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        if (data.success && data.data) {
          setFacilities(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFacilities();
  }, []);

  // Determine the set of hotels dynamically based on the first facility's hotel keys
  // Always put hotel-kodai-international first
  let hotelSlugs: string[] = [];
  if (facilities.length > 0) {
    const allSlugs = Object.keys(facilities[0].hotels);
    const targetSlug = 'hotel-kodai-international';
    hotelSlugs = [
      targetSlug,
      ...allSlugs.filter(slug => slug !== targetSlug)
    ];
  }

  const formatSlugName = (slug: string) => {
    if (slug === 'hotel-kodai-international') return 'Kodai Int.';
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getQualityDots = (quality: number, available: boolean) => {
    if (!available) return [0,0,0,0,0];
    const dots = [0,0,0,0,0];
    for (let i = 0; i < 5; i++) {
      if (i < quality) dots[i] = 1;
    }
    return dots;
  };

  const getFacilityIcon = (facility: string) => {
    const f = facility.toLowerCase();
    const map: Record<string, string> = {
      'spa': 'spa',
      'pool': 'pool',
      'gym': 'fitness_center',
      'restaurant': 'restaurant',
      'bar': 'local_bar',
      'lake-view': 'water',
      'wifi': 'wifi',
      'parking': 'local_parking',
      'bonfire': 'local_fire_department',
      'indoor-games': 'sports_esports',
      'golf-course': 'golf_course',
      'business-centre': 'business_center',
      'conference-room': 'meeting_room',
      'laundry': 'local_laundry_service',
      'room-service': 'room_service',
      'travel-desk': 'travel_explore',
    };
    return map[f] || 'star';
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-phi-sm mb-phi-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-[2px] w-8 bg-[var(--color-gold)]"></div>
          <span className="text-label-caps" style={{ color: 'var(--color-gold)', letterSpacing: '0.2em' }}>Competitive Analysis</span>
        </div>
        <h1 className="text-display-hero leading-none tracking-tight max-w-4xl" style={{ color: 'var(--color-text-primary)' }}>
          Facility Benchmark
        </h1>
        <p className="text-body-md max-w-2xl mt-4 text-[var(--color-text-secondary)]">
          An executive-grade comparison of ultra-luxury amenities against regional tier-1 and tier-2 competitors. Baseline set to HKI standards.
        </p>
      </div>

      <section className="w-full relative mb-margin">
        <div className="clay-card rounded-2xl overflow-hidden relative">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading facility benchmark data...</div>
            ) : hotelSlugs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No facility data available.</div>
            ) : (
              <div className="min-w-[900px] w-full" style={{ display: 'grid', gridTemplateColumns: `240px minmax(180px,1fr) repeat(${hotelSlugs.length - 1}, minmax(160px,1fr))` }}>
                
                {/* Header Row */}
                <div className="col-span-full grid grid-cols-subgrid items-end pb-phi-sm pt-phi-lg border-b border-[var(--color-border)] bg-[var(--color-soft-ivory)]">
                  <div className="px-phi-lg text-label-caps tracking-widest text-[var(--color-text-secondary)]">Metrics Focus</div>
                  {hotelSlugs.map((slug, i) => (
                    <div key={slug} className={`px-phi-md py-2 flex flex-col gap-1 ${i === 0 ? 'relative clay-inset rounded-t-xl border-b-0 mx-1' : ''}`}>
                      <span className={`text-label-caps tracking-widest ${i === 0 ? 'flex items-center gap-2' : ''}`} style={{ color: i === 0 ? 'var(--color-gold)' : 'var(--color-text-primary)' }}>
                        {i === 0 && <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>}
                        {i === 0 ? 'HKI' : formatSlugName(slug)}
                      </span>
                      <span className="text-data-mono text-[10px]" style={{ color: i === 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                        {i === 0 ? 'Baseline Standard' : 'Competitor'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Data Rows */}
                {facilities.map((fac, rowIdx) => (
                  <div key={fac.facility} className="col-span-full grid grid-cols-subgrid items-stretch transition-colors hover:bg-black/5 group border-b border-[var(--color-border)]">
                    <div className="px-phi-lg py-phi-md flex items-center gap-3 border-r border-[var(--color-border)]">
                      <span className="material-symbols-outlined font-light text-[var(--color-gold)]">{getFacilityIcon(fac.facility)}</span>
                      <span className="text-body-md text-[var(--color-text-primary)]">{fac.facility}</span>
                    </div>
                    
                    {hotelSlugs.map((slug, i) => {
                      const hotelData = fac.hotels[slug];
                      const available = hotelData?.available ?? false;
                      const quality = hotelData?.quality ?? 0;
                      const dots = getQualityDots(quality, available);

                      return (
                        <div key={slug} className={`px-phi-md py-phi-md flex flex-col justify-center gap-2 ${i === 0 ? 'relative clay-inset rounded-none mx-1' : 'border-r border-[var(--color-border)]'}`}>
                          <span className={`text-data-mono ${i === 0 ? 'font-medium' : ''}`} style={{ color: available ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                            {available ? (quality >= 4 ? 'Premium' : quality >= 2 ? 'Standard' : 'Basic') : 'None'}
                          </span>
                          <div className="flex gap-1">
                            {dots.map((v, dotIdx) => (
                              <div key={dotIdx} className={`w-2 h-2 rounded-full ${v ? (i === 0 ? 'bg-[var(--color-gold)] shadow-sm' : 'bg-[var(--color-text-secondary)]') : 'bg-[var(--color-border)]'}`} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Executive Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-margin w-full">
        {/* Card 1 */}
        <div className="clay-card rounded-2xl p-phi-lg flex flex-col gap-phi-md hover:scale-[1.02] transition-transform duration-500 group border-t-4 border-t-[var(--color-positive)]">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-[rgba(45,106,79,0.1)] text-[var(--color-positive)] clay-inset">
            <span className="material-symbols-outlined">trending_up</span>
          </div>
          <div>
            <h3 className="text-label-caps tracking-widest uppercase mb-2 text-[var(--color-text-secondary)]">Market Dominance</h3>
            <p className="text-metric-xl text-[var(--color-text-primary)]">Premium Dining</p>
          </div>
          <p className="text-body-md mt-auto text-[var(--color-text-secondary)]">
            HKI remains the undisputed regional leader with exclusive premium culinary offerings, maintaining advantage over peers.
          </p>
        </div>

        {/* Card 2 */}
        <div className="clay-card rounded-2xl p-phi-lg flex flex-col gap-phi-md hover:scale-[1.02] transition-transform duration-500 group border-t-4 border-t-[var(--color-warning)]">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-[rgba(168,121,69,0.1)] text-[var(--color-warning)] clay-inset">
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div>
            <h3 className="text-label-caps tracking-widest uppercase mb-2 text-[var(--color-text-secondary)]">Key Vulnerability</h3>
            <p className="text-metric-xl text-[var(--color-text-primary)]">Lake Views</p>
          </div>
          <p className="text-body-md mt-auto text-[var(--color-text-secondary)]">
            Competitors match HKI's lakefront advantage. Monitor marketing positioning closely to ensure our unique selling propositions stand out.
          </p>
        </div>

        {/* Card 3 */}
        <div className="clay-card rounded-2xl p-phi-lg flex flex-col gap-phi-md transition-transform duration-500 group hover:scale-[1.02] border-t-4 border-t-[var(--color-gold)]">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-[rgba(198,167,105,0.1)] text-[var(--color-gold)] clay-inset">
            <span className="material-symbols-outlined">lightbulb</span>
          </div>
          <div>
            <h3 className="text-label-caps tracking-widest uppercase mb-2 text-[var(--color-text-secondary)]">Strategic Action</h3>
            <p className="text-metric-xl text-[var(--color-text-primary)]">Spa Enhancements</p>
          </div>
          <p className="text-body-md mt-auto text-[var(--color-text-secondary)]">
            Competitors are rapidly closing the gap in wellness offerings. Recommend accelerating planned phase 2 spa expansions to maintain Elite status.
          </p>
        </div>
      </section>
    </DashboardLayout>
  );
}
