// Safety gates for the autonomous agent. Pure functions, no side effects.
// Each gate returns `{ ok, reasons }`. When `ok === false`, the agent
// pauses or sends the attempt to needs-review and never proceeds to a
// destructive action (advance, submit).
//
// These are intentionally strict: prefer "send to review" over "guess and
// submit." Recruiters reject suspected AI applications at 49% — silent
// pause is always safer than a botched submit.

import {
  jobsStore,
  packetsStore,
  outcomesStore,
  ATS_TIER,
  type ApplyAttempt,
  type ApplySession,
  type ApplicationPacket,
  type Job,
  type AutonomyLevel,
  type AttemptBlockReason,
  type AtsType,
} from '../storage';

export interface GateResult {
  ok: boolean;
  reasons: string[];
  blockReason?: AttemptBlockReason;
}

const ok = (): GateResult => ({ ok: true, reasons: [] });
const block = (reason: AttemptBlockReason, ...msgs: string[]): GateResult =>
  ({ ok: false, reasons: msgs, blockReason: reason });

// ── Per-attempt gates ─────────────────────────────────────────────────

export function gateAtsSupported(atsType: AtsType, autonomyLevel: AutonomyLevel, session: ApplySession): GateResult {
  const tier = ATS_TIER[atsType];
  // Tier 1 supported for autonomy >= 2 (fill+advance)
  if (autonomyLevel < 2) return ok(); // Manual/fill-only allowed everywhere
  if (tier === 1) return ok();
  // Tier 2: SmartRec, LinkedIn. Allow fill + advance, but NOT auto-submit
  if (tier === 2) {
    if (autonomyLevel >= 3 && !session.settings.allowAutoSubmitTier2) {
      return block('unsupported-ats', `Auto-submit not allowed on Tier 2 ATS (${atsType}). Toggle in settings to enable.`);
    }
    return ok();
  }
  // Tier 3: Workday, Generic. Tier-3 must be guided.
  if (tier === 3) {
    if (autonomyLevel >= 3 && !session.settings.allowAutoSubmitTier3) {
      return block('unsupported-ats', `${atsType} is Tier 3 (high friction). Auto-submit disabled by default.`);
    }
    return ok();
  }
  return ok();
}

export function gatePacketReady(packet: ApplicationPacket | undefined): GateResult {
  if (!packet) return block('packet-not-ready', 'No packet built for this job.');
  if (packet.status !== 'ready' && packet.status !== 'in-progress' && packet.status !== 'draft') {
    return block('packet-not-ready', `Packet is ${packet.status}.`);
  }
  return ok();
}

export function gateScoreThresholds(
  packet: ApplicationPacket,
  session: ApplySession,
): GateResult {
  const s = session.settings;
  const reasons: string[] = [];
  if (packet.scores.fit < s.fitThreshold) {
    reasons.push(`Fit ${packet.scores.fit} < threshold ${s.fitThreshold}`);
  }
  if (packet.scores.authenticity < s.authenticityThreshold) {
    reasons.push(`Authenticity ${packet.scores.authenticity} < threshold ${s.authenticityThreshold}`);
  }
  if (packet.scores.quality < s.qualityThreshold) {
    reasons.push(`Quality ${packet.scores.quality} < threshold ${s.qualityThreshold}`);
  }
  if (reasons.length > 0) {
    // Distinguish fit vs authenticity for clearer block reasons.
    if (packet.scores.authenticity < s.authenticityThreshold) {
      return block('low-authenticity', ...reasons);
    }
    return block('low-fit', ...reasons);
  }
  return ok();
}

export function gateUnsupportedClaims(packet: ApplicationPacket): GateResult {
  if (packet.warnings.authenticityConcerns.length > 0) {
    return block('low-authenticity',
      `Unsupported claims in copy: ${packet.warnings.authenticityConcerns.slice(0, 4).join(', ')}`);
  }
  if (packet.warnings.redFlags.length >= 3) {
    return block('low-authenticity',
      `${packet.warnings.redFlags.length} AI red-flag phrases detected`);
  }
  return ok();
}

export function gateDuplicateApplication(jobId: string): GateResult {
  const outcomes = outcomesStore.byJobId(jobId);
  if (outcomes.some(o => o.kind === 'applied')) {
    return block('duplicate', 'Already marked Applied for this job.');
  }
  const job = jobsStore.get(jobId);
  if (job && job.dateApplied) {
    return block('duplicate', `Job has dateApplied set (${new Date(job.dateApplied).toLocaleDateString()}).`);
  }
  return ok();
}

export function gateDailyCap(session: ApplySession, _existingAttempts: ApplyAttempt[]): GateResult {
  const cap = session.settings.dailySubmitCap;
  // Count today's submitted outcomes across ALL sessions.
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const submittedToday = outcomesStore.list()
    .filter(o => o.kind === 'applied' && o.at >= todayStart.getTime()).length;
  if (submittedToday >= cap) {
    return block('over-cap', `Daily auto-submit cap reached (${submittedToday}/${cap}).`);
  }
  return ok();
}

export function gatePerSourceCap(job: Job, session: ApplySession): GateResult {
  const cap = session.settings.perSourceCap;
  if (!job.source) return ok();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const sameSource = outcomesStore.list().filter(o => {
    if (o.kind !== 'applied') return false;
    if (o.at < todayStart.getTime()) return false;
    const j = jobsStore.get(o.jobId);
    return j?.source === job.source;
  }).length;
  if (sameSource >= cap) {
    return block('over-cap', `Per-source cap reached for ${job.source} (${sameSource}/${cap}).`);
  }
  return ok();
}

export function gateAutoSubmitDenylist(jobId: string, session: ApplySession): GateResult {
  if (session.settings.autoSubmitDenylist.includes(jobId)) {
    return block('gates-failed', 'Job is on auto-submit denylist.');
  }
  return ok();
}

// ── Composite: can the agent proceed to fill/advance for this attempt? ─

export function gatesForFillAndAdvance(
  attempt: ApplyAttempt,
  session: ApplySession,
  packet?: ApplicationPacket,
): GateResult {
  const job = jobsStore.get(attempt.jobId);
  if (!job) return block('unknown', 'Job not found.');

  // Always check ATS support
  const atsGate = gateAtsSupported(attempt.atsType, attempt.autonomyLevel, session);
  if (!atsGate.ok) return atsGate;

  // Duplicate check
  const dup = gateDuplicateApplication(attempt.jobId);
  if (!dup.ok) return dup;

  // For autonomy >= 2 (advance), require packet
  if (attempt.autonomyLevel >= 2) {
    const pktGate = gatePacketReady(packet);
    if (!pktGate.ok) return pktGate;
  }

  return ok();
}

// ── Composite: can the agent SUBMIT this attempt? ─────────────────────
// Hard gates. ALL must pass.

export interface SubmitGateContext {
  attempt: ApplyAttempt;
  session: ApplySession;
  packet: ApplicationPacket | undefined;
  captchaPresent: boolean;
  loginPresent: boolean;
  unknownRequiredFields: number;
  demographicFieldsRequired: number;
  legalFieldsRequired: number;
  uploadFailed: boolean;
  pageError: boolean;
}

export function gatesForSubmit(ctx: SubmitGateContext): GateResult {
  const { attempt, session, packet } = ctx;

  // Autonomy must permit auto-submit
  if (attempt.autonomyLevel < 3) {
    return block('gates-failed', `Autonomy level ${attempt.autonomyLevel} does not allow auto-submit.`);
  }

  // Dry-run mode — fill + advance only, never click submit.
  if (session.settings.dryRun) {
    return block('user-paused', 'Dry-run is on — agent fills + advances but will not submit.');
  }

  // ATS must be allowed for auto-submit
  const tier = ATS_TIER[attempt.atsType];
  const tierAllowed =
    (tier === 1 && session.settings.allowAutoSubmitTier1) ||
    (tier === 2 && session.settings.allowAutoSubmitTier2) ||
    (tier === 3 && session.settings.allowAutoSubmitTier3);
  if (!tierAllowed) {
    return block('unsupported-ats', `Auto-submit disabled for Tier ${tier} ATS in session settings.`);
  }

  // Packet must exist + be ready
  if (!packet) return block('packet-not-ready', 'No packet.');
  // For auto-submit we require either "ready" or "in-progress" status.
  if (packet.status === 'archived' || packet.status === 'submitted') {
    return block('packet-not-ready', `Packet status is ${packet.status}.`);
  }

  // Score thresholds
  const scoreGate = gateScoreThresholds(packet, session);
  if (!scoreGate.ok) return scoreGate;

  // Authenticity / unsupported claims
  const claimGate = gateUnsupportedClaims(packet);
  if (!claimGate.ok) return claimGate;

  // Duplicate
  const dup = gateDuplicateApplication(attempt.jobId);
  if (!dup.ok) return dup;

  // Daily / per-source caps
  const dailyGate = gateDailyCap(session, []);
  if (!dailyGate.ok) return dailyGate;
  const job = jobsStore.get(attempt.jobId);
  if (job) {
    const sourceGate = gatePerSourceCap(job, session);
    if (!sourceGate.ok) return sourceGate;
  }

  // Denylist
  const denyGate = gateAutoSubmitDenylist(attempt.jobId, session);
  if (!denyGate.ok) return denyGate;

  // CAPTCHA / login / page error — hard blocks
  if (ctx.captchaPresent) return block('captcha', 'CAPTCHA detected — manual submit only.');
  if (ctx.loginPresent) return block('login-required', 'Login wall detected — manual submit only.');
  if (ctx.pageError) return block('page-error', 'Page is in an error state.');

  // Unresolved required fields
  if (ctx.unknownRequiredFields > 0) {
    return block('unknown-required-field', `${ctx.unknownRequiredFields} unknown required field(s).`);
  }
  if (ctx.demographicFieldsRequired > 0) {
    return block('demographic-required', `${ctx.demographicFieldsRequired} demographic field(s) required.`);
  }
  if (ctx.legalFieldsRequired > 0) {
    return block('legal-required', `${ctx.legalFieldsRequired} legal field(s) required.`);
  }
  if (ctx.uploadFailed) return block('upload-failed', 'Resume upload failed.');

  // Salary / work-auth ambiguity (signaled via packet warnings)
  if (packet.warnings.salaryConflicts.length > 0) {
    return block('salary-unresolved', packet.warnings.salaryConflicts.join(' · '));
  }
  if (packet.warnings.workArrangementConflicts.length > 0) {
    return block('work-auth-ambiguity', packet.warnings.workArrangementConflicts.join(' · '));
  }

  return ok();
}

// Friendly explanation for users
export function explainBlock(reason: AttemptBlockReason | undefined): string {
  switch (reason) {
    case 'captcha': return 'CAPTCHA on page — manual submit only.';
    case 'login-required': return 'Login required — sign in first, then resume.';
    case 'unknown-required-field': return 'A required field was not recognized — review and fill manually.';
    case 'demographic-required': return 'A demographic / EEOC field is required — answer manually if you choose.';
    case 'legal-required': return 'A legal attestation is required — review and submit manually.';
    case 'salary-unresolved': return 'Salary expectation conflicts with vault target.';
    case 'work-auth-ambiguity': return 'Work-authorization answer is not configured for autofill.';
    case 'upload-failed': return 'Resume upload could not be completed by the agent.';
    case 'unsupported-ats': return 'This ATS is not supported for the requested autonomy level.';
    case 'page-error': return 'The application page is in an error state.';
    case 'packet-not-ready': return 'Packet is not ready — open and finish it first.';
    case 'low-authenticity': return 'Authenticity score is below threshold or unsupported claims detected.';
    case 'low-fit': return 'Fit score is below threshold for auto-submit.';
    case 'duplicate': return 'You have already applied to this job.';
    case 'gates-failed': return 'Auto-submit gates not satisfied.';
    case 'page-changed': return 'The page changed unexpectedly between fill and submit.';
    case 'user-paused': return 'Paused by user.';
    case 'over-cap': return 'Daily or per-source auto-submit cap reached.';
    case 'unknown': default: return 'Needs review.';
  }
}
