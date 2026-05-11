'use client';

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
    <nav className="hidden md:flex fixed left-0 top-0 h-full w-[280px] flex-col py-margin gap-phi-lg z-40 bg-[var(--color-champagne)] border-r border-[var(--color-border)] shadow-[8px_0_24px_rgba(17,17,17,0.04)]">
      {/* Brand Header */}
      <div className="px-margin mb-phi-xl">
        <div className="flex items-center gap-phi-sm mb-phi-sm">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center clay-inset">
            <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--color-gold)' }}>diamond</span>
          </div>
          <div>
            <h1 className="text-headline-mobile tracking-tight" style={{ color: 'var(--color-text-primary)', fontWeight: 300, fontSize: '22px', lineHeight: '28px' }}>
              KodaiRate<span style={{ fontWeight: 500 }}>IQ</span>
            </h1>
            <span className="text-label-caps" style={{ color: 'var(--color-text-secondary)', opacity: 0.8, fontSize: '10px' }}>
              Hospitality Intelligence
            </span>
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <ul className="flex-1 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex items-center gap-phi-md px-margin py-phi-sm transition-all duration-300"
                style={{
                  color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontWeight: active ? 500 : 400,
                  opacity: active ? 1 : 0.8,
                  background: active ? 'rgba(255,255,255,0.4)' : 'transparent',
                  borderRight: active ? '2px solid var(--color-gold)' : '2px solid transparent',
                  boxShadow: active ? 'inset 2px 2px 4px rgba(255,255,255,0.8)' : 'none',
                }}
              >
                <span
                  className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform duration-300"
                  style={active ? { color: 'var(--color-gold)', fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {item.icon}
                </span>
                <span className="text-label-caps tracking-widest">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Settings at Bottom */}
      <div className="mt-auto mb-margin">
        <Link
          href="/settings"
          className="group flex items-center gap-phi-md px-margin py-phi-sm transition-all duration-300"
          style={{
            color: pathname === '/settings' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontWeight: pathname === '/settings' ? 500 : 400,
            background: pathname === '/settings' ? 'rgba(255,255,255,0.4)' : 'transparent',
            borderRight: pathname === '/settings' ? '2px solid var(--color-gold)' : '2px solid transparent',
            boxShadow: pathname === '/settings' ? 'inset 2px 2px 4px rgba(255,255,255,0.8)' : 'none',
          }}
        >
          <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform duration-300" style={pathname === '/settings' ? { color: 'var(--color-gold)' } : {}}>settings</span>
          <span className="text-label-caps tracking-widest">Settings</span>
        </Link>
      </div>
    </nav>
  );
}
