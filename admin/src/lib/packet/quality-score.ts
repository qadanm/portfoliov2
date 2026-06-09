// Packet quality / fit / authenticity / effort / callback scoring.
// Pure functions. No state, no LLM calls.

import type { ApplicationPacket, Job, PacketScores, CallbackStrength } from '../storage';
import { authenticityScore } from './authenticity';

// Literal template placeholders (e.g. "[add one concrete observation
// here — …]"). A field still carrying one is NOT filled (C5).
const PLACEHOLDER_RE = /\[[^\]]{4,}\]/;

// Counts non-trivial generated fields. "Non-trivial" = > 40 chars or contains
// 5+ words, with no unfilled bracket placeholder. Salary/portfolio mentions
// don't need length.
function countFilledFields(p: ApplicationPacket): number {
  let n = 0;
  const trivial = (s: string) =>
    !s || PLACEHOLDER_RE.test(s) || (s.trim().length < 40 && s.trim().split(/\s+/).length < 5);
  const filledShort = (s: string | undefined) =>
    !!s && s.trim().length > 0 && !PLACEHOLDER_RE.test(s);
  if (!trivial(p.coverLetter)) n++;
  if (!trivial(p.whyRoleAnswer)) n++;
  if (!trivial(p.whyCompanyAnswer)) n++;
  if (!trivial(p.tellMeAboutYourself)) n++;
  if (filledShort(p.summaryKicker)) n++;
  if (filledShort(p.jdSummary)) n++;
  if (filledShort(p.recruiterDm)) n++;
  if (filledShort(p.salaryGuidance)) n++;
  if (p.portfolioMentions && p.portfolioMentions.length > 0) n++;
  if (p.resumeSelection?.projectIds?.length > 0) n++;
  return n;
}

// Character-distance count between two strings. Cheap proxy for "edit effort".
function editDistanceCheap(a: string, b: string): number {
  if (!a || !b) return Math.abs((a?.length ?? 0) - (b?.length ?? 0));
  if (a === b) return 0;
  // Don't run full Levenshtein on long text — for "effort" estimate the
  // absolute size delta + a per-word changed estimate is more than enough.
  const sizeDelta = Math.abs(a.length - b.length);
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  let changed = 0;
  for (const w of wordsB) if (!wordsA.has(w)) changed++;
  for (const w of wordsA) if (!wordsB.has(w)) changed++;
  return sizeDelta + changed * 5;
}

export function packetEffortScore(p: ApplicationPacket): number {
  if (!p.baseline) return 0;
  let total = 0;
  total += editDistanceCheap(p.baseline.coverLetter ?? '', p.coverLetter ?? '');
  total += editDistanceCheap(p.baseline.whyRoleAnswer ?? '', p.whyRoleAnswer ?? '');
  total += editDistanceCheap(p.baseline.whyCompanyAnswer ?? '', p.whyCompanyAnswer ?? '');
  total += editDistanceCheap(p.baseline.summaryKicker ?? '', p.summaryKicker ?? '');
  // Saturate at 400 char-equivalents of edits.
  return Math.min(100, Math.round((total / 400) * 100));
}

export function packetCallbackBucket(fit: number, quality: number, authenticity: number): CallbackStrength {
  const composite = fit * 0.4 + quality * 0.3 + authenticity * 0.3;
  if (composite >= 75) return 'strong';
  if (composite >= 55) return 'moderate';
  return 'weak';
}

export function scorePacket(
  packet: ApplicationPacket,
  job: Job,
  contextWhitelist: string[] = [],
): PacketScores {
  const fit = Math.round(job.fitScore ?? 0);

  // Quality: how complete + how substantial
  const filled = countFilledFields(packet);
  const avgLen = (
    (packet.coverLetter?.length ?? 0) +
    (packet.whyRoleAnswer?.length ?? 0) +
    (packet.whyCompanyAnswer?.length ?? 0) +
    (packet.jdSummary?.length ?? 0)
  ) / 4;
  const lengthShare = Math.min(1, avgLen / 600); // 600 chars avg = full credit
  const quality = Math.round((filled / 10) * 60 + lengthShare * 40);

  // Authenticity: scan all generated text together
  const combinedText = [
    packet.coverLetter,
    packet.whyRoleAnswer,
    packet.whyCompanyAnswer,
    packet.tellMeAboutYourself,
    packet.summaryKicker,
    packet.recruiterDm,
    packet.followUpMessage,
  ].filter(Boolean).join('\n\n');

  const auth = authenticityScore(combinedText, contextWhitelist);

  const effort = packetEffortScore(packet);
  const callback = packetCallbackBucket(fit, quality, auth.score);

  return {
    fit,
    quality: Math.min(100, Math.max(0, quality)),
    authenticity: auth.score,
    effort,
    callback,
  };
}

// Convenience: extract just the warning lists from authenticity + ghost data.
export function packetWarningInputs(text: string, contextWhitelist: string[]): {
  redFlags: string[];
  authenticityConcerns: string[];
} {
  const a = authenticityScore(text, contextWhitelist);
  return {
    redFlags: a.redFlags,
    authenticityConcerns: a.authenticityConcerns,
  };
}
