'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { icon: 'dashboard', label: 'Dashboard', href: '/' },
  { icon: 'trending_up', label: 'Live Rates', href: '/rates' },
  { icon: 'auto_awesome', label: 'AI Recommendations', href: '/recommendations' },
  { icon: 'groups', label: 'Competitors', href: '/competitors' },
  { icon: 'analytics', label: 'Analytics', href: '/analytics' },
  { icon: 'apartment', label: 'Hotels', href: '/hotels' },
  { icon: 'view_timeline', label: 'Facilities', href: '/facilities' },
  { icon: 'lightbulb', label: 'Insights', href: '/insights' },
];

export default function SideNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="hidden md:flex fixed left-0 top-0 h-full w-[272px] flex-col z-40"
      style={{
        background: 'linear-gradient(180deg, #EDE4D3 0%, #E8DECE 100%)',
        borderRight: '1px solid rgba(17,17,17,0.08)',
        boxShadow: '4px 0 24px rgba(17,17,17,0.05)',
      }}
    >
      {/* Brand Header */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center gap-3.5">
          {/* Logo Container */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.6)',
              boxShadow: '0 2px 12px rgba(138,106,59,0.18), inset 0 1px 2px rgba(255,255,255,0.8)',
              border: '1px solid rgba(255,255,255,0.5)',
            }}
          >
            <Image
              src="/images.png"
              alt="Hotel Kodai International"
              width={36}
              height={36}
              className="object-contain"
              priority
            />
          </div>

          {/* Brand Text */}
          <div className="leading-none">
            <p className="text-[9px] uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--color-warm-slate)', opacity: 0.8 }}>
              Hotel Kodai International
            </p>
            <h1 style={{ color: 'var(--color-luxury-black)', fontWeight: 300, fontSize: '18px', letterSpacing: '-0.03em', lineHeight: 1 }}>
              KodaiRate<span style={{ fontWeight: 600 }}>IQ</span>
            </h1>
            <p className="text-[8px] uppercase tracking-[0.18em] mt-1" style={{ color: 'var(--color-warm-slate)', opacity: 0.65 }}>
              Intelligence Platform
            </p>
          </div>
        </div>

        {/* Gold accent line */}
        <div className="mt-5 h-px" style={{ background: 'linear-gradient(90deg, rgba(201,169,110,0.5), transparent)' }} />
      </div>

      {/* Nav Section Label */}
      <p className="px-6 mb-2 text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--color-warm-slate)', opacity: 0.5 }}>
        Navigation
      </p>

      {/* Nav Links */}
      <ul className="flex-1 flex flex-col px-3 gap-0.5 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200"
                style={{
                  background: active
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.75), rgba(255,255,255,0.45))'
                    : 'transparent',
                  boxShadow: active
                    ? '0 2px 12px rgba(138,106,59,0.1), inset 0 1px 2px rgba(255,255,255,0.8)'
                    : 'none',
                  border: active
                    ? '1px solid rgba(255,255,255,0.6)'
                    : '1px solid transparent',
                }}
              >
                {/* Icon */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200"
                  style={{
                    background: active
                      ? 'linear-gradient(135deg, #D4B070, var(--color-royal-gold))'
                      : 'transparent',
                    boxShadow: active ? '0 2px 8px rgba(138,106,59,0.3)' : 'none',
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[18px] transition-all duration-200"
                    style={{
                      color: active ? '#fff' : 'var(--color-warm-slate)',
                      fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                      opacity: active ? 1 : 0.75,
                    }}
                  >
                    {item.icon}
                  </span>
                </div>

                {/* Label */}
                <span
                  className="text-[13px] font-medium tracking-tight transition-colors duration-200"
                  style={{
                    color: active ? 'var(--color-luxury-black)' : 'var(--color-warm-slate)',
                    opacity: active ? 1 : 0.8,
                  }}
                >
                  {item.label}
                </span>

                {/* Active chevron */}
                {active && (
                  <span
                    className="ml-auto material-symbols-outlined text-[14px]"
                    style={{ color: 'var(--color-gold)', opacity: 0.6 }}
                  >
                    chevron_right
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Divider */}
      <div className="mx-6 my-3 h-px" style={{ background: 'rgba(17,17,17,0.07)' }} />

      {/* Settings Link */}
      <div className="px-3 mb-4">
        <Link
          href="/settings"
          className="group flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200"
          style={{
            background: pathname === '/settings'
              ? 'linear-gradient(135deg, rgba(255,255,255,0.75), rgba(255,255,255,0.45))'
              : 'transparent',
            boxShadow: pathname === '/settings'
              ? '0 2px 12px rgba(138,106,59,0.1), inset 0 1px 2px rgba(255,255,255,0.8)'
              : 'none',
            border: pathname === '/settings'
              ? '1px solid rgba(255,255,255,0.6)'
              : '1px solid transparent',
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: pathname === '/settings'
                ? 'linear-gradient(135deg, #D4B070, var(--color-royal-gold))'
                : 'transparent',
              boxShadow: pathname === '/settings' ? '0 2px 8px rgba(138,106,59,0.3)' : 'none',
            }}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{
                color: pathname === '/settings' ? '#fff' : 'var(--color-warm-slate)',
                fontVariationSettings: pathname === '/settings' ? "'FILL' 1" : "'FILL' 0",
                opacity: pathname === '/settings' ? 1 : 0.75,
              }}
            >
              settings
            </span>
          </div>
          <span
            className="text-[13px] font-medium tracking-tight"
            style={{ color: pathname === '/settings' ? 'var(--color-luxury-black)' : 'var(--color-warm-slate)', opacity: pathname === '/settings' ? 1 : 0.8 }}
          >
            Settings
          </span>
        </Link>
      </div>

      {/* System Status Footer */}
      <div className="mx-4 mb-6 px-4 py-3 rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.35)',
          border: '1px solid rgba(255,255,255,0.5)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="live-dot shrink-0" />
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ color: 'var(--color-positive)' }}>
            All Systems Online
          </span>
        </div>
        <p className="text-[9px] leading-snug" style={{ color: 'var(--color-warm-slate)', opacity: 0.65 }}>
          MiMo AI Engine · v4.2.0 · 99.9% uptime
        </p>
      </div>
    </nav>
  );
}
