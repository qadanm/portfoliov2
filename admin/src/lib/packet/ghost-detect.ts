// Ghost-job risk scorer. Pure heuristics, no LLM.
// Higher score = higher likelihood the posting is non-actionable.

import type { Job, GhostRisk } from '../storage';

interface GhostSignal {
  reason: string;
  weight: number;
}

export interface GhostAssessment {
  score: number;
  risk: GhostRisk;
  reasons: string[];
}

// Generic JD cliché phrases — many of these alone aren't a problem, but
// 3+ together suggests a templated posting.
const GENERIC_PHRASES: string[] = [
  'various duties as assigned',
  'team player with excellent communication skills',
  'fast-paced environment',
  'wear many hats',
  'rockstar', 'ninja', 'guru', 'wizard',
  'must be willing to',
  'detail-oriented',
  'self-starter',
  'highly motivated',
  'plus skills',
  'other duties as needed',
];

// Junior-coded terms that conflict with senior-titled roles.
const JUNIOR_LANGUAGE = /\b(entry[- ]level|junior|jr\.?|intern|trainee|coordinator|associate)\b/i;
const SENIOR_TITLE = /\b(senior|sr\.?|staff|principal|lead|head of|director|vp|vice president)\b/i;

const URGENT_LANGUAGE = /\b(urgent hiring|immediate start|asap|hire today|start tomorrow)\b/i;

export function detectGhostRisk(job: Job, allJobs: Job[] = []): GhostAssessment {
  const signals: GhostSignal[] = [];
  const jd = (job.jdText ?? '').toLowerCase();

  // Posted > 30 days ago (best-effort: use dateFound)
  if (job.dateFound) {
    const daysOld = (Date.now() - job.dateFound) / (1000 * 60 * 60 * 24);
    if (daysOld > 60) signals.push({ reason: 'Posting tracked for 60+ days', weight: 25 });
    else if (daysOld > 30) signals.push({ reason: 'Posting tracked for 30+ days', weight: 15 });
  }

  // No salary range — increasingly a red flag in 2026 with transparency laws
  if (!job.salaryMin && !job.salaryMax) {
    // Don't penalize if JD text mentions salary even informally
    if (!jd.match(/\$\s?\d{2,3}[,.]?\d{0,3}\s?[kKMm]?/)) {
      signals.push({ reason: 'No salary range disclosed', weight: 15 });
    }
  }

  // Repost frequency: same company+role seen 3+ times in jobs list
  if (allJobs.length > 1) {
    const cmpLower = (job.company ?? '').trim().toLowerCase();
    const roleLower = (job.role ?? '').trim().toLowerCase();
    if (cmpLower && roleLower) {
      const matches = allJobs.filter(j =>
        j.id !== job.id &&
        (j.company ?? '').trim().toLowerCase() === cmpLower &&
        (j.role ?? '').trim().toLowerCase() === roleLower
      );
      if (matches.length >= 2) {
        signals.push({ reason: `Reposted ${matches.length + 1}× (same company + role)`, weight: 25 });
      }
    }
  }

  // Generic / templated JD: 3+ cliché phrases
  if (jd) {
    const clicheHits = GENERIC_PHRASES.filter(p => jd.includes(p)).length;
    if (clicheHits >= 4) signals.push({ reason: `Highly generic JD (${clicheHits} cliché phrases)`, weight: 15 });
    else if (clicheHits >= 3) signals.push({ reason: `Generic JD (${clicheHits} cliché phrases)`, weight: 10 });
  }

  // Title-responsibility mismatch
  if (job.role && jd && SENIOR_TITLE.test(job.role) && JUNIOR_LANGUAGE.test(jd)) {
    signals.push({ reason: 'Senior title with entry-level responsibilities', weight: 10 });
  }

  // Unrealistic requirements: junior role asking 5+ years
  if (job.role && jd && JUNIOR_LANGUAGE.test(job.role) && /\b(5|6|7|8|9|10)\+?\s+years/i.test(jd)) {
    signals.push({ reason: 'Junior role asking for 5+ years experience', weight: 10 });
  }

  // Urgent-hiring language
  if (jd && URGENT_LANGUAGE.test(jd)) {
    signals.push({ reason: '"Urgent hiring" language', weight: 5 });
  }

  // Email-only application
  if (job.url && job.url.startsWith('mailto:')) {
    signals.push({ reason: 'Email-only application (no form URL)', weight: 15 });
  }

  // Missing URL entirely
  if (!job.url || job.url.trim().length === 0) {
    signals.push({ reason: 'No application URL', weight: 10 });
  }

  // No JD at all — can't evaluate fit either
  if (!jd || jd.length < 100) {
    signals.push({ reason: 'JD missing or too short to evaluate', weight: 5 });
  }

  // Suspicious domain: third-party only, not company own
  if (job.url) {
    try {
      const u = new URL(job.url);
      const host = u.hostname.toLowerCase();
      const known3rd = /(jobs|hire|careers)\.(lever|greenhouse|ashby|workday)\.|myworkdayjobs\.com|smartrecruiters\.com|workable\.com|linkedin\.com\/jobs|indeed\.com|glassdoor\.com|wellfound|angel\.co|ycombinator\.com|builtin\.com|remotive|remoteok|weworkremotely/;
      // If on a generic job board AND no salary AND tracked > 21 days → suspicious
      const onlyOnBoard = known3rd.test(host);
      if (onlyOnBoard && !job.salaryMin && job.dateFound && (Date.now() - job.dateFound) > 21 * 86400_000) {
        signals.push({ reason: 'On generic job board only, stale, no salary', weight: 5 });
      }
    } catch { /* invalid URL */ }
  }

  const score = signals.reduce((s, sig) => s + sig.weight, 0);
  let risk: GhostRisk = 'low';
  if (score >= 60) risk = 'high';
  else if (score >= 30) risk = 'medium';

  return {
    score: Math.min(100, score),
    risk,
    reasons: signals.map(s => s.reason),
  };
}
