'use client';

export default function TopBar() {
  return (
    <header
      className="fixed top-0 w-full z-50 flex justify-between items-center px-margin py-phi-sm"
      style={{
        left: '280px',
        width: 'calc(100% - 280px)',
        background: 'rgba(239, 232, 220, 0.8)', /* soft-ivory */
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Left: Brand Text */}
      <div className="flex items-center gap-phi-md">
        <span className="text-headline-lg tracking-tight" style={{ color: 'var(--color-text-primary)', fontWeight: 400, fontSize: '24px' }}>
          KodaiRateIQ
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-phi-lg">
        <div className="flex items-center gap-phi-sm">
          <button className="p-2 rounded-full transition-colors duration-300 group hover:bg-black/5"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span className="material-symbols-outlined text-[22px] group-hover:text-[var(--color-gold)] transition-colors">monitoring</span>
          </button>
          <button className="p-2 rounded-full transition-colors duration-300 group hover:bg-black/5"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span className="material-symbols-outlined text-[22px] group-hover:text-[var(--color-gold)] transition-colors">psychology</span>
          </button>
        </div>

        {/* Avatar */}
        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center clay-inset">
          <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-text-secondary)' }}>person</span>
        </div>
      </div>
    </header>
  );
}
