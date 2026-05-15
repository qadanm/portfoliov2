// Pick the best resume angle for a job using the existing JD analyzer.
// No LLM. Returns the angle id + a short, factual reason.

import { analyzeJD } from '../analyzer';
import { angleById, angles } from '@/data/angles';
import type { Job } from '../storage';

export interface AngleRecommendation {
  angleId: string;
  reason: string;
  // Top 3 ranked angles with scores, for "consider another angle" UI.
  alternates: { angleId: string; label: string; score: number; matchedSignals: string[] }[];
}

export function selectAngle(job: Job): AngleRecommendation {
  const jd = (job.jdText ?? '').trim();
  // Fallback: use job.role to score against angle.label if no JD text
  if (jd.length < 50) {
    const role = (job.role ?? '').toLowerCase();
    const matched = angles
      .map(a => ({
        a,
        score: role.includes(a.label.toLowerCase()) ? 2
             : role.includes(a.shortLabel.toLowerCase()) ? 1
             : 0,
      }))
      .sort((x, y) => y.score - x.score);
    const top = matched[0];
    return {
      angleId: top.score > 0 ? top.a.id : 'ux-engineer',
      reason: top.score > 0
        ? `Role title "${job.role}" matches angle "${top.a.label}"`
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

  const top = analysis.rankedAngles[0];
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

  return {
    angleId: top.angle.id,
    reason: reasonParts.join(' · ') || `Top match: ${top.angle.label}`,
    alternates: analysis.rankedAngles.slice(0, 3).map(r => ({
      angleId: r.angle.id,
      label: r.angle.label,
      score: r.score,
      matchedSignals: r.matchedSignals,
    })),
  };
}

export function angleLabel(angleId: string): string {
  return angleById(angleId)?.label ?? angleId;
}
