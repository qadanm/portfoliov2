// Outcome tracking helpers. Thin wrapper over outcomesStore with convenience
// methods used by the Apply Session "Mark applied" flow and the jobs page.

import {
  outcomesStore,
  jobsStore,
  type JobOutcome,
  type OutcomeKind,
  type ApplicationPacket,
  type Job,
} from '../storage';

function rid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

export function recordOutcome(jobId: string, kind: OutcomeKind, opts?: {
  packetId?: string;
  note?: string;
  recruiterId?: string;
  at?: number;
}): JobOutcome {
  const o: JobOutcome = {
    id: rid(),
    jobId,
    packetId: opts?.packetId,
    kind,
    at: opts?.at ?? Date.now(),
    note: opts?.note,
    recruiterId: opts?.recruiterId,
    updatedAt: Date.now(),
  };
  outcomesStore.upsert(o);
  return o;
}

export function outcomesByJob(jobId: string): JobOutcome[] {
  return outcomesStore.byJobId(jobId);
}

// Bundled "Mark applied" action: set job.status, set dateApplied, schedule
// follow-up (+7 days), record outcome.
export function markApplied(job: Job, packet?: ApplicationPacket): JobOutcome {
  const now = Date.now();
  const followUpDate = job.followUpDate ?? (now + 7 * 86400_000);
  const updated: Job = {
    ...job,
    status: 'Applied',
    dateApplied: job.dateApplied ?? now,
    followUpDate,
    updatedAt: now,
  };
  if (packet) {
    updated.resumeAngle = packet.resumeAngleId;
  }
  jobsStore.upsert(updated);
  return recordOutcome(job.id, 'applied', {
    packetId: packet?.id,
    at: now,
  });
}
