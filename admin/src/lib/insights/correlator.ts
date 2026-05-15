// Insights correlator: pure stats over jobs, packets, and outcomes.
// Used by /insights to render the conversion dashboard.
//
// No LLM, no inference — just correlations the user can read directly.

import {
  jobsStore,
  packetsStore,
  outcomesStore,
  type ApplicationPacket,
  type Job,
  type JobOutcome,
  type OutcomeKind,
} from '../storage';
import { angleById } from '@/data/angles';

export interface InsightsBundle {
  funnel: FunnelStage[];
  byAngle: AngleStat[];
  bySource: SourceStat[];
  byAts: AtsStat[];
  ghostingCompanies: GhostStat[];
  qualityCorrelation: { label: string; value: number }[];
  spamCheck: SpamCheck;
  totalApplied: number;
  totalCallbacks: number;
  callbackRate: number;
}

export interface FunnelStage {
  kind: OutcomeKind;
  label: string;
  count: number;
  pctOfApplied: number;
}

export interface AngleStat {
  angleId: string;
  label: string;
  applied: number;
  callbacks: number;
  rate: number;
}

export interface SourceStat {
  source: string;
  applied: number;
  callbacks: number;
  rate: number;
}

export interface AtsStat {
  ats: string;
  applied: number;
  estMinutesSpent: number;
  callbacks: number;
  rate: number;
}

export interface GhostStat {
  company: string;
  appliedAt: number;
  daysWaiting: number;
}

export interface SpamCheck {
  appliedLast7Days: number;
  appliedToday: number;
  avgAuthenticityLast7: number;
  avgFitLast7: number;
  similarityWarn: boolean;
  similarityScore: number;
}

const FUNNEL_ORDER: OutcomeKind[] = [
  'applied',
  'recruiter-reply',
  'screening-invite',
  'screen-completed',
  'take-home',
  'onsite-loop',
  'offer',
];

const FUNNEL_LABELS: Record<OutcomeKind, string> = {
  'applied': 'Applied',
  'recruiter-reply': 'Recruiter reply',
  'screening-invite': 'Screen invited',
  'screen-completed': 'Screen done',
  'take-home': 'Take-home',
  'onsite-loop': 'Onsite/loop',
  'offer': 'Offer',
  'rejection': 'Rejection',
  'ghosted': 'Ghosted',
  'withdrew': 'Withdrew',
};

function jaccard(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length >= 4));
  const wb = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length >= 4));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  const union = wa.size + wb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function computeInsights(): InsightsBundle {
  const jobs = jobsStore.list();
  const packets = packetsStore.list();
  const outcomes = outcomesStore.list();

  const packetByJobId = new Map<string, ApplicationPacket>();
  for (const p of packets) {
    const existing = packetByJobId.get(p.jobId);
    if (!existing || p.updatedAt > existing.updatedAt) packetByJobId.set(p.jobId, p);
  }

  const jobsById = new Map(jobs.map(j => [j.id, j]));

  // Funnel
  const counts = new Map<OutcomeKind, number>();
  for (const o of outcomes) counts.set(o.kind, (counts.get(o.kind) ?? 0) + 1);
  const appliedCount = counts.get('applied') ?? 0;
  const funnel: FunnelStage[] = FUNNEL_ORDER.map(kind => ({
    kind,
    label: FUNNEL_LABELS[kind],
    count: counts.get(kind) ?? 0,
    pctOfApplied: appliedCount ? Math.round(((counts.get(kind) ?? 0) / appliedCount) * 100) : 0,
  }));

  // By angle
  const angleMap = new Map<string, { applied: number; callbacks: number }>();
  for (const o of outcomes) {
    if (o.kind !== 'applied' && o.kind !== 'recruiter-reply') continue;
    const packet = o.packetId ? packets.find(p => p.id === o.packetId) : packetByJobId.get(o.jobId);
    const angleId = packet?.resumeAngleId ?? jobsById.get(o.jobId)?.resumeAngle ?? 'unknown';
    if (!angleMap.has(angleId)) angleMap.set(angleId, { applied: 0, callbacks: 0 });
    const a = angleMap.get(angleId)!;
    if (o.kind === 'applied') a.applied += 1;
    if (o.kind === 'recruiter-reply') a.callbacks += 1;
  }
  const byAngle: AngleStat[] = [...angleMap.entries()].map(([id, s]) => ({
    angleId: id,
    label: angleById(id)?.label ?? id,
    applied: s.applied,
    callbacks: s.callbacks,
    rate: s.applied ? Math.round((s.callbacks / s.applied) * 100) : 0,
  })).sort((a, b) => b.applied - a.applied);

  // By source
  const sourceMap = new Map<string, { applied: number; callbacks: number }>();
  for (const o of outcomes) {
    if (o.kind !== 'applied' && o.kind !== 'recruiter-reply') continue;
    const source = jobsById.get(o.jobId)?.source ?? 'unknown';
    if (!sourceMap.has(source)) sourceMap.set(source, { applied: 0, callbacks: 0 });
    const a = sourceMap.get(source)!;
    if (o.kind === 'applied') a.applied += 1;
    if (o.kind === 'recruiter-reply') a.callbacks += 1;
  }
  const bySource: SourceStat[] = [...sourceMap.entries()].map(([src, s]) => ({
    source: src,
    applied: s.applied,
    callbacks: s.callbacks,
    rate: s.applied ? Math.round((s.callbacks / s.applied) * 100) : 0,
  })).sort((a, b) => b.applied - a.applied);

  // By ATS
  const atsMap = new Map<string, { applied: number; estMinutesSpent: number; callbacks: number }>();
  for (const o of outcomes) {
    if (o.kind !== 'applied' && o.kind !== 'recruiter-reply') continue;
    const packet = packetByJobId.get(o.jobId);
    const ats = packet?.atsType ?? 'generic';
    if (!atsMap.has(ats)) atsMap.set(ats, { applied: 0, estMinutesSpent: 0, callbacks: 0 });
    const a = atsMap.get(ats)!;
    if (o.kind === 'applied') {
      a.applied += 1;
      a.estMinutesSpent += packet?.estimatedMinutes ?? 8;
    }
    if (o.kind === 'recruiter-reply') a.callbacks += 1;
  }
  const byAts: AtsStat[] = [...atsMap.entries()].map(([ats, s]) => ({
    ats,
    applied: s.applied,
    estMinutesSpent: s.estMinutesSpent,
    callbacks: s.callbacks,
    rate: s.applied ? Math.round((s.callbacks / s.applied) * 100) : 0,
  })).sort((a, b) => b.applied - a.applied);

  // Companies that ghosted: applied > 14 days ago, no recruiter-reply
  const repliesByJob = new Set<string>();
  for (const o of outcomes) if (o.kind === 'recruiter-reply') repliesByJob.add(o.jobId);
  const fourteenDaysAgo = Date.now() - 14 * 86400_000;
  const ghostingCompanies: GhostStat[] = outcomes
    .filter(o => o.kind === 'applied' && o.at < fourteenDaysAgo && !repliesByJob.has(o.jobId))
    .map(o => {
      const job = jobsById.get(o.jobId);
      return {
        company: job?.company ?? 'unknown',
        appliedAt: o.at,
        daysWaiting: Math.floor((Date.now() - o.at) / 86400_000),
      };
    })
    .sort((a, b) => b.daysWaiting - a.daysWaiting)
    .slice(0, 15);

  // Quality correlation: applied with packet quality bucket vs callback rate
  const qualityBuckets = new Map<string, { applied: number; callbacks: number }>([
    ['<50', { applied: 0, callbacks: 0 }],
    ['50–69', { applied: 0, callbacks: 0 }],
    ['70–84', { applied: 0, callbacks: 0 }],
    ['85+', { applied: 0, callbacks: 0 }],
  ]);
  const bucketOf = (q: number) => q < 50 ? '<50' : q < 70 ? '50–69' : q < 85 ? '70–84' : '85+';
  for (const o of outcomes) {
    if (o.kind !== 'applied' && o.kind !== 'recruiter-reply') continue;
    const packet = packetByJobId.get(o.jobId);
    const q = packet?.scores.quality ?? 0;
    const b = bucketOf(q);
    const bucket = qualityBuckets.get(b)!;
    if (o.kind === 'applied') bucket.applied += 1;
    if (o.kind === 'recruiter-reply') bucket.callbacks += 1;
  }
  const qualityCorrelation = [...qualityBuckets.entries()].map(([label, s]) => ({
    label: `Quality ${label}`,
    value: s.applied ? Math.round((s.callbacks / s.applied) * 100) : 0,
  }));

  // Spam check: last 7 days
  const sevenDaysAgo = Date.now() - 7 * 86400_000;
  const todayStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const recentAppliedOutcomes = outcomes.filter(o => o.kind === 'applied' && o.at >= sevenDaysAgo);
  const todayApplied = outcomes.filter(o => o.kind === 'applied' && o.at >= todayStart).length;
  const recentPackets = recentAppliedOutcomes
    .map(o => packetByJobId.get(o.jobId))
    .filter((p): p is ApplicationPacket => Boolean(p));
  const avgAuth = recentPackets.length
    ? Math.round(recentPackets.reduce((s, p) => s + (p.scores.authenticity ?? 0), 0) / recentPackets.length)
    : 0;
  const avgFit = recentPackets.length
    ? Math.round(recentPackets.reduce((s, p) => s + (p.scores.fit ?? 0), 0) / recentPackets.length)
    : 0;
  // Similarity: top 5 by recency, pairwise Jaccard
  const top5 = recentPackets.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  let maxSim = 0;
  for (let i = 0; i < top5.length; i++) {
    for (let j = i + 1; j < top5.length; j++) {
      const sim = jaccard(top5[i].coverLetter ?? '', top5[j].coverLetter ?? '');
      if (sim > maxSim) maxSim = sim;
    }
  }

  const callbackCount = (counts.get('recruiter-reply') ?? 0) + (counts.get('screening-invite') ?? 0);

  return {
    funnel,
    byAngle,
    bySource,
    byAts,
    ghostingCompanies,
    qualityCorrelation,
    spamCheck: {
      appliedLast7Days: recentAppliedOutcomes.length,
      appliedToday: todayApplied,
      avgAuthenticityLast7: avgAuth,
      avgFitLast7: avgFit,
      similarityWarn: maxSim >= 0.8,
      similarityScore: Math.round(maxSim * 100),
    },
    totalApplied: appliedCount,
    totalCallbacks: callbackCount,
    callbackRate: appliedCount ? Math.round((callbackCount / appliedCount) * 100) : 0,
  };
}

// Counts for today's banner in /today
export function appliedToday(): number {
  const todayStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  return outcomesStore.list().filter(o => o.kind === 'applied' && o.at >= todayStart).length;
}

// Avg authenticity for jobs applied today (for the /today guardrail banner)
export function avgAuthenticityToday(): number {
  const todayStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const todayApplied = outcomesStore.list().filter(o => o.kind === 'applied' && o.at >= todayStart);
  if (todayApplied.length === 0) return 0;
  const packets = packetsStore.list();
  const matched: number[] = [];
  for (const o of todayApplied) {
    const p = packets.find(p => p.jobId === o.jobId);
    if (p) matched.push(p.scores.authenticity ?? 0);
  }
  return matched.length ? Math.round(matched.reduce((s, n) => s + n, 0) / matched.length) : 0;
}
