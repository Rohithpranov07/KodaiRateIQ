'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { FacilityLevel } from '@/lib/facility-data';

// ── Types ──────────────────────────────────────────────────
interface HotelMeta {
  slug: string;
  name: string;
  luxuryTier: string | null;
  facilityScore: string | null;
  starRating: number;
  isTarget: boolean;
}

interface HotelEntry {
  available: boolean;
  level: FacilityLevel;
  quality: number;
  luxuryScore: number;
}

interface BenchmarkRow {
  normalizedKey: string;
  displayName: string;
  category: string;
  icon: string;
  hotels: Record<string, HotelEntry>;
}

interface BenchmarkData {
  rows: BenchmarkRow[];
  hotels: HotelMeta[];
  totalFacilities: number;
  lastVerified: string;
  verificationSource: string;
}

// ── Level Pill ─────────────────────────────────────────────
const LEVEL_CONFIG: Record<FacilityLevel, { label: string; color: string; bg: string; border: string; dot: string }> = {
  Luxury:   { label: 'Luxury',   color: '#8A6A3B', bg: 'rgba(201,169,110,0.13)', border: 'rgba(201,169,110,0.35)', dot: '#C9A96E' },
  Premium:  { label: 'Premium',  color: '#3B5280', bg: 'rgba(59,82,128,0.10)',   border: 'rgba(59,82,128,0.25)',   dot: '#5B7ABA' },
  Standard: { label: 'Standard', color: '#1A7A55', bg: 'rgba(26,122,85,0.10)',   border: 'rgba(26,122,85,0.22)',   dot: '#1A7A55' },
  Basic:    { label: 'Basic',    color: '#6B6560', bg: 'rgba(107,101,96,0.08)',  border: 'rgba(107,101,96,0.20)',  dot: '#9B9590' },
  None:     { label: '—',        color: 'rgba(17,17,17,0.2)', bg: 'transparent', border: 'transparent',           dot: 'transparent' },
};

function LevelPill({ level, compact = false }: { level: FacilityLevel; compact?: boolean }) {
  const cfg = LEVEL_CONFIG[level];
  if (level === 'None') {
    return <span className="text-[11px]" style={{ color: 'rgba(17,17,17,0.2)' }}>—</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider"
      style={{
        fontSize: compact ? 8 : 9,
        padding: compact ? '2px 7px' : '3px 9px',
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

// ── Short hotel label ──────────────────────────────────────
const SHORT_NAMES: Record<string, string> = {
  'hotel-kodai-international': 'HKI',
  'the-carlton':               'Carlton',
  'the-tamara-kodai':          'Tamara',
  'sterling-kodai-lake':       'Sterling',
  'le-poshe-by-sparsa':        'Le Poshe',
};

// ── Score bar ─────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(17,17,17,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score * 10}%`, background: score >= 9 ? 'var(--color-gold)' : score >= 7.5 ? '#5B7ABA' : '#9B9590' }}
        />
      </div>
      <span className="text-[9px] font-bold tabular-nums" style={{ color: 'var(--color-warm-slate)' }}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function FacilitiesPage() {
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<FacilityLevel | 'All'>('All');

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch('/api/facilities');
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        if (json.success && json.data) {
          setBenchmarkData(json.data);
          const firstCat = json.data.rows[0]?.category ?? null;
          setActiveCategory(firstCat);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, []);

  // Ordered hotel slugs: target first, then by star rating
  const orderedHotels = useMemo(() => {
    if (!benchmarkData) return [];
    return [...benchmarkData.hotels].sort((a, b) => {
      if (a.isTarget !== b.isTarget) return a.isTarget ? -1 : 1;
      return b.starRating - a.starRating;
    });
  }, [benchmarkData]);

  // Grouped rows by category
  const grouped = useMemo(() => {
    if (!benchmarkData) return {};
    const q = searchQuery.toLowerCase();
    const filtered = benchmarkData.rows.filter(r => {
      const matchSearch = !q || r.displayName.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (filterLevel === 'All') return true;
      // Show row if any hotel has this level
      return Object.values(r.hotels).some(h => h.level === filterLevel);
    });
    return filtered.reduce((acc, row) => {
      if (!acc[row.category]) acc[row.category] = [];
      acc[row.category].push(row);
      return acc;
    }, {} as Record<string, BenchmarkRow[]>);
  }, [benchmarkData, searchQuery, filterLevel]);

  const categories = Object.keys(grouped).sort();

  // ── Hotel header score cards ───────────────────────────
  const getHotelFacilitySummary = (slug: string) => {
    if (!benchmarkData) return { total: 0, luxury: 0, premium: 0, avg: 0 };
    const relevant = benchmarkData.rows.filter(r => r.hotels[slug]?.available);
    const luxury   = relevant.filter(r => r.hotels[slug]?.level === 'Luxury').length;
    const premium  = relevant.filter(r => r.hotels[slug]?.level === 'Premium').length;
    const scores   = relevant.map(r => r.hotels[slug]?.luxuryScore ?? 0).filter(s => s > 0);
    const avg      = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { total: relevant.length, luxury, premium, avg };
  };

  return (
    <DashboardLayout>

      {/* ── Header ── */}
      <section className="mb-8">
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="section-eyebrow">
          <span className="text-[9px] font-bold tracking-[0.22em] uppercase" style={{ color: 'var(--color-gold)' }}>
            OTA-Verified Intelligence
          </span>
        </motion.div>
        <h1 className="text-display-luxury -mt-1 mb-2">Facility Benchmark</h1>
        <p className="text-base font-light leading-relaxed max-w-2xl" style={{ color: 'var(--color-warm-slate)' }}>
          Enterprise-grade amenity comparison across tracked Kodaikanal properties.
          Verified from OTA and official listings · {benchmarkData?.totalFacilities ?? '—'} unique facilities tracked.
        </p>
      </section>

      {/* ── Hotel Score Cards ── */}
      {!loading && benchmarkData && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {orderedHotels.map((hotel, i) => {
            const summary = getHotelFacilitySummary(hotel.slug);
            return (
              <motion.div
                key={hotel.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="clay-card p-5"
                style={hotel.isTarget ? { border: '1.5px solid rgba(201,169,110,0.4)' } : {}}
              >
                {hotel.isTarget && (
                  <span className="badge-gold mb-2 inline-block">Our Property</span>
                )}
                <p className="text-[11px] font-bold tracking-tight mb-0.5" style={{ color: hotel.isTarget ? 'var(--color-deep-bronze)' : 'var(--color-luxury-black)' }}>
                  {SHORT_NAMES[hotel.slug] ?? hotel.name}
                </p>
                <p className="text-[8px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-warm-slate)', opacity: 0.6 }}>
                  {hotel.luxuryTier}
                </p>
                <ScoreBar score={
                  HOTEL_FACILITY_PROFILES_SCORE[hotel.slug] ?? summary.avg
                } />
                <div className="flex gap-2 mt-3">
                  {summary.luxury > 0 && <LevelPill level="Luxury" compact />}
                  {summary.premium > 0 && summary.luxury === 0 && <LevelPill level="Premium" compact />}
                </div>
                <p className="text-[8px] mt-2" style={{ color: 'var(--color-warm-slate)', opacity: 0.55 }}>
                  {summary.total} amenities
                </p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Controls ── */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px]"
            style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>search</span>
          <input
            type="text"
            placeholder="Search facilities..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[12px] outline-none"
            style={{
              background: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(17,17,17,0.09)',
              color: 'var(--color-luxury-black)',
            }}
          />
        </div>

        {/* Level filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {(['All', 'Luxury', 'Premium', 'Standard', 'Basic'] as const).map(level => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className="shrink-0 px-3.5 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all"
              style={{
                background: filterLevel === level
                  ? (level === 'All' ? 'var(--color-luxury-black)' : LEVEL_CONFIG[level as FacilityLevel]?.bg ?? 'var(--color-luxury-black)')
                  : 'rgba(255,255,255,0.5)',
                color: filterLevel === level
                  ? (level === 'All' ? '#fff' : LEVEL_CONFIG[level as FacilityLevel]?.color ?? '#fff')
                  : 'var(--color-warm-slate)',
                border: `1px solid ${filterLevel === level
                  ? (level === 'All' ? 'transparent' : LEVEL_CONFIG[level as FacilityLevel]?.border ?? 'transparent')
                  : 'rgba(17,17,17,0.08)'}`,
              }}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Verification badge */}
        <div className="hidden md:flex items-center gap-2 ml-auto shrink-0 px-3.5 py-2 rounded-xl"
          style={{ background: 'rgba(26,122,85,0.08)', border: '1px solid rgba(26,122,85,0.18)' }}>
          <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-positive)' }}>verified</span>
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-positive)' }}>
            OTA Verified · May 2026
          </span>
        </div>
      </div>

      {/* ── Mobile Category Tabs ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide md:hidden mb-5">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="shrink-0 px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap"
            style={{
              background: activeCategory === cat ? 'var(--color-luxury-black)' : 'rgba(255,255,255,0.55)',
              color: activeCategory === cat ? '#fff' : 'var(--color-warm-slate)',
              border: `1px solid ${activeCategory === cat ? 'transparent' : 'rgba(17,17,17,0.08)'}`,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── DESKTOP TABLE ── */}
      {loading ? (
        <div className="clay-card p-10 flex flex-col gap-4">
          {Array(8).fill(0).map((_, i) => <div key={i} className="h-8 shimmer rounded-xl bg-black/5" />)}
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block clay-card overflow-hidden mb-10">
            <div
              className="overflow-x-auto"
              style={{ scrollbarWidth: 'thin' }}
            >
              <table className="w-full" style={{ minWidth: 900 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(17,17,17,0.06)', background: 'rgba(255,255,255,0.4)' }}>
                    <th className="py-5 pl-7 pr-4 text-left" style={{ width: 260 }}>
                      <span className="text-label-luxury">Facility</span>
                    </th>
                    {orderedHotels.map((hotel, i) => (
                      <th key={hotel.slug} className="py-5 px-4 text-center" style={{ minWidth: 120 }}>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[11px] font-bold tracking-tight"
                            style={{ color: hotel.isTarget ? 'var(--color-deep-bronze)' : 'var(--color-luxury-black)' }}>
                            {SHORT_NAMES[hotel.slug]}
                          </span>
                          <span className="text-[8px] font-semibold uppercase tracking-widest"
                            style={{ color: 'var(--color-warm-slate)', opacity: 0.55 }}>
                            {hotel.isTarget ? 'OUR HOTEL' : `${hotel.starRating}★`}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map(category => (
                    <>
                      {/* Category row */}
                      <tr key={`cat-${category}`} style={{ background: 'rgba(17,17,17,0.025)' }}>
                        <td
                          colSpan={orderedHotels.length + 1}
                          className="py-2.5 pl-7"
                          style={{ borderBottom: '1px solid rgba(17,17,17,0.06)', borderTop: '1px solid rgba(17,17,17,0.06)' }}
                        >
                          <span className="text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--color-warm-slate)', opacity: 0.6 }}>
                            {category}
                          </span>
                        </td>
                      </tr>

                      {/* Facility rows */}
                      {grouped[category]?.map((row, rIdx) => (
                        <tr
                          key={row.normalizedKey}
                          className="group transition-colors"
                          style={{ borderBottom: '1px solid rgba(17,17,17,0.04)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.55)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td className="py-3.5 pl-7 pr-4">
                            <div className="flex items-center gap-2.5">
                              <span className="material-symbols-outlined text-[16px] shrink-0"
                                style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>{row.icon}</span>
                              <span className="text-[12px] font-medium" style={{ color: 'var(--color-luxury-black)' }}>
                                {row.displayName}
                              </span>
                            </div>
                          </td>
                          {orderedHotels.map(hotel => {
                            const entry = row.hotels[hotel.slug];
                            return (
                              <td key={hotel.slug} className="py-3.5 px-4 text-center">
                                <LevelPill level={entry?.available ? (entry.level ?? 'Standard') : 'None'} />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="px-7 py-4 flex items-center justify-between"
              style={{ borderTop: '1px solid rgba(17,17,17,0.06)', background: 'rgba(255,255,255,0.3)' }}>
              <div className="flex items-center gap-6">
                {(['Luxury', 'Premium', 'Standard', 'Basic'] as FacilityLevel[]).map(level => (
                  <div key={level} className="flex items-center gap-1.5">
                    <LevelPill level={level} compact />
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px]" style={{ color: 'rgba(17,17,17,0.25)' }}>—</span>
                  <span className="text-[9px] font-semibold" style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>Not Available</span>
                </div>
              </div>
              <span className="text-[9px]" style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>
                {benchmarkData?.totalFacilities ?? 0} facilities · OTA Verified May 2026
              </span>
            </div>
          </div>

          {/* ── MOBILE CARD VIEW ── */}
          <div className="md:hidden flex flex-col gap-4 mb-10">
            {activeCategory && grouped[activeCategory]?.map((row, idx) => (
              <motion.div
                key={row.normalizedKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="clay-card p-5"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.15)' }}>
                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-gold)' }}>{row.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold tracking-tight" style={{ color: 'var(--color-luxury-black)' }}>
                      {row.displayName}
                    </h3>
                    <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-warm-slate)', opacity: 0.55 }}>
                      {activeCategory}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {orderedHotels.map(hotel => {
                    const entry = row.hotels[hotel.slug];
                    const level = entry?.available ? (entry.level ?? 'Standard') : 'None';
                    return (
                      <div key={hotel.slug} className="flex justify-between items-center py-2 px-3 rounded-xl"
                        style={{
                          background: hotel.isTarget ? 'rgba(201,169,110,0.06)' : 'rgba(17,17,17,0.025)',
                          border: hotel.isTarget ? '1px solid rgba(201,169,110,0.18)' : '1px solid transparent',
                        }}>
                        <span className="text-[11px] font-semibold"
                          style={{ color: hotel.isTarget ? 'var(--color-deep-bronze)' : 'var(--color-warm-slate)' }}>
                          {SHORT_NAMES[hotel.slug]}
                        </span>
                        <LevelPill level={level} compact />
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* ── Strategic Intelligence Summary ── */}
      {!loading && benchmarkData && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              type: 'advantage',
              icon: 'trending_up',
              label: 'Carlton Advantage',
              title: 'Golf + Jacuzzi Exclusivity',
              desc: 'The Carlton is the only tracked property with a full golf course and common Jacuzzi — a unique luxury positioning lever unavailable to direct competitors.',
            },
            {
              type: 'wellness',
              icon: 'self_improvement',
              label: 'Tamara Wellness Lead',
              title: 'Meditation + Yoga Depth',
              desc: 'Tamara leads on wellness infrastructure with a dedicated Meditation Room, Yoga studio, and in-room Jacuzzi — driving ADR premium over all peers.',
            },
            {
              type: 'action',
              icon: 'lightbulb',
              label: 'HKI Strategic Gap',
              title: 'Swimming Pool & Wellness',
              desc: 'Hotel Kodai International lacks a swimming pool and yoga facilities — areas where Sterling and Tamara clearly outperform. Addresses a key RevPAR ceiling.',
            },
          ].map((card, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + idx * 0.08 }}
              className="clay-card p-7 flex flex-col gap-5"
              style={{
                borderTop: `3px solid ${card.type === 'advantage' ? 'var(--color-positive)' : card.type === 'wellness' ? 'var(--color-gold)' : 'var(--color-royal-gold)'}`,
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: card.type === 'advantage' ? 'rgba(26,122,85,0.1)' : 'rgba(201,169,110,0.1)',
                  border: `1px solid ${card.type === 'advantage' ? 'rgba(26,122,85,0.2)' : 'rgba(201,169,110,0.2)'}`,
                }}>
                <span className="material-symbols-outlined text-[20px]"
                  style={{ color: card.type === 'advantage' ? 'var(--color-positive)' : 'var(--color-gold)' }}>
                  {card.icon}
                </span>
              </div>
              <div>
                <p className="text-label-luxury mb-1.5">{card.label}</p>
                <p className="text-[17px] font-semibold tracking-tight" style={{ color: 'var(--color-luxury-black)' }}>
                  {card.title}
                </p>
              </div>
              <p className="text-sm font-light leading-relaxed mt-auto" style={{ color: 'var(--color-warm-slate)' }}>
                {card.desc}
              </p>
            </motion.div>
          ))}
        </section>
      )}
    </DashboardLayout>
  );
}

// ── Overall score lookup (from facility-data.ts, duplicated for client-side use) ──
const HOTEL_FACILITY_PROFILES_SCORE: Record<string, number> = {
  'the-carlton':               9.2,
  'the-tamara-kodai':          9.5,
  'sterling-kodai-lake':       7.8,
  'hotel-kodai-international': 6.5,
  'le-poshe-by-sparsa':        7.2,
};
