// Reliability scoring per ATS, derived from past 30 days of attempts.
// Pure, no side effects.

import { attemptsStore, type AtsType, type ApplyAttempt } from '../storage';
import { atsLabel } from '../ats/detect';

export type ReliabilityTier = 'reliable' | 'needs-attention' | 'unstable' | 'no-data';

export interface AtsReliability {
  ats: AtsType;
  label: string;
  total: number;
  submitted: number;
  needsReview: number;
  blocked: number;
  failed: number;
  // Submit-ready = submitted OR (paused at user-paused for dry-run reasons).
  // We treat reaching the submit page successfully under L2 as a positive.
  submitReady: number;
  fillSuccessRate: number;     // % of attempts that filled ≥1 safe field
  uploadSuccessRate: number | null; // % of attempts whose log had a successful upload event; null = no uploads attempted (n/a)
  textareaSuccessRate: number; // % of attempts that filled ≥1 packet textarea
  unknownFieldRate: number;    // % of attempts that paused on unknown-required-field
  blockerRate: number;         // % of attempts that ended needs-review/blocked/failed
  submitReadyRate: number;     // overall headline number used for the tier
  tier: ReliabilityTier;
}

const WINDOW_DAYS = 30;

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function tierFor(submitReadyRate: number, total: number): ReliabilityTier {
  if (total < 3) return 'no-data';
  if (submitReadyRate >= 75) return 'reliable';
  if (submitReadyRate >= 45) return 'needs-attention';
  return 'unstable';
}

// Coarse signal — do the saved attempt step events contain any 'fields-filled' / 'upload' marker?
function attemptFilledSomething(a: ApplyAttempt): boolean {
  if (a.filledFields && a.filledFields.length > 0) return true;
  return (a.steps ?? []).some(s => s.kind === 'attempt-fields-filled');
}
function attemptHadUploadSuccess(a: ApplyAttempt): boolean {
  return (a.steps ?? []).some(s =>
    s.kind === 'attempt-fields-filled' && /Resume uploaded/.test(s.message)
  );
}
function attemptHadUploadAttempt(a: ApplyAttempt): boolean {
  return (a.steps ?? []).some(s =>
    s.kind === 'attempt-fields-filled' && /Resume upload/.test(s.message)
  );
}
function attemptFilledPacketTextarea(a: ApplyAttempt): boolean {
  const packetKeys = ['coverLetterText', 'whyRole', 'whyCompany', 'tellMeAboutYourself'];
  return (a.filledFields ?? []).some(k => packetKeys.includes(k));
}
function attemptHitUnknownField(a: ApplyAttempt): boolean {
  return a.blockReason === 'unknown-required-field';
}

export function reliabilityForAts(ats: AtsType): AtsReliability {
  const cutoff = Date.now() - WINDOW_DAYS * 86400_000;
  const all = attemptsStore.list().filter(a => a.atsType === ats && a.startedAt >= cutoff);
  const total = all.length;
  const submitted = all.filter(a => a.status === 'submitted').length;
  const needsReview = all.filter(a => a.status === 'needs-review' || a.status === 'paused').length;
  const blocked = all.filter(a => a.status === 'blocked' || a.status === 'unsupported').length;
  const failed = all.filter(a => a.status === 'failed').length;

  // Submit-ready: actual submit + reaching the submit page under dry-run/L2.
  // The L2 pause message is "Level 2 — ready to submit…", which /dry/ alone
  // missed — every L2 success was counted as a failure (C21).
  const dryRunReached = all.filter(a =>
    a.status === 'needs-review' &&
    a.blockReason === 'user-paused' &&
    /dry|ready to submit/i.test(a.blockNote || '')).length;
  const submitReady = submitted + dryRunReached;

  const fillSuccess = all.filter(attemptFilledSomething).length;
  const uploadAttempts = all.filter(attemptHadUploadAttempt).length;
  const uploadOk = all.filter(attemptHadUploadSuccess).length;
  const textareaOk = all.filter(attemptFilledPacketTextarea).length;
  const unknownFields = all.filter(attemptHitUnknownField).length;
  const anyBlocker = all.filter(a => a.status === 'needs-review' || a.status === 'paused' || a.status === 'blocked' || a.status === 'failed').length;

  const submitReadyRate = pct(submitReady, total);
  return {
    ats,
    label: atsLabel(ats),
    total,
    submitted,
    needsReview,
    blocked,
    failed,
    submitReady,
    fillSuccessRate: pct(fillSuccess, total),
    // null = no uploads attempted; rendering 0% would understate reliability.
    uploadSuccessRate: uploadAttempts === 0 ? null : pct(uploadOk, uploadAttempts),
    textareaSuccessRate: pct(textareaOk, total),
    unknownFieldRate: pct(unknownFields, total),
    blockerRate: pct(anyBlocker, total),
    submitReadyRate,
    tier: tierFor(submitReadyRate, total),
  };
}

const ALL_ATS: AtsType[] = ['ashby', 'greenhouse', 'lever', 'smartrecruiters', 'linkedin-easy', 'workday', 'generic'];

export function reliabilityAll(): AtsReliability[] {
  return ALL_ATS.map(reliabilityForAts).sort((a, b) => b.submitReadyRate - a.submitReadyRate);
}

export function tierColor(tier: ReliabilityTier): string {
  switch (tier) {
    case 'reliable': return 'var(--c-success)';
    case 'needs-attention': return 'var(--c-accent)';
    case 'unstable': return '#F87171';
    case 'no-data': return 'var(--c-text-subtle)';
  }
}
