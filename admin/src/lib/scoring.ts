// Opportunity scoring. Combines analyzer signals + URL-board signals
// + heuristic salary/remote/seniority match into a 0–100 score with a
// human-readable breakdown.

import type { AnalyzerResult } from './analyzer';
import type { UrlParseResult, JobBoard } from './job-url-parser';

// Personal preferences. Edit to taste — these change the score.
export const PREFERENCES = {
  preferRemote: true,            // remote = +, onsite = -
  targetSalaryMin: 180_000,      // base USD
  targetSalaryMax: 240_000,
  targetSeniority: ['senior', 'lead', 'principal'] as const,
  // Lower application effort = higher likely callback.
  effortByBoard: {
    linkedin: 'low',           // easy apply often
    greenhouse: 'medium',
    lever: 'medium',
    ashby: 'medium',
    workday: 'high',           // long forms
    smartrecruiters: 'medium',
    workable: 'medium',
    indeed: 'low',
    builtin: 'low',
    wellfound: 'medium',
    'company-site': 'medium',
    unknown: 'medium',
  } satisfies Record<JobBoard, 'low' | 'medium' | 'high'>,
};

export interface OpportunityScore {
  total: number;            // 0–100
  confidence: 'low' | 'medium' | 'high';
  priority: 1 | 2 | 3;      // 1 = highest
  breakdown: { label: string; weight: number; score: number; note?: string }[];
  topStrengths: string[];
  gaps: string[];
  suggestedAngleId: string;
  suggestedAngleLabel: string;
  suggestedMessageType: 'recruiter-dm' | 'cover-letter' | 'connect-note';
  recommendedAction: string;
  applicationEffort: 'low' | 'medium' | 'high';
}

interface ScoreInput {
  analyzer: AnalyzerResult | null;
  url: UrlParseResult | null;
  // From the JD field extraction (job-intake.ts)
  detectedSalaryMin?: number;
  detectedSalaryMax?: number;
}

function clamp(n: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, n)); }

function detectSalaryFromAnalyzer(r: AnalyzerResult): { min?: number; max?: number } {
  // Pull "$120k", "$120,000", "$120k–$160k" patterns from clues.
  const out: { min?: number; max?: number } = {};
  for (const clue of r.salaryClues) {
    const nums = Array.from(clue.matchAll(/\$?\s?(\d{2,3})(?:[,.](\d{3}))?\s?([kKmM])?/g)).map(m => {
      const base = Number(`${m[1]}${m[2] ?? ''}`);
      const mult = m[3]?.toLowerCase() === 'k' ? 1000 : m[3]?.toLowerCase() === 'm' ? 1_000_000 : 1;
      return base * mult;
    }).filter(Boolean);
    if (nums.length >= 2) {
      out.min = Math.min(out.min ?? Infinity, nums[0]);
      out.max = Math.max(out.max ?? 0, nums[1]);
    } else if (nums.length === 1) {
      out.min = out.min ?? nums[0];
      out.max = out.max ?? nums[0];
    }
  }
  if (out.min === Infinity) delete (out as any).min;
  return out;
}

export function scoreOpportunity(input: ScoreInput): OpportunityScore {
  const a = input.analyzer;
  const u = input.url;

  const breakdown: OpportunityScore['breakdown'] = [];
  let topStrengths: string[] = [];
  let gaps: string[] = [];
  let suggestedAngleId = 'ux-engineer';
  let suggestedAngleLabel = 'UX Engineer';

  // ── Role match (analyzer angle signal density) — 25% ──────────────
  let roleScore = 0;
  if (a) {
    const sigCount = a.rankedAngles[0]?.score ?? 0;
    roleScore = clamp((sigCount / 6) * 100);
    suggestedAngleId = a.recommendedAngle.id;
    suggestedAngleLabel = a.recommendedAngle.label;
  }
  breakdown.push({ label: 'Role match', weight: 25, score: roleScore, note: a ? `${a.rankedAngles[0]?.score ?? 0} angle signals matched` : 'no JD analyzed' });

  // ── Skills overlap — 20% ───────────────────────────────────────────
  let skillsScore = 0;
  if (a) {
    skillsScore = clamp((a.matchedStrengths.length / 8) * 100);
    topStrengths = a.matchedStrengths.slice(0, 6);
    gaps = a.potentialGaps.slice(0, 4);
  }
  breakdown.push({ label: 'Skills overlap', weight: 20, score: skillsScore, note: a ? `${a.matchedStrengths.length} skills matched` : 'no JD analyzed' });

  // ── Salary fit — 15% ──────────────────────────────────────────────
  let salScore = 50; // neutral default
  let salNote = 'no salary detected';
  let detSalMin = input.detectedSalaryMin;
  let detSalMax = input.detectedSalaryMax;
  if (a && (!detSalMin || !detSalMax)) {
    const fromClues = detectSalaryFromAnalyzer(a);
    detSalMin = detSalMin ?? fromClues.min;
    detSalMax = detSalMax ?? fromClues.max;
  }
  if (detSalMax && detSalMax > 0) {
    const target = (PREFERENCES.targetSalaryMin + PREFERENCES.targetSalaryMax) / 2;
    if (detSalMax >= PREFERENCES.targetSalaryMin) {
      const overlap = Math.min(detSalMax, PREFERENCES.targetSalaryMax) - Math.max(detSalMin ?? detSalMax, PREFERENCES.targetSalaryMin);
      const overlapShare = overlap / (PREFERENCES.targetSalaryMax - PREFERENCES.targetSalaryMin);
      salScore = clamp(60 + overlapShare * 40);
      salNote = `target band overlaps`;
    } else {
      salScore = clamp(20 + (detSalMax / target) * 30);
      salNote = `below target band`;
    }
  }
  breakdown.push({ label: 'Salary fit', weight: 15, score: salScore, note: salNote });

  // ── Remote/hybrid — 10% ────────────────────────────────────────────
  let remoteScore = 50;
  let remoteNote = 'unclear';
  if (a) {
    if (a.remoteSignal === 'remote') { remoteScore = 95; remoteNote = 'remote'; }
    else if (a.remoteSignal === 'hybrid') { remoteScore = 65; remoteNote = 'hybrid'; }
    else if (a.remoteSignal === 'onsite') { remoteScore = PREFERENCES.preferRemote ? 25 : 70; remoteNote = 'on-site'; }
  }
  breakdown.push({ label: 'Remote fit', weight: 10, score: remoteScore, note: remoteNote });

  // ── Seniority — 10% ────────────────────────────────────────────────
  let seniorityScore = 60;
  let senNote = 'unclear';
  if (a) {
    if (a.seniorityHint === 'senior' || a.seniorityHint === 'lead') { seniorityScore = 95; senNote = a.seniorityHint; }
    else if (a.seniorityHint === 'principal') { seniorityScore = 80; senNote = 'principal/staff'; }
    else if (a.seniorityHint === 'ic') { seniorityScore = 35; senNote = 'IC/junior'; }
  }
  breakdown.push({ label: 'Seniority match', weight: 10, score: seniorityScore, note: senNote });

  // ── AI/design relevance — 10% ──────────────────────────────────────
  let aiScore = 50;
  let aiNote = 'no AI/design specific signal';
  if (a) {
    const hasAi = a.matchedStrengths.some(s => /\bai\b|llm|claude|gpt|prompt|agent/.test(s));
    const recommendsAi = a.recommendedAngle.id === 'ai-product-designer';
    if (hasAi && recommendsAi) { aiScore = 95; aiNote = 'AI-native role + AI strengths overlap'; }
    else if (hasAi || recommendsAi) { aiScore = 75; aiNote = 'partial AI relevance'; }
  }
  breakdown.push({ label: 'AI / design relevance', weight: 10, score: aiScore, note: aiNote });

  // ── Application effort — 10% (lower effort = higher score) ─────────
  let applicationEffort: OpportunityScore['applicationEffort'] = 'medium';
  let effortScore = 60;
  if (u) {
    applicationEffort = PREFERENCES.effortByBoard[u.board];
    effortScore = applicationEffort === 'low' ? 90 : applicationEffort === 'medium' ? 65 : 35;
  }
  breakdown.push({ label: 'Application effort', weight: 10, score: effortScore, note: u ? `${u.boardLabel} (${applicationEffort})` : 'unknown board' });

  // ── Risk penalty (subtractive) ────────────────────────────────────
  let riskPenalty = 0;
  if (a && a.riskFlags.length) {
    riskPenalty = Math.min(20, a.riskFlags.length * 5);
    breakdown.push({ label: 'Risk flags', weight: 0, score: -riskPenalty, note: `${a.riskFlags.length} flag${a.riskFlags.length === 1 ? '' : 's'}` });
  }

  // ── Composite ──────────────────────────────────────────────────────
  const weightedSum = breakdown
    .filter(b => b.weight > 0)
    .reduce((acc, b) => acc + (b.score * b.weight), 0);
  const totalWeight = breakdown.filter(b => b.weight > 0).reduce((a, b) => a + b.weight, 0);
  const total = clamp(Math.round((weightedSum / totalWeight) - riskPenalty));

  // Confidence: high if JD provided AND ≥4 angle signals AND ≥3 strength matches.
  let confidence: OpportunityScore['confidence'] = 'low';
  if (a) {
    const sigCount = a.rankedAngles[0]?.score ?? 0;
    if (sigCount >= 4 && a.matchedStrengths.length >= 3) confidence = 'high';
    else if (sigCount >= 2 || a.matchedStrengths.length >= 2) confidence = 'medium';
  }

  // Priority: 1 ≥75, 2 ≥50, 3 <50
  const priority: 1 | 2 | 3 = total >= 75 ? 1 : total >= 50 ? 2 : 3;

  // Suggested message type
  let suggestedMessageType: OpportunityScore['suggestedMessageType'] = 'cover-letter';
  if (u?.board === 'linkedin') suggestedMessageType = 'connect-note';
  else if (u?.board === 'greenhouse' || u?.board === 'lever' || u?.board === 'company-site') suggestedMessageType = 'cover-letter';
  // Could also flip to 'recruiter-dm' if a recruiter contact appears in the JD,
  // but that's hard to reliably detect — leave manual.

  // Recommended action
  let recommendedAction = '';
  if (total >= 75) recommendedAction = 'Apply this week. Tailor the cover letter and reach out on LinkedIn if you can find a recruiter.';
  else if (total >= 60) recommendedAction = 'Worth applying. Lead with the angle below; address gaps in the cover letter.';
  else if (total >= 45) recommendedAction = 'Marginal. Apply only if other signals (referral, team) are positive.';
  else recommendedAction = 'Probably skip. Score is low across role, skills, and seniority match.';

  return {
    total,
    confidence,
    priority,
    breakdown,
    topStrengths,
    gaps,
    suggestedAngleId,
    suggestedAngleLabel,
    suggestedMessageType,
    recommendedAction,
    applicationEffort,
  };
}
