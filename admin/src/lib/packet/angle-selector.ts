// Pick the best resume angle for a job using the existing JD analyzer.
// No LLM. Returns the angle id + a short, factual reason.
//
// Scoring: the job TITLE is the strongest signal a posting carries about
// what the team thinks the role is, so title hits are weighted 3x over
// JD-body hits. When the combined evidence is thin or two angles are
// nearly tied, the recommendation says so out loud instead of projecting
// false confidence.

import { analyzeJD, ANGLE_SIGNALS } from '../analyzer';
import { angleById, angles } from '@/data/angles';
import type { Job } from '../storage';

export interface AngleRecommendation {
  angleId: string;
  reason: string;
  // Top 3 ranked angles with scores, for "consider another angle" UI.
  alternates: { angleId: string; label: string; score: number; matchedSignals: string[] }[];
}

const TITLE_WEIGHT = 3;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Word-boundary hits of an angle's signals against the job title, plus a
// bonus when the title contains the angle's exact label. Hits are weighted
// by word count: "senior product designer" must beat the "product designer"
// it contains — the longer phrase is the more specific claim.
function titleScoreFor(angleId: string, roleLower: string): { score: number; hits: string[] } {
  if (!roleLower) return { score: 0, hits: [] };
  const hits: string[] = [];
  let score = 0;
  for (const sig of ANGLE_SIGNALS[angleId] ?? []) {
    const re = new RegExp(`\\b${escapeRegExp(sig)}\\b`);
    if (re.test(roleLower)) {
      hits.push(sig);
      score += sig.split(/\s+/).length;
    }
  }
  const label = angleById(angleId)?.label.toLowerCase();
  if (label && roleLower.includes(label)) score += 2;
  return { score, hits };
}

function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z][a-z0-9.+#-]*/g) ?? [];
}

export function selectAngle(job: Job): AngleRecommendation {
  const jd = (job.jdText ?? '').trim();
  const roleLower = (job.role ?? '').toLowerCase();

  // Fallback: no usable JD — score angles by token overlap with the title.
  // Token overlap beats substring matching for compound titles: "Design
  // Engineer, Design Systems" prefers design-systems-engineer over
  // design-engineer because more of its label tokens appear.
  if (jd.length < 50) {
    const roleTokens = new Set(tokenize(roleLower));
    const matched = angles
      .map(a => {
        const labelTokens = tokenize(a.label);
        const overlap = labelTokens.filter(t => roleTokens.has(t)).length;
        const full = overlap === labelTokens.length && labelTokens.length > 0;
        return { a, score: full ? labelTokens.length + 3 : overlap };
      })
      .sort((x, y) => y.score - x.score);
    const top = matched[0];
    return {
      angleId: top.score > 0 ? top.a.id : 'ux-engineer',
      reason: top.score > 0
        ? `Role title "${job.role}" matches angle "${top.a.label}" (no JD text; title-only pick)`
        : 'Default: UX Engineer (no JD text to analyze)',
      alternates: matched.slice(0, 3).map(m => ({
        angleId: m.a.id,
        label: m.a.label,
        score: m.score,
        matchedSignals: [],
      })),
    };
  }

  const analysis = analyzeJD(jd);
  if (!analysis) {
    return {
      angleId: 'ux-engineer',
      reason: 'JD too short to analyze; defaulting to UX Engineer',
      alternates: [],
    };
  }

  // Combine body evidence with title evidence; title dominates.
  const scored = analysis.rankedAngles.map(r => {
    const title = titleScoreFor(r.angle.id, roleLower);
    return {
      angle: r.angle,
      bodyScore: r.score,
      titleScore: title.score,
      combined: r.score + TITLE_WEIGHT * title.score,
      matchedSignals: [
        ...title.hits.map(h => `title:"${h}"`),
        ...r.matchedSignals,
      ],
    };
  }).sort((a, b) =>
    b.combined - a.combined
    || b.titleScore - a.titleScore
    || angles.findIndex(x => x.id === a.angle.id) - angles.findIndex(x => x.id === b.angle.id),
  );

  const top = scored[0];
  const runnerUp = scored[1];
  const uncertain = top.combined < 3 || (runnerUp && top.combined - runnerUp.combined < 2);

  const matched = top.matchedSignals.slice(0, 4);
  const reasonParts: string[] = [];
  if (matched.length > 0) {
    reasonParts.push(`Matched signals: ${matched.join(', ')}`);
  }
  if (analysis.seniorityHint && analysis.seniorityHint !== 'unclear') {
    reasonParts.push(`seniority hint: ${analysis.seniorityHint}`);
  }
  if (analysis.remoteSignal !== 'unclear') {
    reasonParts.push(`arrangement: ${analysis.remoteSignal}`);
  }
  const reason = reasonParts.join(' · ') || `Top match: ${top.angle.label}`;

  return {
    angleId: top.angle.id,
    reason: uncertain ? `Low confidence — review alternates. ${reason}` : reason,
    alternates: scored.slice(0, 3).map(r => ({
      angleId: r.angle.id,
      label: r.angle.label,
      score: r.combined,
      matchedSignals: r.matchedSignals,
    })),
  };
}

export function angleLabel(angleId: string): string {
  return angleById(angleId)?.label ?? angleId;
}
