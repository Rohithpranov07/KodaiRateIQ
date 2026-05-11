'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function HotelsListingPage() {
  const [hotels, setHotels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const res = await fetch('/api/rates/live');
        const data = await res.json();
        if (data.success && data.data) {
          setHotels(data.data.rates);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchHotels();
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-phi-xl">
        <h1 className="text-headline-lg" style={{ color: 'var(--color-text-primary)' }}>Tracked Properties</h1>
        <p className="text-body-md mt-1" style={{ color: 'var(--color-text-secondary)' }}>Complete roster of monitored hotels and market anchors.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {loading ? (
          <div className="col-span-full py-8 text-center text-gray-500">Loading properties...</div>
        ) : (
            hotels.map((hotel: any) => (
            <Link 
              key={hotel.slug} 
              href={`/hotels/${hotel.slug}`} 
              className="block group"
            >
              <div className="clay-card p-phi-lg rounded-2xl transition-all duration-300 group-hover:scale-[1.02] flex flex-col h-full border-t-4" style={{ borderTopColor: hotel.isTarget ? 'var(--color-gold)' : 'var(--color-analytics)' }}>
                <div className="flex justify-between items-start mb-4">
                  <span className="text-label-caps px-2 py-1 rounded clay-inset text-[10px]" style={{ color: hotel.isTarget ? 'var(--color-gold)' : 'var(--color-text-secondary)' }}>
                    {hotel.isTarget ? 'TARGET PROPERTY' : 'COMPETITOR'}
                  </span>
                  <div className="flex">
                    {Array.from({ length: hotel.starRating || 0 }).map((_, i) => (
                      <span key={i} className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-gold)', fontVariationSettings: "'FILL' 1" }}>star</span>
                    ))}
                  </div>
                </div>
                <h3 className="text-headline-mobile mb-2" style={{ color: 'var(--color-text-primary)' }}>{hotel.hotelName}</h3>
                
                <div className="mt-auto pt-4 border-t border-[var(--color-border)] grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-label-caps text-[var(--color-text-secondary)]">CURRENT MAP</span>
                    <div className="text-body-md font-medium" style={{ color: 'var(--color-text-primary)' }}>{hotel.currentMapRate ? `₹${hotel.currentMapRate.toLocaleString()}` : '--'}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-label-caps text-[var(--color-text-secondary)]">AVAILABILITY</span>
                    <div className="text-body-md font-medium" style={{ color: hotel.availability === 'sold-out' ? 'var(--color-negative)' : 'var(--color-positive)' }}>
                      {hotel.availability ? hotel.availability.toUpperCase() : '--'}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
