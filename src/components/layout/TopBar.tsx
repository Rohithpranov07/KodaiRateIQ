'use client';

import { usePathname } from 'next/navigation';

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/': { title: 'Dashboard', sub: 'Executive Overview' },
  '/rates': { title: 'Live Rates', sub: 'Pricing Pulse Terminal' },
  '/recommendations': { title: 'AI Recommendations', sub: 'MAP Rate Optimization' },
  '/competitors': { title: 'Competitors', sub: 'Competitive Landscape' },
  '/analytics': { title: 'Analytics', sub: 'Market Intelligence' },
  '/hotels': { title: 'Hotels', sub: 'Property Registry' },
  '/facilities': { title: 'Facilities', sub: 'Amenity Comparison' },
  '/insights': { title: 'Insights', sub: 'Intelligence Feed' },
  '/settings': { title: 'Settings', sub: 'Platform Configuration' },
};

export default function TopBar() {
  const pathname = usePathname();
  const page = PAGE_TITLES[pathname] ?? { title: 'KodaiRateIQ', sub: 'Hospitality Intelligence' };

  const now = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <header
      className="fixed top-0 z-30 flex items-center justify-between px-6 md:px-8"
      style={{
        left: 0,
        right: 0,
        height: '68px',
        background: 'rgba(245, 241, 232, 0.88)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(17,17,17,0.07)',
        boxShadow: '0 1px 12px rgba(17,17,17,0.05)',
      }}
      // Offset for sidebar on md+
    >
      {/* ── Left: Mobile brand / Desktop page context ── */}
      <div className="flex items-center gap-3 md:ml-68">
        {/* Mobile-only logo */}
        <div className="md:hidden w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.5)' }}
        >
          <img src="/images.png" alt="Logo" className="w-6 h-6 object-contain" />
        </div>

        {/* Mobile brand name */}
        <span className="md:hidden text-lg font-light tracking-tight" style={{ color: 'var(--color-luxury-black)' }}>
          KodaiRate<strong style={{ fontWeight: 600 }}>IQ</strong>
        </span>

        {/* Desktop page title */}
        <div className="hidden md:flex flex-col justify-center">
          <h2 className="text-[15px] font-semibold tracking-tight leading-none mb-0.5" style={{ color: 'var(--color-luxury-black)' }}>
            {page.title}
          </h2>
          <p className="text-[10px] font-medium tracking-[0.1em] uppercase leading-none" style={{ color: 'var(--color-warm-slate)', opacity: 0.7 }}>
            {page.sub}
          </p>
        </div>
      </div>

      {/* ── Right: Actions ── */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Date pill — desktop only */}
        <div className="hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-full"
          style={{
            background: 'rgba(255,255,255,0.55)',
            border: '1px solid rgba(17,17,17,0.07)',
            boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8)',
          }}
        >
          <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-warm-slate)', opacity: 0.6 }}>calendar_today</span>
          <span className="text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: 'var(--color-warm-slate)' }}>
            {now}
          </span>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-full"
          style={{
            background: 'rgba(26,122,85,0.08)',
            border: '1px solid rgba(26,122,85,0.15)',
          }}
        >
          <div className="live-dot" style={{ width: 6, height: 6 }} />
          <span className="text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: 'var(--color-positive)' }}>Live</span>
        </div>

        {/* Separator */}
        <div className="w-px h-6 hidden md:block" style={{ background: 'rgba(17,17,17,0.08)' }} />

        {/* Notification */}
        <button
          className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:bg-black/5"
          style={{ color: 'var(--color-warm-slate)' }}
          aria-label="Notifications"
        >
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: 'var(--color-gold)', boxShadow: '0 0 0 2px rgba(245,241,232,0.9)' }}
          />
        </button>

        {/* Help */}
        <button
          className="w-9 h-9 rounded-xl items-center justify-center transition-all duration-200 hover:bg-black/5 hidden md:flex"
          style={{ color: 'var(--color-warm-slate)' }}
          aria-label="Help"
        >
          <span className="material-symbols-outlined text-[20px]">help_outline</span>
        </button>

        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, rgba(201,169,110,0.25), rgba(201,169,110,0.12))',
            border: '1.5px solid rgba(201,169,110,0.4)',
            boxShadow: '0 2px 8px rgba(138,106,59,0.15)',
          }}
        >
          <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-deep-bronze)' }}>person</span>
        </div>
      </div>
    </header>
  );
}
