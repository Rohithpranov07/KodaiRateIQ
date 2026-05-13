// ============================================================
// KodaiRateIQ — MAP Plan Classifier
//
// Intelligently identifies TRUE MAP (Modified American Plan)
// meal inclusions across all OTA label formats and languages.
//
// MAP = Room + Breakfast + Lunch OR Dinner (half-board or above)
// CP  = Room + Breakfast only
// EP  = Room only (no meals)
//
// REJECT: honeymoon bundles, member pricing, wallet discounts,
//         tour packages, loyalty-exclusive rates
// ============================================================

export type MealPlan = 'MAP' | 'CP' | 'EP' | 'FAP' | 'UNKNOWN';

export interface MealClassification {
  plan: MealPlan;
  breakfastIncluded: boolean;
  lunchIncluded: boolean;
  dinnerIncluded: boolean;
  confidence: number;
  reason: string;
  isMapEligible: boolean;
  shouldReject: boolean;
  rejectReason?: string;
}

// ── MAP triggers (breakfast + any of lunch/dinner) ───────────────────────────
const MAP_KEYWORDS = [
  'map', 'modified american plan',
  'half board', 'halfboard', 'half-board',
  'breakfast and dinner', 'breakfast & dinner',
  'breakfast + dinner', 'breakfast with dinner',
  'breakfast and lunch', 'breakfast & lunch',
  'breakfast + lunch', 'breakfast with lunch',
  'breakfast and half board',
  'all meals', 'all meal', 'full board', 'fullboard', 'full-board',
  'american plan', 'fap',
  'dinner bed breakfast', 'dbb',
  'map plan', 'map rate', 'map tariff',
  'meal plan', // broad — refined below
  'continental plan with dinner',
  'bb + dinner', 'bb+dinner',
  'hb plan', 'hb rate',
  'breakfast lunch dinner', 'bld',
  'breakfast, lunch and dinner',
  'breakfast, lunch & dinner',
  // Indian OTA labels
  'nashta aur khana', // hindi
  'complimentary breakfast and dinner',
  'complimentary breakfast and lunch',
  'inclusive of breakfast and dinner',
  'inclusive of breakfast & dinner',
  'includes breakfast and dinner',
  'includes breakfast & dinner',
  'room with breakfast and dinner',
  'room with all meals',
];

// ── CP triggers (breakfast only) ─────────────────────────────────────────────
const CP_KEYWORDS = [
  'cp', 'continental plan',
  'breakfast included', 'breakfast only', 'with breakfast',
  'complimentary breakfast', 'free breakfast',
  'breakfast inclusive', 'breakfast is included',
  'room with breakfast', 'room + breakfast', 'room and breakfast',
  'bb plan', 'b&b', 'bed and breakfast', 'bed & breakfast',
  'breakfast package',
  'nashta included', // hindi
  'includes breakfast',
  'inclusive of breakfast',
];

// ── EP triggers (no meals) ────────────────────────────────────────────────────
const EP_KEYWORDS = [
  'ep', 'european plan', 'room only',
  'no meals', 'without meals', 'no breakfast',
  'self catering', 'room alone',
  'accommodation only', 'bed only',
  'room tariff',
];

// ── REJECTION triggers — exclude from MAP BAR consideration ──────────────────
const REJECT_KEYWORDS = [
  'honeymoon', 'honey moon', 'romance package', 'romantic package',
  'anniversary package', 'couple special',
  'member rate', 'member price', 'member deal', 'member exclusive',
  'genius rate', 'genius discount',
  'loyalty rate', 'loyalty reward', 'loyalty point',
  'wallet cashback', 'paytm cashback', 'phonepe cashback',
  'coupon required', 'promo code required',
  'corporate rate', 'corporate tariff',
  'group rate', 'group tariff', 'group booking',
  'package tour', 'tour package', 'travel package',
  'travel deal', 'holiday package',
  'secret deal', 'secret price',
  'flash sale', 'limited deal',
  'non-refundable deal', // flag but don't auto-reject — some legitimate rates are NR
];

// ── ROOM HIERARCHY — prevents comparing unlike room tiers ────────────────────
export type RoomTier =
  | 'BUDGET'
  | 'STANDARD'
  | 'SUPERIOR'
  | 'DELUXE'
  | 'PREMIUM'
  | 'SUITE'
  | 'VILLA'
  | 'PENTHOUSE';

const ROOM_TIER_PATTERNS: Array<{ tier: RoomTier; patterns: string[] }> = [
  { tier: 'BUDGET',    patterns: ['budget', 'economy', 'basic'] },
  { tier: 'STANDARD',  patterns: ['standard', 'classic', 'regular', 'default'] },
  { tier: 'SUPERIOR',  patterns: ['superior', 'comfort', 'executive'] },
  { tier: 'DELUXE',    patterns: ['deluxe', 'dlx', 'premium deluxe'] },
  { tier: 'PREMIUM',   patterns: ['premium', 'exclusive', 'elite', 'signature', 'grand'] },
  { tier: 'SUITE',     patterns: ['suite', 'junior suite', 'studio suite', 'apartment'] },
  { tier: 'VILLA',     patterns: ['villa', 'cottage', 'bungalow', 'chalet', 'cabin'] },
  { tier: 'PENTHOUSE', patterns: ['penthouse', 'presidential'] },
];

// ── VIEW MODIFIERS — sub-classification within tier ─────────────────────────
const VIEW_PATTERNS = ['lake view', 'lake-view', 'valley view', 'garden view', 'pool view', 'mountain view', 'sea view', 'ocean view'];

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY CLASSIFIER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify the meal plan from raw OTA inclusion text.
 * Returns structured classification with confidence score.
 */
export function classifyMealPlan(
  inclusionText: string,
  roomName?: string,
  planLabel?: string,
): MealClassification {
  const raw = [inclusionText, roomName, planLabel]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .trim();

  // ── REJECTION CHECK ───────────────────────────────────────
  for (const reject of REJECT_KEYWORDS) {
    if (raw.includes(reject)) {
      const isHardReject = [
        'honeymoon', 'honey moon', 'member rate', 'member price',
        'member exclusive', 'genius rate', 'loyalty rate',
        'corporate rate', 'group rate', 'tour package',
        'travel package', 'package tour',
      ].some(r => raw.includes(r));

      if (isHardReject) {
        return {
          plan: 'UNKNOWN',
          breakfastIncluded: false,
          lunchIncluded: false,
          dinnerIncluded: false,
          confidence: 0,
          reason: `Rejected: matched exclusion keyword "${reject}"`,
          isMapEligible: false,
          shouldReject: true,
          rejectReason: `Excluded plan type: ${reject}`,
        };
      }
    }
  }

  // ── MAP CHECK ─────────────────────────────────────────────
  for (const kw of MAP_KEYWORDS) {
    if (raw.includes(kw)) {
      const hasFullBoard = ['full board', 'fullboard', 'fap', 'american plan', 'all meals', 'breakfast lunch dinner', 'bld'].some(fb => raw.includes(fb));
      const hasDinner = raw.includes('dinner') || raw.includes('dbb') || raw.includes('hb');
      const hasLunch = raw.includes('lunch');

      return {
        plan: hasFullBoard ? 'FAP' : 'MAP',
        breakfastIncluded: true,
        lunchIncluded: hasLunch || hasFullBoard,
        dinnerIncluded: hasDinner || hasFullBoard || (!hasLunch), // MAP default = dinner
        confidence: kw === 'map' || kw === 'half board' || kw === 'hb plan' ? 0.98 : 0.90,
        reason: `MAP detected via keyword: "${kw}"`,
        isMapEligible: true,
        shouldReject: false,
      };
    }
  }

  // ── CP CHECK ──────────────────────────────────────────────
  for (const kw of CP_KEYWORDS) {
    if (raw.includes(kw)) {
      // Make sure it's not also MAP
      const alsoHasDinner = raw.includes('dinner') || raw.includes('half board');
      if (alsoHasDinner) continue; // Escalate to MAP path above
      return {
        plan: 'CP',
        breakfastIncluded: true,
        lunchIncluded: false,
        dinnerIncluded: false,
        confidence: kw === 'cp' || kw === 'bed and breakfast' ? 0.95 : 0.85,
        reason: `CP detected via keyword: "${kw}"`,
        isMapEligible: false,
        shouldReject: false,
      };
    }
  }

  // ── EP CHECK ──────────────────────────────────────────────
  for (const kw of EP_KEYWORDS) {
    if (raw.includes(kw)) {
      return {
        plan: 'EP',
        breakfastIncluded: false,
        lunchIncluded: false,
        dinnerIncluded: false,
        confidence: kw === 'ep' || kw === 'room only' ? 0.95 : 0.80,
        reason: `EP detected via keyword: "${kw}"`,
        isMapEligible: false,
        shouldReject: false,
      };
    }
  }

  // ── SIGNAL ANALYSIS (no explicit keyword matched) ─────────
  const hasBreakfast = raw.includes('breakfast');
  const hasDinner = raw.includes('dinner') || raw.includes('supper');
  const hasLunch = raw.includes('lunch');
  const hasMeals = raw.includes('meal');

  if (hasBreakfast && (hasDinner || hasLunch)) {
    return {
      plan: 'MAP',
      breakfastIncluded: true,
      lunchIncluded: hasLunch,
      dinnerIncluded: hasDinner,
      confidence: 0.82,
      reason: 'MAP inferred from explicit breakfast + dinner/lunch signals',
      isMapEligible: true,
      shouldReject: false,
    };
  }

  if (hasBreakfast && !hasDinner && !hasLunch) {
    return {
      plan: 'CP',
      breakfastIncluded: true,
      lunchIncluded: false,
      dinnerIncluded: false,
      confidence: 0.75,
      reason: 'CP inferred from breakfast-only signal',
      isMapEligible: false,
      shouldReject: false,
    };
  }

  if (hasMeals && !hasBreakfast) {
    // Ambiguous meals mention — likely MAP but uncertain
    return {
      plan: 'MAP',
      breakfastIncluded: true,
      lunchIncluded: false,
      dinnerIncluded: true,
      confidence: 0.55,
      reason: 'MAP tentatively inferred from "meals" mention without explicit plan type',
      isMapEligible: true,
      shouldReject: false,
    };
  }

  // ── FALLBACK ──────────────────────────────────────────────
  return {
    plan: 'UNKNOWN',
    breakfastIncluded: false,
    lunchIncluded: false,
    dinnerIncluded: false,
    confidence: 0.30,
    reason: 'No meal plan signals found in inclusion text',
    isMapEligible: false,
    shouldReject: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM TIER CLASSIFIER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine room tier from room name.
 * Used to prevent cross-tier BAR comparison (Suite vs Standard).
 */
export function classifyRoomTier(roomName: string): RoomTier {
  const lower = roomName.toLowerCase();
  for (const { tier, patterns } of ROOM_TIER_PATTERNS) {
    if (patterns.some(p => lower.includes(p))) return tier;
  }
  return 'STANDARD'; // Safe default
}

/**
 * Check if two room names are in the same comparable tier.
 * Returns true if they should be compared (same tier or adjacent).
 */
export function areRoomsComparable(roomA: string, roomB: string): boolean {
  const tierA = classifyRoomTier(roomA);
  const tierB = classifyRoomTier(roomB);

  const tierOrder: RoomTier[] = [
    'BUDGET', 'STANDARD', 'SUPERIOR', 'DELUXE', 'PREMIUM', 'SUITE', 'VILLA', 'PENTHOUSE',
  ];
  const idxA = tierOrder.indexOf(tierA);
  const idxB = tierOrder.indexOf(tierB);

  // Allow comparison within 1 tier step (e.g. Deluxe ↔ Superior OK, Deluxe ↔ Suite NOT)
  return Math.abs(idxA - idxB) <= 1;
}

/**
 * Extract view type from room name for sub-classification.
 */
export function extractViewType(roomName: string): string | null {
  const lower = roomName.toLowerCase();
  for (const view of VIEW_PATTERNS) {
    if (lower.includes(view)) return view;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAX NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize any rate to tax-inclusive INR for fair cross-OTA comparison.
 * GST for hotels: 12% if rate < ₹7,500/night, 18% if ₹7,500+
 */
export function normalizeTaxInclusive(rate: number, taxInclusive: boolean, taxPercent?: number): number {
  if (taxInclusive) return Math.round(rate);
  const gst = taxPercent ?? (rate >= 7500 ? 18 : 12);
  return Math.round(rate * (1 + gst / 100));
}

/**
 * Determine applicable GST slab for a hotel rate.
 */
export function getGstSlab(ratePerNight: number): number {
  if (ratePerNight < 1000) return 0;    // Budget — exempt
  if (ratePerNight < 7500) return 12;   // Mid-range
  return 18;                             // Premium
}

// ─────────────────────────────────────────────────────────────────────────────
// OCCUPANCY NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a rate to double occupancy (2 adults) basis.
 * Some OTAs quote per-person; others quote per-room.
 */
export function normalizeDoubleOccupancy(
  quotedRate: number,
  quotedOccupancy: number,
  perPerson: boolean,
): number {
  if (perPerson) {
    // Convert per-person to per-room for 2 adults
    return Math.round(quotedRate * 2);
  }
  if (quotedOccupancy === 1) {
    // Single occupancy — estimate double (typically +20%)
    return Math.round(quotedRate * 1.20);
  }
  return Math.round(quotedRate); // Already double
}
