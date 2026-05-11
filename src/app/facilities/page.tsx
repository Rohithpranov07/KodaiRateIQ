'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';

export default function FacilitiesPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-phi-sm mb-phi-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-[2px] w-8 bg-[var(--color-gold)]"></div>
          <span className="text-label-caps" style={{ color: 'var(--color-gold)', letterSpacing: '0.2em' }}>Competitive Analysis</span>
        </div>
        <h1 className="text-display-hero leading-none tracking-tight max-w-4xl" style={{ color: 'var(--color-text-primary)' }}>
          Facility Benchmark
        </h1>
        <p className="text-body-md max-w-2xl mt-4 text-[var(--color-text-secondary)]">
          An executive-grade comparison of ultra-luxury amenities against regional tier-1 and tier-2 competitors. Baseline set to HKI standards.
        </p>
      </div>

      <section className="w-full relative mb-margin">
        <div className="clay-card rounded-2xl overflow-hidden relative">
          <div className="overflow-x-auto">
            <div className="min-w-[900px] grid grid-cols-[240px_minmax(180px,1fr)_repeat(4,minmax(160px,1fr))] w-full">
              
              {/* Header Row */}
              <div className="col-span-full grid grid-cols-subgrid items-end pb-phi-sm pt-phi-lg border-b border-[var(--color-border)] bg-[var(--color-soft-ivory)]">
                <div className="px-phi-lg text-label-caps tracking-widest text-[var(--color-text-secondary)]">Metrics Focus</div>
                <div className="px-phi-md py-2 relative flex flex-col gap-1 clay-inset rounded-t-xl border-b-0 mx-1">
                  <span className="text-label-caps tracking-widest flex items-center gap-2" style={{ color: 'var(--color-gold)' }}>
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span> HKI
                  </span>
                  <span className="text-data-mono text-[10px]" style={{ color: 'var(--color-text-primary)' }}>Baseline Standard</span>
                </div>
                {['Carlton', 'Tamara', 'Sterling', 'Le Poshe'].map((name, i) => (
                  <div key={i} className="px-phi-md py-2 flex flex-col gap-1">
                    <span className="text-label-caps tracking-widest text-[var(--color-text-primary)]">{name}</span>
                    <span className="text-data-mono text-[10px] text-[var(--color-text-secondary)]">{['Regional', 'Boutique', 'Corporate', 'Heritage'][i]}</span>
                  </div>
                ))}
              </div>

              {/* Data Row 1: Spa Quality */}
              <div className="col-span-full grid grid-cols-subgrid items-stretch transition-colors hover:bg-black/5 group border-b border-[var(--color-border)]">
                <div className="px-phi-lg py-phi-md flex items-center gap-3 border-r border-[var(--color-border)]">
                  <span className="material-symbols-outlined font-light text-[var(--color-gold)]">spa</span>
                  <span className="text-body-md text-[var(--color-text-primary)]">Spa Quality</span>
                </div>
                <div className="px-phi-md py-phi-md relative flex flex-col justify-center gap-2 clay-inset rounded-none mx-1">
                  <span className="text-data-mono font-medium text-[var(--color-text-primary)]">Signature Retreat</span>
                  <div className="flex gap-1">{[1,1,1,1,1].map((_, i) => <div key={i} className="w-2 h-2 rounded-full bg-[var(--color-gold)] shadow-sm" />)}</div>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2 border-r border-[var(--color-border)]">
                  <span className="text-data-mono text-[var(--color-text-primary)]">Standard Facility</span>
                  <div className="flex gap-1">{[1,1,1,0,0].map((v, i) => <div key={i} className={`w-2 h-2 rounded-full ${v ? 'bg-[var(--color-text-secondary)]' : 'bg-[var(--color-border)]'}`} />)}</div>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2 border-r border-[var(--color-border)]">
                  <span className="text-data-mono text-[var(--color-text-primary)]">Wellness Focus</span>
                  <div className="flex gap-1">{[1,1,1,1,0].map((v, i) => <div key={i} className={`w-2 h-2 rounded-full ${v ? 'bg-[var(--color-text-secondary)]' : 'bg-[var(--color-border)]'}`} />)}</div>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2 border-r border-[var(--color-border)]">
                  <span className="text-data-mono text-[var(--color-text-primary)]">Basic Amenities</span>
                  <div className="flex gap-1">{[1,1,0,0,0].map((v, i) => <div key={i} className={`w-2 h-2 rounded-full ${v ? 'bg-[var(--color-text-secondary)]' : 'bg-[var(--color-border)]'}`} />)}</div>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2">
                  <span className="text-data-mono text-[var(--color-text-primary)]">Boutique</span>
                  <div className="flex gap-1">{[1,1,1,0,0].map((v, i) => <div key={i} className={`w-2 h-2 rounded-full ${v ? 'bg-[var(--color-text-secondary)]' : 'bg-[var(--color-border)]'}`} />)}</div>
                </div>
              </div>

              {/* Data Row 2: Michelin Dining */}
              <div className="col-span-full grid grid-cols-subgrid items-stretch transition-colors hover:bg-black/5 group border-b border-[var(--color-border)]">
                <div className="px-phi-lg py-phi-md flex items-center gap-3 border-r border-[var(--color-border)]">
                  <span className="material-symbols-outlined font-light text-[var(--color-gold)]">restaurant</span>
                  <span className="text-body-md text-[var(--color-text-primary)]">Michelin Dining</span>
                </div>
                <div className="px-phi-md py-phi-md relative flex flex-col justify-center gap-2 clay-inset rounded-none mx-1">
                  <span className="text-data-mono font-medium text-[var(--color-text-primary)]">2-Star Onsite</span>
                  <div className="flex gap-1 text-[var(--color-gold)]"><span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span><span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span></div>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2 border-r border-[var(--color-border)]">
                  <span className="text-data-mono text-[var(--color-text-secondary)]">None</span>
                  <span className="text-data-mono text-[10px] text-[var(--color-text-secondary)] opacity-50">-</span>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2 border-r border-[var(--color-border)]">
                  <span className="text-data-mono text-[var(--color-text-primary)]">1-Star Onsite</span>
                  <div className="flex gap-1 text-[var(--color-text-secondary)]"><span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span></div>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2 border-r border-[var(--color-border)]">
                  <span className="text-data-mono text-[var(--color-text-secondary)]">Casual Only</span>
                  <span className="text-data-mono text-[10px] text-[var(--color-text-secondary)] opacity-50">-</span>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2">
                  <span className="text-data-mono text-[var(--color-text-secondary)]">Partner Rest.</span>
                  <span className="text-data-mono text-[10px] text-[var(--color-text-secondary)]">Offsite</span>
                </div>
              </div>

              {/* Data Row 3: Bar Excellence */}
              <div className="col-span-full grid grid-cols-subgrid items-stretch transition-colors hover:bg-black/5 group border-b border-[var(--color-border)]">
                <div className="px-phi-lg py-phi-md flex items-center gap-3 border-r border-[var(--color-border)]">
                  <span className="material-symbols-outlined font-light text-[var(--color-gold)]">local_bar</span>
                  <span className="text-body-md text-[var(--color-text-primary)]">Bar Excellence</span>
                </div>
                <div className="px-phi-md py-phi-md relative flex flex-col justify-center gap-2 clay-inset rounded-none mx-1">
                  <span className="text-data-mono font-medium text-[var(--color-text-primary)]">Bespoke Mixology</span>
                  <div className="h-2 w-full rounded-full overflow-hidden clay-inset shadow-inner"><div className="h-full bg-[var(--color-gold)] w-full"></div></div>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2 border-r border-[var(--color-border)]">
                  <span className="text-data-mono text-[var(--color-text-primary)]">Lobby Bar</span>
                  <div className="h-2 w-full rounded-full overflow-hidden bg-[var(--color-border)]"><div className="h-full bg-[var(--color-text-secondary)] w-[60%]"></div></div>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2 border-r border-[var(--color-border)]">
                  <span className="text-data-mono text-[var(--color-text-primary)]">Premium Lounge</span>
                  <div className="h-2 w-full rounded-full overflow-hidden bg-[var(--color-border)]"><div className="h-full bg-[var(--color-text-secondary)] w-[80%]"></div></div>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2 border-r border-[var(--color-border)]">
                  <span className="text-data-mono text-[var(--color-text-secondary)]">Standard Pub</span>
                  <div className="h-2 w-full rounded-full overflow-hidden bg-[var(--color-border)]"><div className="h-full bg-[var(--color-text-secondary)] w-[40%] opacity-50"></div></div>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2">
                  <span className="text-data-mono text-[var(--color-text-primary)]">Speakeasy</span>
                  <div className="h-2 w-full rounded-full overflow-hidden bg-[var(--color-border)]"><div className="h-full bg-[var(--color-text-secondary)] w-[90%]"></div></div>
                </div>
              </div>

              {/* Data Row 4: Global Tier */}
              <div className="col-span-full grid grid-cols-subgrid items-stretch transition-colors hover:bg-black/5 group">
                <div className="px-phi-lg py-phi-md flex items-center gap-3 border-r border-[var(--color-border)]">
                  <span className="material-symbols-outlined font-light text-[var(--color-gold)]">diamond</span>
                  <span className="text-body-md text-[var(--color-text-primary)]">Global Tier</span>
                </div>
                <div className="px-phi-md py-phi-md relative flex flex-col justify-center gap-2 clay-inset rounded-b-xl border-t-0 mx-1">
                  <div className="px-2 py-1 rounded w-max bg-[rgba(198,167,105,0.1)] border border-[var(--color-gold)]">
                    <span className="text-label-caps tracking-widest text-[var(--color-gold)]">TIER 1 ELITE</span>
                  </div>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2 border-r border-[var(--color-border)]">
                  <span className="text-data-mono text-[var(--color-text-primary)]">Tier 2</span>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2 border-r border-[var(--color-border)]">
                  <span className="text-data-mono text-[var(--color-text-primary)]">Tier 1</span>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2 border-r border-[var(--color-border)]">
                  <span className="text-data-mono text-[var(--color-text-secondary)]">Tier 3</span>
                </div>
                <div className="px-phi-md py-phi-md flex flex-col justify-center gap-2">
                  <span className="text-data-mono text-[var(--color-text-primary)]">Tier 2</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Executive Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-margin w-full">
        {/* Card 1 */}
        <div className="clay-card rounded-2xl p-phi-lg flex flex-col gap-phi-md hover:scale-[1.02] transition-transform duration-500 group border-t-4 border-t-[var(--color-positive)]">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-[rgba(45,106,79,0.1)] text-[var(--color-positive)] clay-inset">
            <span className="material-symbols-outlined">trending_up</span>
          </div>
          <div>
            <h3 className="text-label-caps tracking-widest uppercase mb-2 text-[var(--color-text-secondary)]">Market Dominance</h3>
            <p className="text-metric-xl text-[var(--color-text-primary)]">Michelin Dining</p>
          </div>
          <p className="text-body-md mt-auto text-[var(--color-text-secondary)]">
            HKI remains the undisputed regional leader with exclusive 2-star onsite culinary offerings, unmatchable by current peers.
          </p>
        </div>

        {/* Card 2 */}
        <div className="clay-card rounded-2xl p-phi-lg flex flex-col gap-phi-md hover:scale-[1.02] transition-transform duration-500 group border-t-4 border-t-[var(--color-warning)]">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-[rgba(168,121,69,0.1)] text-[var(--color-warning)] clay-inset">
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div>
            <h3 className="text-label-caps tracking-widest uppercase mb-2 text-[var(--color-text-secondary)]">Key Vulnerability</h3>
            <p className="text-metric-xl text-[var(--color-text-primary)]">Lake Proximity</p>
          </div>
          <p className="text-body-md mt-auto text-[var(--color-text-secondary)]">
            Le Poshe matches HKI's lakefront advantage, though lacking private dock infrastructure. Monitor marketing positioning closely.
          </p>
        </div>

        {/* Card 3 */}
        <div className="clay-card rounded-2xl p-phi-lg flex flex-col gap-phi-md transition-transform duration-500 group hover:scale-[1.02] border-t-4 border-t-[var(--color-gold)]">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-[rgba(198,167,105,0.1)] text-[var(--color-gold)] clay-inset">
            <span className="material-symbols-outlined">lightbulb</span>
          </div>
          <div>
            <h3 className="text-label-caps tracking-widest uppercase mb-2 text-[var(--color-text-secondary)]">Strategic Action</h3>
            <p className="text-metric-xl text-[var(--color-text-primary)]">Spa Expansion</p>
          </div>
          <p className="text-body-md mt-auto text-[var(--color-text-secondary)]">
            Tamara is rapidly closing the gap in wellness offerings. Recommend accelerating planned phase 2 spa expansions to maintain Tier 1 elite status.
          </p>
        </div>
      </section>
    </DashboardLayout>
  );
}
