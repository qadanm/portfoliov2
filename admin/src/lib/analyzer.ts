// Job Description analyzer. Pure JS, no API calls.
// Extracts keywords, scores against angles, surfaces missing keywords vs Moe's profile.

import { angles, type Angle } from '@/data/angles';
import { skills } from '@/data/skills';

// Keywords that map a JD signal to an angle. Tuned for the 9 angles.
const ANGLE_SIGNALS: Record<string, string[]> = {
  'product-designer': [
    'product designer', 'product design', 'user experience', 'ux design',
    'figma', 'prototyping', 'user research', 'flows', 'wireframes',
    'product thinking', 'cross-functional',
  ],
  'senior-product-designer': [
    'senior product designer', 'senior designer', 'staff designer',
    'lead designer', 'mentorship', 'cross-functional', 'roadmap',
    'product strategy', 'design strategy', 'principal',
  ],
  'ux-engineer': [
    'ux engineer', 'design technologist', 'design implementation',
    'frontend', 'react', 'typescript', 'css', 'design system', 'tokens',
    'figma to code', 'production-ready',
  ],
  'frontend-ux-engineer': [
    'frontend engineer', 'front-end engineer', 'frontend developer',
    'react', 'typescript', 'next', 'astro', 'css', 'html',
    'performance', 'accessibility', 'ssr', 'web vitals',
  ],
  'design-engineer': [
    'design engineer', 'design technologist', 'tokens', 'components',
    'storybook', 'design system', 'tailwind', 'css variables',
    'design ops', 'systems',
  ],
  'web-experience-manager': [
    'web experience', 'site lead', 'web platform', 'cms', 'wordpress',
    'content management', 'multi-site', 'web operations', 'editorial',
    'governance', 'web strategy',
  ],
  'design-systems-engineer': [
    'design system', 'design tokens', 'component library', 'storybook',
    'figma library', 'design ops', 'governance', 'documentation',
    'theming', 'multi-brand', 'multi-tenant',
  ],
  'ai-product-designer': [
    'ai', 'llm', 'gpt', 'claude', 'genai', 'generative ai',
    'ai-native', 'ai-powered', 'chat interface', 'conversational',
    'agent', 'rag', 'prompt',
  ],
  'ux-product-lead': [
    'lead designer', 'design lead', 'product lead', 'manager',
    'team lead', 'people management', 'roadmap', 'strategy',
    'cross-functional', 'mentorship', 'hiring',
  ],
};

// Stack keywords Moe is strong on.
const STRENGTHS = new Set([
  'react', 'typescript', 'javascript', 'astro', 'next', 'next.js',
  'react native', 'expo', 'tailwind', 'css', 'html', 'figma', 'cursor',
  'claude', 'razor', 'asp.net', 'mvc', 'design systems', 'design tokens',
  'component library', 'multi-tenant', 'multi-site', 'accessibility',
  'wcag', 'supabase', 'design system', 'design-in-code', 'ai',
  'llm', 'prompt', 'product design', 'ux engineering', 'frontend',
  'front-end', 'platform', 'platform ux',
]);

// Stack keywords that are *not* part of Moe's profile (would-need-to-learn flags).
const GAPS = new Set([
  'vue', 'svelte', 'angular', 'rails', 'django', 'flask', 'php', 'wordpress',
  'webflow', 'shopify liquid', 'gatsby', 'remix', 'kotlin', 'swift native',
  'android native', 'unity', 'unreal', 'figma plugins', 'sketch',
  'webgl', 'three.js', 'd3', 'r ', 'matlab',
]);

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall',
  'can', 'need', 'with', 'in', 'on', 'at', 'to', 'for', 'of', 'from', 'by',
  'as', 'into', 'through', 'about', 'against', 'between', 'during', 'after',
  'before', 'above', 'below', 'over', 'under', 'this', 'that', 'these',
  'those', 'i', 'we', 'you', 'they', 'he', 'she', 'it', 'their', 'them',
  'our', 'your', 'my', 'his', 'her', 'its', 'who', 'what', 'when', 'where',
  'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'about', 'role', 'team', 'work', 'years', 'year',
  'us', 'eg', 'etc', 'one', 'two', 'three', 'four', 'five',
]);

export interface AnalyzerResult {
  recommendedAngle: Angle;
  rankedAngles: { angle: Angle; score: number; matchedSignals: string[] }[];
  matchedStrengths: string[];
  potentialGaps: string[];
  topKeywords: { word: string; count: number }[];
  riskFlags: string[];
  salaryClues: string[];
  remoteSignal: 'remote' | 'hybrid' | 'onsite' | 'unclear';
  seniorityHint: 'ic' | 'senior' | 'lead' | 'principal' | 'unclear';
  matchScore: number; // 0–100
}

export function analyzeJD(jdRaw: string): AnalyzerResult | null {
  const jd = jdRaw.trim();
  if (jd.length < 50) return null;
  const lower = jd.toLowerCase();

  // Angle scoring by signal hits.
  const ranked = angles.map(angle => {
    const sigs = ANGLE_SIGNALS[angle.id] ?? [];
    const matched = sigs.filter(s => lower.includes(s));
    return { angle, score: matched.length, matchedSignals: matched };
  }).sort((a, b) => b.score - a.score);

  const recommendedAngle = ranked[0].score > 0
    ? ranked[0].angle
    : angles.find(a => a.id === 'ux-engineer')!;

  // Strength + gap matching.
  const matchedStrengths = Array.from(STRENGTHS).filter(s => lower.includes(s));
  const potentialGaps = Array.from(GAPS).filter(s => lower.includes(s));

  // Top keywords (excluding stopwords + already-classified strengths).
  const wordCounts = new Map<string, number>();
  for (const tok of lower.match(/[a-z][a-z0-9.+\-]{2,}/g) ?? []) {
    if (STOPWORDS.has(tok)) continue;
    wordCounts.set(tok, (wordCounts.get(tok) ?? 0) + 1);
  }
  const topKeywords = Array.from(wordCounts.entries())
    .filter(([w]) => !STRENGTHS.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }));

  // Risk flags.
  const riskFlags: string[] = [];
  if (/unicorn|rockstar|ninja|wizard|guru/i.test(jd)) riskFlags.push('Unicorn / rockstar language — usually points at unrealistic scope.');
  if (/wear many hats|jack of all trades|no role is too small/i.test(jd)) riskFlags.push('"Wear many hats" — likely understaffed.');
  if (/(stipend only|equity only|deferred salary|equity-only)/i.test(jd)) riskFlags.push('Equity-only or deferred comp — verify cash before investing time.');
  if (/(weekly hackathons|move fast and break|hustle culture)/i.test(jd)) riskFlags.push('Burnout vocabulary present.');
  if (/(unpaid trial|test project for free|sample work)/i.test(jd)) riskFlags.push('Unpaid trial / spec work — push back or pass.');
  if (/(must be willing to|on call 24\/7|nights and weekends)/i.test(jd)) riskFlags.push('Always-on expectations.');
  if (lower.includes('contract to hire') || lower.includes('c2h')) riskFlags.push('Contract-to-hire — clarify conversion criteria upfront.');
  if (lower.includes('design and code')) riskFlags.push('"Design and code" — confirm scope and team support, not a one-person team in disguise.');

  // Salary clues.
  const salaryClues: string[] = [];
  const dollarMatches = jd.match(/\$\s?\d{2,3}[,.]?\d{0,3}\s?[kKMm]?\b(?:[\s\-–to]+\$?\s?\d{2,3}[,.]?\d{0,3}\s?[kKMm]?)?/g);
  if (dollarMatches) salaryClues.push(...dollarMatches.slice(0, 4));

  // Remote signal.
  let remoteSignal: AnalyzerResult['remoteSignal'] = 'unclear';
  if (/(fully remote|100% remote|remote-first|remote only)/i.test(jd)) remoteSignal = 'remote';
  else if (/hybrid/i.test(jd)) remoteSignal = 'hybrid';
  else if (/(in[- ]office|on[- ]site|onsite|in person)/i.test(jd)) remoteSignal = 'onsite';
  else if (/remote/i.test(jd)) remoteSignal = 'remote';

  // Seniority.
  let seniorityHint: AnalyzerResult['seniorityHint'] = 'unclear';
  if (/principal|staff/i.test(jd)) seniorityHint = 'principal';
  else if (/lead\b|head of/i.test(jd)) seniorityHint = 'lead';
  else if (/senior|sr\.?\b/i.test(jd)) seniorityHint = 'senior';
  else if (/(junior|jr\.?\b|entry|associate)/i.test(jd)) seniorityHint = 'ic';

  // Match score: weighted blend of angle match + strength overlap.
  const angleStrength = Math.min(ranked[0].score / 6, 1);
  const strengthShare = Math.min(matchedStrengths.length / 8, 1);
  const matchScore = Math.round((angleStrength * 0.55 + strengthShare * 0.45) * 100);

  return {
    recommendedAngle,
    rankedAngles: ranked.slice(0, 5),
    matchedStrengths,
    potentialGaps,
    topKeywords,
    riskFlags,
    salaryClues,
    remoteSignal,
    seniorityHint,
    matchScore,
  };
}
