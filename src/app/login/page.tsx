'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden" style={{ background: 'var(--color-luxury-white)', color: 'var(--color-text-primary)' }}>
      {/* Left Side: Cinematic Brand Imagery */}
      <div className="relative hidden md:flex flex-col justify-end w-full md:w-[60%] lg:w-[65%] h-screen bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1544644181-1484b3fdfc62?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')`, // Mountain landscape
        }}
      >
        {/* Gradient Overlays */}
        <div className="absolute inset-0 z-0" style={{ background: 'linear-gradient(to right, rgba(248, 246, 241, 0.9), rgba(248, 246, 241, 0.4), transparent)' }} />
        <div className="absolute inset-0 z-0" style={{ background: 'linear-gradient(to top, rgba(248, 246, 241, 1), rgba(248, 246, 241, 0.2), transparent)' }} />
        <div className="absolute inset-0 z-0" style={{ background: 'rgba(198, 167, 105, 0.1)', mixBlendMode: 'multiply' }} />

        {/* Brand Statement */}
        <div className="relative z-10 p-phi-xxl max-w-4xl">
          <h1 className="text-display-hero drop-shadow-sm opacity-90" style={{ color: 'var(--color-text-primary)' }}>
            KodaiRateIQ
          </h1>
          <p className="text-headline-lg tracking-wide max-w-2xl leading-tight" style={{ color: 'var(--color-text-secondary)', fontWeight: 300 }}>
            Whispered luxury.<br />
            <span style={{ color: 'var(--color-gold)', opacity: 1, fontWeight: 400 }}>Absolute precision.</span>
          </p>

          {/* AI Status Indicator */}
          <div className="mt-phi-xxl inline-flex items-center gap-2 px-4 py-2 rounded-xl clay-card">
            <span className="w-2 h-2 rounded-full bg-[var(--color-positive)]" />
            <span className="text-label-caps" style={{ color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>System Online</span>
            <span className="text-data-mono ml-2" style={{ color: 'var(--color-text-secondary)' }}>Last Sync: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* Right Side: Login Panel */}
      <div className="relative w-full md:w-[40%] lg:w-[35%] h-screen flex flex-col justify-center items-center overflow-y-auto"
        style={{ background: 'var(--color-luxury-white)' }}
      >
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-full h-full pointer-events-none z-0"
          style={{ background: 'radial-gradient(ellipse at top right, rgba(198, 167, 105, 0.05), transparent)' }}
        />

        {/* Mobile Logo */}
        <div className="md:hidden flex flex-col items-center mb-margin z-10">
          <h1 className="text-headline-mobile tracking-tight" style={{ color: 'var(--color-text-primary)' }}>KodaiRateIQ</h1>
          <div className="h-1 w-12 mt-2" style={{ background: 'var(--color-gold)' }} />
        </div>

        {/* Glass Panel */}
        <div className="relative z-10 w-full max-w-[420px] px-margin md:px-0">
          <div className="p-phi-xl relative overflow-hidden clay-panel">
            {/* Header */}
            <div className="mb-phi-xl">
              <h2 className="text-metric-xl tracking-tight mb-2" style={{ color: 'var(--color-text-primary)' }}>Executive Access</h2>
              <p className="text-body-md" style={{ color: 'var(--color-text-secondary)', fontWeight: 300 }}>Secure gateway to global intelligence.</p>
            </div>

            {/* Form */}
            <form className="space-y-phi-lg" onSubmit={(e) => { e.preventDefault(); window.location.href = '/'; }}>
              {/* Email Input */}
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  placeholder="Corporate Email"
                  required
                  className="w-full bg-transparent border-0 border-b px-0 py-phi-sm text-body-md focus:ring-0 transition-colors peer placeholder-transparent"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', outline: 'none' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--color-gold)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; }}
                />
                <label htmlFor="email" className="absolute left-0 top-phi-sm text-body-md pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-xs peer-valid:-top-4 peer-valid:text-xs"
                  style={{ color: 'var(--color-text-secondary)' }}>
                  Corporate Email
                </label>
              </div>

              {/* Password Input */}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="Security Key"
                  required
                  className="w-full bg-transparent border-0 border-b px-0 py-phi-sm text-body-md focus:ring-0 transition-colors peer placeholder-transparent"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', outline: 'none' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--color-gold)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; }}
                />
                <label htmlFor="password" className="absolute left-0 top-phi-sm text-body-md pointer-events-none transition-all peer-focus:-top-4 peer-focus:text-xs peer-valid:-top-4 peer-valid:text-xs"
                  style={{ color: 'var(--color-text-secondary)' }}>
                  Security Key
                </label>
                <button type="button" className="absolute right-0 top-phi-sm transition-colors hover:text-[var(--color-gold)]"
                  style={{ color: 'var(--color-text-secondary)' }}
                  onClick={() => setShowPassword(!showPassword)}>
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>

              {/* Utilities */}
              <div className="flex items-center justify-between pt-phi-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-[var(--color-gold)]" />
                  <span className="text-body-md" style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Remember Device</span>
                </label>
                <a href="#" className="text-body-md hover:text-[var(--color-gold)] transition-colors" style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Recover Access</a>
              </div>

              {/* Submit */}
              <div className="pt-phi-md">
                <button type="submit"
                  className="w-full relative overflow-hidden py-phi-md rounded-xl flex items-center justify-center gap-2 group clay-button"
                >
                  <span className="text-label-caps tracking-widest relative z-10">INITIALIZE SESSION</span>
                  <span className="material-symbols-outlined text-[18px] relative z-10 group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
              </div>
            </form>
          </div>

          {/* Support Footer */}
          <div className="mt-phi-xl flex justify-center w-full">
            <a href="#" className="inline-flex items-center gap-2 text-data-mono hover:text-[var(--color-gold)] transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="material-symbols-outlined text-[16px]">support_agent</span>
              Concierge Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
