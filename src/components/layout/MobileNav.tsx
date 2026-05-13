'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const mainNavItems = [
  { icon: 'dashboard', label: 'Dashboard', href: '/' },
  { icon: 'trending_up', label: 'Rates', href: '/rates' },
  { icon: 'auto_awesome', label: 'AI', href: '/recommendations' },
  { icon: 'apartment', label: 'Hotels', href: '/hotels' },
  { icon: 'analytics', label: 'Analytics', href: '/analytics' },
];

const secondaryNavItems = [
  { icon: 'view_timeline', label: 'Facilities', href: '/facilities' },
  { icon: 'groups', label: 'Competitors', href: '/competitors' },
  { icon: 'lightbulb', label: 'Insights', href: '/insights' },
  { icon: 'settings', label: 'Settings', href: '/settings' },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Drawer Overlay */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-[60] bg-[#111111]/60 backdrop-blur-md md:hidden"
            />
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[80%] z-[70] bg-[#F5F1E8] shadow-2xl md:hidden flex flex-col p-8"
            >
              <div className="flex justify-between items-center mb-12">
                <div>
                  <h2 className="text-editorial-title font-light">Intelligence</h2>
                  <p className="text-label-luxury opacity-60">Executive Suite</p>
                </div>
                <button 
                  onClick={() => setDrawerOpen(false)}
                  className="w-12 h-12 rounded-full clay-inset flex items-center justify-center active:scale-90 transition-transform"
                >
                  <span className="material-symbols-outlined text-warm-slate">close</span>
                </button>
              </div>

              <div className="flex flex-col gap-4">
                {secondaryNavItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className="group flex items-center gap-6 p-4 rounded-2xl transition-all active:translate-x-2"
                      style={{
                        background: active ? 'rgba(200, 169, 107, 0.1)' : 'transparent',
                      }}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${active ? 'clay-panel' : 'clay-inset group-active:scale-95'}`}>
                        <span 
                          className="material-symbols-outlined text-[24px]"
                          style={{ 
                            color: active ? 'var(--color-gold)' : 'var(--color-warm-slate)',
                            fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0"
                          }}
                        >
                          {item.icon}
                        </span>
                      </div>
                      <div>
                        <p className={`text-lg font-medium tracking-tight ${active ? 'text-[#111111]' : 'text-[#5E5A55]'}`}>
                          {item.label}
                        </p>
                        {active && <p className="text-[10px] text-gold font-bold uppercase tracking-widest mt-0.5">Active Session</p>}
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-auto pt-8 border-t border-[rgba(17,17,17,0.08)]">
                <div className="clay-panel p-6 rounded-3xl">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-[#C8A96B]/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#C8A96B]">verified_user</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold tracking-tight">Executive Access</p>
                      <p className="text-[10px] text-[#5E5A55]">HKI Premium Tier</p>
                    </div>
                  </div>
                  <button className="w-full py-3 clay-button-gold text-xs uppercase tracking-widest">
                    Logout Terminal
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Glassmorphism Bottom Dock */}
      <nav className="fixed bottom-6 left-4 right-4 z-50 md:hidden pointer-events-none">
        <div className="glass-dock max-w-[440px] mx-auto rounded-[32px] p-2 flex justify-between items-center pointer-events-auto">
          {mainNavItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all active:scale-[0.85]"
              >
                {active && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute inset-0 bg-white/80 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(255,255,255,1)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span 
                  className="material-symbols-outlined text-[24px] z-10 transition-colors duration-300"
                  style={{ 
                    color: active ? 'var(--color-gold)' : 'var(--color-warm-slate)',
                    fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" 
                  }}
                >
                  {item.icon}
                </span>
                <span 
                  className="text-[8px] font-bold tracking-[0.05em] uppercase z-10 mt-0.5"
                  style={{ 
                    color: active ? '#111111' : '#5E5A55',
                    opacity: active ? 1 : 0.6 
                  }}
                >
                  {item.label === 'Dashboard' ? 'Home' : item.label.split(' ')[0]}
                </span>
              </Link>
            );
          })}

          <div className="w-[1px] h-8 bg-[rgba(17,17,17,0.08)]/20 mx-1" />

          <button 
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center w-12 h-14 rounded-2xl active:scale-[0.85] transition-transform"
          >
            <span className="material-symbols-outlined text-[26px] text-[#5E5A55]">
              more_horiz
            </span>
            <span className="text-[8px] font-bold tracking-[0.05em] uppercase text-[#5E5A55] opacity-60 mt-0.5">More</span>
          </button>
        </div>
        
        {/* Bottom Home Indicator Safe Area Padding */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  );
}

