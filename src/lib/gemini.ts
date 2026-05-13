// ============================================================
// KodaiRateIQ — AI Client (MiMo)
// Backward-compatible shim. All AI logic is in /src/services/ai/
// Provider: Xiaomi MiMo AI Platform (OpenAI-compatible)
// Endpoint: https://token-plan-sgp.xiaomimimo.com/v1
// ============================================================

export { generatePricingRecommendation } from '@/services/ai/recommendation-engine';
export { generateMarketInsights } from '@/services/ai/insight-engine';
