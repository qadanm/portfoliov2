// URL → ATS type detection. Fast regex-only; no network.
//
// Patterns chosen for what's actually seen in 2026: most ATS hosts use
// subdomains or company-specific subdomains we can match on.

import type { AtsType } from '../storage';

interface AtsMatcher {
  ats: AtsType;
  patterns: RegExp[];
}

const MATCHERS: AtsMatcher[] = [
  { ats: 'greenhouse', patterns: [
    /(^|\.)greenhouse\.io/i,
    /boards\.greenhouse\.io/i,
    /job-boards\.greenhouse\.io/i,
  ] },
  { ats: 'lever', patterns: [
    /jobs\.lever\.co/i,
    /(^|\.)lever\.co/i,
    /hire\.lever\.co/i,
  ] },
  { ats: 'ashby', patterns: [
    /(^|\.)ashbyhq\.com/i,
    /jobs\.ashbyhq\.com/i,
  ] },
  { ats: 'workday', patterns: [
    /(^|\.)myworkdayjobs\.com/i,
    /(^|\.)workday\.com\/.*\/job/i,
  ] },
  { ats: 'smartrecruiters', patterns: [
    /(^|\.)smartrecruiters\.com/i,
    /jobs\.smartrecruiters\.com/i,
  ] },
  { ats: 'linkedin-easy', patterns: [
    /linkedin\.com\/jobs\/view/i,
    /linkedin\.com\/jobs\/collections/i,
  ] },
];

export function detectAts(url: string | undefined, jdText?: string): AtsType {
  if (!url) {
    // Heuristic JD fallback: look for telltale strings in the text
    if (jdText) {
      const lower = jdText.toLowerCase();
      if (lower.includes('greenhouse') && lower.includes('apply')) return 'greenhouse';
      if (lower.includes('lever.co')) return 'lever';
      if (lower.includes('ashbyhq')) return 'ashby';
      if (lower.includes('workday')) return 'workday';
    }
    return 'generic';
  }
  let host = url;
  try {
    host = new URL(url).hostname;
  } catch { /* ignore */ }
  for (const m of MATCHERS) {
    for (const p of m.patterns) {
      if (p.test(host) || p.test(url)) return m.ats;
    }
  }
  return 'generic';
}

export function atsLabel(ats: AtsType): string {
  switch (ats) {
    case 'greenhouse': return 'Greenhouse';
    case 'lever': return 'Lever';
    case 'ashby': return 'Ashby';
    case 'workday': return 'Workday';
    case 'smartrecruiters': return 'SmartRecruiters';
    case 'linkedin-easy': return 'LinkedIn Easy Apply';
    case 'generic': return 'Generic / unknown';
  }
}
