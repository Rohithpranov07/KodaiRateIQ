'use client';

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#0a0a0f]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white/60">KodaiRateIQ</span>
          </div>
          <p className="text-xs text-[#5a5a6e]">
            Hotel Rate Intelligence Platform • Powered by MiMo AI • © {new Date().getFullYear()}
          </p>
          <div className="flex items-center gap-1 text-xs text-[#5a5a6e]">
            <span>Built for</span>
            <span className="text-indigo-400 font-medium">Hotel Kodai International</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
