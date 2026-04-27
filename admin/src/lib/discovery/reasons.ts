// Reason taxonomy. Every match / downrank / filter signal has a stable
// machine code AND a short user-facing label. Storing the label (not just
// the code) lets us render reasons without a lookup table at the UI layer
// and keeps the JSON dump in localStorage human-readable.

export type ReasonType = 'match' | 'downrank' | 'filter';

export interface Reason {
  code: string;
  label: string;
  type: ReasonType;
}

const r = (code: string, label: string, type: ReasonType): Reason => ({ code, label, type });

export const REASONS = {
  // ── Match (positive signals) ────────────────────────────────────────
  REMOTE_ALIGNED:        r('remote-aligned',         'Remote',                    'match'),
  SALARY_ALIGNED:        r('salary-aligned',         'Salary in band',            'match'),
  SENIOR_ALIGNED:        r('senior-aligned',         'Senior/Lead',               'match'),
  AI_RELEVANT:           r('ai-relevant',            'AI-native',                 'match'),
  DESIGN_SYSTEMS:        r('design-systems',         'Design systems',            'match'),
  FRONTEND_SYSTEMS:      r('frontend-systems',       'Frontend systems',          'match'),
  PRODUCT_DESIGN:        r('product-design',         'Product design',            'match'),
  PLATFORM_UX:           r('platform-ux',            'Platform UX',               'match'),
  STRONG_SKILL_MATCH:    r('strong-skill-match',     'Strong skill overlap',      'match'),
  HIGH_CONFIDENCE:       r('high-confidence',        'High confidence',           'match'),

  // ── Downrank (concerns that did NOT trigger filtering) ──────────────
  SALARY_MISSING:        r('salary-missing',         'Salary not stated',         'downrank'),
  REMOTE_UNCLEAR:        r('remote-unclear',         'Remote unclear',            'downrank'),
  HYBRID_LOCATION:       r('hybrid-location',        'Hybrid (location-bound)',   'downrank'),
  LOW_SKILL_MATCH:       r('low-skill-match',        'Few strengths matched',     'downrank'),
  BACKEND_HEAVY:         r('backend-heavy',          'Backend-heavy',             'downrank'),
  MOBILE_NATIVE_HEAVY:   r('mobile-native-heavy',    'Native mobile focus',       'downrank'),
  GRAPHIC_DESIGN_HEAVY:  r('graphic-design-heavy',   'Graphic design focus',      'downrank'),
  RISK_FLAGS:            r('risk-flags',             'Listing red flags',         'downrank'),
  LOW_CONFIDENCE:        r('low-confidence',         'Low confidence',            'downrank'),

  // ── Filter (caused rejection from the To-decide view) ──────────────
  SCORE_TOO_LOW:         r('score-too-low',          'Below score floor',         'filter'),
  ONSITE_ONLY:           r('onsite-only',            'Onsite-only',               'filter'),
  SALARY_TOO_LOW:        r('salary-too-low',         'Below salary floor',        'filter'),
  KEYWORD_EXCLUDED:      r('keyword-excluded',       'Excluded keyword',          'filter'),
  CONTRACT_ONLY:         r('contract-only',          'Contract role',             'filter'),
  JUNIOR_LEVEL:          r('junior-level',           'Junior/IC level',           'filter'),
} as const;

/**
 * Substring tests for downrank signals applied during normalization. These
 * are intentionally light — false positives are fine because the signal
 * informs ranking, not rejection.
 */
export const DOWNRANK_PATTERNS: Array<{ reason: Reason; test: (haystack: string) => boolean }> = [
  { reason: REASONS.BACKEND_HEAVY,        test: (h) => /\b(go(lang)?|kubernetes|microservices|distributed systems|grpc|kafka|terraform|backend engineer)\b/.test(h) && !/frontend|design/.test(h) },
  { reason: REASONS.MOBILE_NATIVE_HEAVY,  test: (h) => /\b(swift|kotlin|native iOS|native Android|objective-c|jetpack compose)\b/i.test(h) },
  { reason: REASONS.GRAPHIC_DESIGN_HEAVY, test: (h) => /\b(graphic designer|brand designer|illustrator|print designer|social media designer|marketing designer)\b/.test(h) },
];

/** Convert reason objects to the string array stored on a DiscoveredJob. */
export function reasonLabels(reasons: Reason[]): string[] {
  return reasons.map(r => r.label);
}
