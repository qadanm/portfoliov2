// Packet builder orchestrator. Pulls together angle selection, resume tailoring,
// drafts, ATS detection, ghost-risk scoring, field mapping, and the checklist.
//
// Two entry points:
//   buildPacket(jobId)          → fresh packet (uses heuristics only)
//   rebuildPacketScores(packet) → recompute scores+warnings after user edits
//
// Drafts are written into the packet AND captured in `packet.baseline` so
// the effort score can diff edits against the original auto-generated text.

import {
  packetsStore,
  vaultStore,
  jobsStore,
  type ApplicationPacket,
  type Job,
  type ProfileVault,
  type PacketWarnings,
} from '../storage';

import { selectAngle } from './angle-selector';
import { tailorResume, selectionToText } from './resume-tailor';
import { draftCoverLetter } from './cover-letter';
import { draftShortAnswers } from './short-answers';
import { draftRecruiterDm, draftFollowUp } from './recruiter-msgs';
import { summarizeJD, extractJdKeywords } from './jd-summarize';
import { detectGhostRisk } from './ghost-detect';
import { scorePacket } from './quality-score';
import { authenticityScore } from './authenticity';
import { buildFieldMap } from './field-map';

import { detectAts } from '../ats/detect';
import { playbookFor } from '../ats/playbooks';
import { buildChecklist } from '../ats/checklists';

function rid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function jdAwareKicker(angleId: string, job: Job, themes: string[]): string {
  const company = (job.company ?? 'your team').trim();
  const role = (job.role ?? 'role').trim();
  if (themes.length === 0) {
    return `Targeting ${company}'s ${role} role.`;
  }
  // Pick the 1–2 most concrete themes
  const t = themes.slice(0, 2).filter(Boolean);
  return `Targeting ${company}'s ${role} role, drawing on ${t.join(' and ')}.`;
}

function workArrangementConflict(job: Job, vault: ProfileVault): string[] {
  const out: string[] = [];
  const loc = (job.location ?? '').toLowerCase();
  if (vault.remoteOnly) {
    if (loc.includes('onsite') || loc.includes('in office') || loc.includes('on-site')) {
      out.push(`You set remote-only; this role looks onsite (${job.location})`);
    } else if (loc.includes('hybrid') && !vault.willingToRelocate) {
      out.push(`You set remote-only; this role is hybrid (${job.location})`);
    }
  }
  return out;
}

function salaryConflicts(job: Job, vault: ProfileVault): string[] {
  const out: string[] = [];
  if (vault.salaryMin && job.salaryMax && job.salaryMax < vault.salaryMin) {
    out.push(`Posted max ($${Math.round(job.salaryMax / 1000)}k) is below your target floor ($${Math.round(vault.salaryMin / 1000)}k)`);
  }
  return out;
}

export function buildPacket(jobId: string, forcedAngleId?: string): ApplicationPacket | null {
  const job = jobsStore.get(jobId);
  if (!job) return null;
  const vault = vaultStore.get();

  // 1. Angle — auto recommendation unless the caller forces one (C9: a
  // forced angle must drive the DRAFTS, not just the label).
  const rec = selectAngle(job);
  const angleId = forcedAngleId ?? rec.angleId;

  // 2. Resume selection
  const selection = tailorResume({ angleId, jdText: job.jdText });

  // 3. JD summary + theme keywords
  const summary = summarizeJD(job.jdText, job.role, job.company);
  const jdKeywords = extractJdKeywords(job.jdText);

  // 4. Drafts (heuristic baselines)
  const coverLetter = draftCoverLetter({ job, vault, angleId });
  const shortAns = draftShortAnswers({ job, vault, angleId });
  const recruiterDm = draftRecruiterDm({ job, vault, angleId });
  const followUp = draftFollowUp({ job, vault, angleId });
  const summaryKicker = jdAwareKicker(angleId, job, jdKeywords);

  // 5. ATS detection + playbook
  const atsType = detectAts(job.url, job.jdText);
  const playbook = playbookFor(atsType);

  // 6. Ghost risk
  const ghost = detectGhostRisk(job, jobsStore.list());

  // 7. Portfolio mentions: top project ids by emphasis
  const portfolioMentions = selection.projectIds.slice(0, 2);

  // 8. Construct packet shell so we can run scoring (which needs the
  // populated text fields).
  const packet: ApplicationPacket = {
    id: rid(),
    jobId,
    resumeAngleId: angleId,
    recommendedAngleReason: forcedAngleId && forcedAngleId !== rec.angleId
      ? `Angle set manually (auto pick was ${rec.angleId}).`
      : rec.reason,
    resumeSelection: selection,
    summaryKicker,
    coverLetter,
    whyRoleAnswer: shortAns.whyRole,
    whyCompanyAnswer: shortAns.whyCompany,
    tellMeAboutYourself: shortAns.tellMeAboutYourself,
    salaryGuidance: shortAns.salary,
    portfolioMentions,
    recruiterDm,
    followUpMessage: followUp,
    jdSummary: summary.text,
    scores: { fit: job.fitScore ?? 0, quality: 0, authenticity: 0, effort: 0, callback: 'weak' },
    warnings: { missingKeywords: [], redFlags: [], authenticityConcerns: [], ghostFlags: ghost.reasons, salaryConflicts: salaryConflicts(job, vault), workArrangementConflicts: workArrangementConflict(job, vault) },
    ghostRisk: ghost.risk,
    ghostReasons: ghost.reasons,
    fieldMap: [],
    status: 'draft',
    applyMode: 'guided',
    atsType,
    atsFrictionScore: playbook.friction,
    estimatedMinutes: playbook.estimatedMinutes,
    checklist: buildChecklist(atsType),
    llmUsed: [],
    baseline: {
      coverLetter,
      whyRoleAnswer: shortAns.whyRole,
      whyCompanyAnswer: shortAns.whyCompany,
      summaryKicker,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // 9. Field map (depends on packet content)
  packet.fieldMap = buildFieldMap(packet, vault, job, atsType);

  // 10. Final scoring + warnings refresh
  return rebuildPacketScores(packet, job, vault);
}

// Recompute scores + warnings without regenerating drafts. Called whenever
// the user edits a packet field.
export function rebuildPacketScores(
  packet: ApplicationPacket,
  job?: Job,
  vault?: ProfileVault,
): ApplicationPacket {
  const j = job ?? jobsStore.get(packet.jobId);
  if (!j) return packet;
  const v = vault ?? vaultStore.get();

  // Whitelist context: company + role names that are legitimate to reference
  // even if not in resume vocab.
  const whitelist = [
    j.company ?? '',
    j.role ?? '',
    ...((j.location ?? '').split(/[\s,]+/)),
  ].filter(s => s && s.length >= 2);

  // Re-evaluate scores
  packet.scores = scorePacket(packet, j, whitelist);

  // Refresh warnings (combined-text authenticity + missing keywords)
  const combinedText = [
    packet.coverLetter,
    packet.whyRoleAnswer,
    packet.whyCompanyAnswer,
    packet.tellMeAboutYourself,
    packet.summaryKicker,
    packet.recruiterDm,
    packet.followUpMessage,
  ].filter(Boolean).join('\n\n');
  const auth = authenticityScore(combinedText, whitelist);

  // Missing keywords: JD-extracted keywords not mentioned anywhere in
  // packet drafts.
  const jdKeys = extractJdKeywords(j.jdText);
  const allText = combinedText.toLowerCase();
  const missing = jdKeys.filter(k => !allText.includes(k.toLowerCase())).slice(0, 8);

  packet.warnings = {
    missingKeywords: missing,
    redFlags: auth.redFlags,
    authenticityConcerns: auth.authenticityConcerns,
    ghostFlags: packet.ghostReasons ?? [],
    salaryConflicts: salaryConflicts(j, v),
    workArrangementConflicts: workArrangementConflict(j, v),
  };

  // Recompute field map in case packet content changed
  packet.fieldMap = buildFieldMap(packet, v, j, packet.atsType);

  packet.updatedAt = Date.now();
  return packet;
}

// Save a packet through the store, with score refresh first.
export function persistPacket(packet: ApplicationPacket): ApplicationPacket {
  const fresh = rebuildPacketScores(packet);
  packetsStore.upsert(fresh);
  return fresh;
}

// Resolve-or-build helper used by /today and /packet pages.
export function getOrBuildPacket(jobId: string): ApplicationPacket | null {
  const existing = packetsStore.byJobId(jobId);
  if (existing) return existing;
  const built = buildPacket(jobId);
  if (built) packetsStore.upsert(built);
  return built;
}

// Force rebuild (e.g., after user changes angle).
export function rebuildPacketDrafts(packetId: string, opts?: { angleId?: string }): ApplicationPacket | null {
  const existing = packetsStore.get(packetId);
  if (!existing) return null;
  const job = jobsStore.get(existing.jobId);
  if (!job) return existing;
  // Thread the forced angle through the build so the DRAFTS are generated
  // for the chosen angle — relabelling resumeAngleId afterwards left the
  // copy mismatched with the angle (C9).
  const fresh = buildPacket(existing.jobId, opts?.angleId);
  if (!fresh) return existing;
  // Preserve user-applied state we should NOT regenerate
  fresh.id = existing.id;
  fresh.createdAt = existing.createdAt;
  fresh.status = existing.status === 'submitted' ? 'submitted' : 'draft';
  fresh.submittedAt = existing.submittedAt;
  fresh.applyMode = existing.applyMode;
  // Merge checklist completion
  for (const item of fresh.checklist) {
    const prior = existing.checklist.find(p => p.label === item.label);
    if (prior) { item.done = prior.done; item.doneAt = prior.doneAt; }
  }
  packetsStore.upsert(fresh);
  return fresh;
}
