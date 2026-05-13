'use client';

interface AiInsightsProps {
  insights: any[] | null;
  loading: boolean;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  opportunity: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: '💡' },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: '⚠️' },
  critical: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', icon: '🚨' },
  info: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', icon: 'ℹ️' },
};

const TYPE_LABELS: Record<string, string> = {
  'pricing-pressure': 'Pricing Pressure',
  'demand-surge': 'Demand Surge',
  'premium-opportunity': 'Premium Opportunity',
  'competitor-undercut': 'Competitor Alert',
  'weekend-uplift': 'Weekend Uplift',
};

export function AiInsights({ insights, loading }: AiInsightsProps) {
  if (loading) {
    return (
      <section className="glass-card p-6">
        <div className="shimmer h-6 w-48 mb-6" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="shimmer h-24 w-full" />)}
        </div>
      </section>
    );
  }

  const items = insights ?? [];

  return (
    <section id="ai-insights" className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93" /><path d="M8.24 6A4 4 0 0 1 12 2" /><path d="M12 18a8 8 0 0 0 8-8" /><path d="M12 18a8 8 0 0 1-8-8" /><circle cx="12" cy="12" r="2" /><path d="M12 14v8" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold">AI Insights</h3>
          <p className="text-xs text-[#5a5a6e]">MiMo AI-powered Market Intelligence</p>
        </div>
      </div>

      <div className="p-4 space-y-3 max-h-[460px] overflow-y-auto">
        {items.map((insight: any, i: number) => {
          const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info;
          return (
            <div
              key={insight.id || i}
              className={`p-4 rounded-xl border ${style.border} ${style.bg} transition-all hover:scale-[1.01]`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{style.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] uppercase tracking-wider font-medium ${style.text}`}>
                      {TYPE_LABELS[insight.type] || insight.type}
                    </span>
                    {insight.actionable && (
                      <span className="px-1.5 py-0.5 text-[9px] rounded bg-white/5 text-[#8b8b9e]">Actionable</span>
                    )}
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">{insight.title}</h4>
                  <p className="text-xs text-[#8b8b9e] leading-relaxed">{insight.summary}</p>
                </div>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="p-8 text-center text-[#5a5a6e] text-sm">No insights available</div>
        )}
      </div>
    </section>
  );
}
