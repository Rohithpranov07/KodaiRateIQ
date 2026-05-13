'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface HotelCard {
  slug: string;
  hotelName: string;
  starRating: number;
  isTarget: boolean;
  currentMapRate: number | null;
  availability: string;
  category: string;
  luxuryTier: string | null;
  facilityScore: string | null;
  role: string;
}

export default function HotelsListingPage() {
  const [hotels, setHotels] = useState<HotelCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const res = await fetch('/api/rates/live');
        const data = await res.json();
        if (data.success && data.data?.rates) {
          setHotels(data.data.rates);
        }
      } catch (err) {
        console.error('Failed to fetch hotels:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHotels();
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-12">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3 mb-4"
        >
          <span className="w-12 h-[1px] bg-gold opacity-50"></span>
          <span className="text-[10px] font-bold tracking-[0.3em] text-gold uppercase">Market Intelligence</span>
        </motion.div>
        <h1 className="text-display-luxury mb-2">Tracked Properties</h1>
        <p className="text-lg text-warm-slate font-light">Complete roster of monitored hotels and market anchors.</p>
      </div>

      <div className="flex flex-col gap-8 max-w-4xl">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="clay-card h-64 shimmer rounded-[32px]" />
          ))
        ) : hotels.length === 0 ? (
          <div className="clay-card p-12 text-center text-warm-slate font-light italic rounded-[32px]">
            No properties found in the current market registry.
          </div>
        ) : (
          hotels.map((hotel, idx) => (
            <motion.div
              key={hotel.slug}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link href={`/hotels/${hotel.slug}`} className="block group">
                <div className="clay-card p-8 md:p-10 rounded-[32px] relative overflow-hidden transition-all duration-500 group-hover:shadow-[0_40px_80px_-20px_rgba(17,17,17,0.1)] border-l-4" style={{ borderLeftColor: hotel.isTarget ? 'var(--color-gold)' : 'transparent' }}>
                  
                  {/* Card Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-10">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                         <span className={`px-3 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase ${
                           hotel.isTarget ? 'bg-gold/10 text-gold' : 'bg-warm-slate/10 text-warm-slate'
                         }`}>
                           {hotel.isTarget ? 'Target Property' : 'Market Competitor'}
                         </span>
                         <div className="flex gap-0.5">
                            {Array.from({ length: hotel.starRating || 0 }).map((_, i) => (
                              <span key={i} className="material-symbols-outlined text-[12px] text-gold filled-icon">star</span>
                            ))}
                         </div>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-medium tracking-tight text-luxury-black mb-1 group-hover:text-gold transition-colors">{hotel.hotelName}</h3>
                      <p className="text-xs text-warm-slate tracking-widest uppercase font-medium">{hotel.luxuryTier || hotel.category}</p>
                    </div>

                    <div className="flex items-center gap-4">
                       <div className="clay-inset px-6 py-4 rounded-2xl text-right min-w-[140px]">
                          <span className="text-[9px] text-warm-slate block mb-1 uppercase tracking-widest font-bold">Base MAP</span>
                          <span className="text-xl font-bold text-luxury-black">₹{hotel.currentMapRate?.toLocaleString() ?? '--'}</span>
                       </div>
                    </div>
                  </div>

                  {/* Card Body — Key Intelligence */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-black/5">
                    <div className="flex flex-col">
                       <span className="text-[10px] text-warm-slate uppercase tracking-widest mb-1">Status</span>
                       <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${hotel.availability === 'available' ? 'bg-positive' : 'bg-negative animate-pulse'}`}></span>
                          <span className="text-sm font-medium capitalize">{hotel.availability.replace('-', ' ')}</span>
                       </div>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[10px] text-warm-slate uppercase tracking-widest mb-1">Market Role</span>
                       <span className="text-sm font-medium">{hotel.role.replace(/-/g, ' ')}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[10px] text-warm-slate uppercase tracking-widest mb-1">Intelligence</span>
                       <span className="text-sm font-medium">8.4 / 10 Score</span>
                    </div>
                    <div className="flex flex-col items-end md:items-start">
                       <span className="text-[10px] text-warm-slate uppercase tracking-widest mb-1">Action</span>
                       <div className="flex items-center gap-1 text-gold text-sm font-bold group-hover:gap-2 transition-all">
                          View Brief <span className="material-symbols-outlined text-sm">arrow_forward</span>
                       </div>
                    </div>
                  </div>

                  {/* Decorative Subtle Icon */}
                  <div className="absolute -right-8 -top-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                     <span className="material-symbols-outlined text-[160px]">hotel</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
