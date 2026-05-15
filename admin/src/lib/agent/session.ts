// Agent session lifecycle helpers. Pure functions over the stores.
// The admin UI calls these to start/stop/pause/resume sessions and create
// per-job attempts. The extension reads/writes attempt state through the
// same stores via the admin-bridge (see extension/admin-bridge.js).

import {
  sessionsStore,
  attemptsStore,
  packetsStore,
  jobsStore,
  applySettingsStore,
  SESSION_SETTINGS_DEFAULTS,
  ATS_TIER,
  type ApplySession,
  type ApplyAttempt,
  type ApplySessionSettings,
  type AutonomyLevel,
  type AttemptStatus,
  type AttemptBlockReason,
  type AtsType,
  type Job,
} from '../storage';
import { detectAts } from '../ats/detect';
import { getOrBuildPacket } from '../packet/builder';
import { appendLog } from './runlog';
import { gatesForFillAndAdvance } from './gates';

function rid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

export interface CreateSessionOptions {
  jobIds: string[];
  settingsOverride?: Partial<ApplySessionSettings>;
}

export function createSession(opts: CreateSessionOptions): ApplySession {
  const defaults = SESSION_SETTINGS_DEFAULTS;
  const merged: ApplySessionSettings = { ...defaults, ...(opts.settingsOverride ?? {}) };
  // Inherit some defaults from global apply settings if user has tuned them
  const global = applySettingsStore.get();
  merged.authenticityThreshold = opts.settingsOverride?.authenticityThreshold ?? global.authenticityThreshold ?? defaults.authenticityThreshold;
  merged.dailySubmitCap = opts.settingsOverride?.dailySubmitCap ?? global.dailyVolumeWarnAt ?? defaults.dailySubmitCap;

  const now = Date.now();
  const session: ApplySession = {
    id: rid(),
    startedAt: now,
    status: 'idle',
    settings: merged,
    jobIds: opts.jobIds.slice(),
    submittedCount: 0,
    reviewCount: 0,
    blockedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    updatedAt: now,
  };
  sessionsStore.upsert(session);
  appendLog({
    sessionId: session.id,
    kind: 'session-started',
    message: `Session created with ${opts.jobIds.length} jobs (autonomy: ${merged.autonomyLevel}).`,
    meta: { jobCount: opts.jobIds.length, autonomy: merged.autonomyLevel },
  });
  return session;
}

export function startSession(sessionId: string): ApplySession | null {
  const s = sessionsStore.get(sessionId);
  if (!s) return null;
  if (s.status === 'finished' || s.status === 'stopped') return s;
  s.status = 'running';
  s.startedAt = s.startedAt || Date.now();
  sessionsStore.upsert(s);

  // Eagerly create queued attempts for every jobId so the extension can pull them
  for (const jobId of s.jobIds) {
    const existing = attemptsStore.byJob(jobId).find(a => a.sessionId === s.id);
    if (existing) continue;
    createAttempt(s, jobId);
  }

  appendLog({
    sessionId: s.id,
    kind: 'session-started',
    message: 'Session started.',
  });
  return s;
}

export function pauseSession(sessionId: string): ApplySession | null {
  const s = sessionsStore.get(sessionId);
  if (!s) return null;
  if (s.status !== 'running') return s;
  s.status = 'paused';
  sessionsStore.upsert(s);
  appendLog({ sessionId, kind: 'session-paused', message: 'Session paused.' });
  return s;
}

export function resumeSession(sessionId: string): ApplySession | null {
  const s = sessionsStore.get(sessionId);
  if (!s) return null;
  if (s.status !== 'paused') return s;
  s.status = 'running';
  sessionsStore.upsert(s);
  appendLog({ sessionId, kind: 'session-resumed', message: 'Session resumed.' });
  return s;
}

export function stopSession(sessionId: string): ApplySession | null {
  const s = sessionsStore.get(sessionId);
  if (!s) return null;
  s.status = 'stopped';
  s.endedAt = Date.now();
  sessionsStore.upsert(s);
  // Cancel any still-queued attempts
  for (const a of attemptsStore.bySession(sessionId)) {
    if (a.status === 'queued' || a.status === 'running' || a.status === 'paused') {
      a.status = 'skipped';
      a.endedAt = Date.now();
      attemptsStore.upsert(a);
    }
  }
  appendLog({ sessionId, kind: 'session-stopped', message: 'Session stopped.' });
  return s;
}

export function finishSession(sessionId: string): ApplySession | null {
  const s = sessionsStore.get(sessionId);
  if (!s) return null;
  s.status = 'finished';
  s.endedAt = Date.now();
  sessionsStore.upsert(s);
  appendLog({ sessionId, kind: 'session-finished', message: 'Session finished.' });
  return s;
}

// ── Attempts ──────────────────────────────────────────────────────────

export function createAttempt(session: ApplySession, jobId: string): ApplyAttempt | null {
  const job = jobsStore.get(jobId);
  if (!job) return null;
  // Make sure packet exists
  const packet = getOrBuildPacket(jobId);
  const atsType: AtsType = packet?.atsType ?? detectAts(job.url, job.jdText);
  const now = Date.now();

  const initialStatus: AttemptStatus = (() => {
    // Pre-flight gate: ATS supported for this autonomy level?
    const fakeAttempt: ApplyAttempt = {
      id: 'pre', sessionId: session.id, jobId,
      packetId: packet?.id, atsType,
      atsTier: ATS_TIER[atsType], autonomyLevel: session.settings.autonomyLevel,
      status: 'queued', startedAt: 0, steps: [],
      filledFields: [], reviewFields: [], neverFields: [], unknownQuestions: [], errors: [],
      updatedAt: now,
    };
    const g = gatesForFillAndAdvance(fakeAttempt, session, packet ?? undefined);
    if (!g.ok && g.blockReason === 'duplicate') return 'blocked';
    return 'queued';
  })();

  const attempt: ApplyAttempt = {
    id: rid(),
    sessionId: session.id,
    jobId,
    packetId: packet?.id,
    atsType,
    atsTier: ATS_TIER[atsType],
    autonomyLevel: session.settings.autonomyLevel,
    status: initialStatus,
    startedAt: now,
    steps: [{ at: now, kind: 'attempt-queued', message: `Queued · ATS: ${atsType}` }],
    filledFields: [],
    reviewFields: [],
    neverFields: [],
    unknownQuestions: [],
    errors: [],
    updatedAt: now,
  };
  attemptsStore.upsert(attempt);
  appendLog({
    sessionId: session.id,
    attemptId: attempt.id,
    kind: 'attempt-queued',
    message: `Queued ${job.company} · ${job.role}`,
    meta: { jobId, atsType, status: initialStatus },
  });

  // If pre-flight failed with duplicate, update counters
  if (initialStatus === 'blocked') {
    session.blockedCount += 1;
    sessionsStore.upsert(session);
  }
  return attempt;
}

export function updateAttemptStatus(
  attemptId: string,
  status: AttemptStatus,
  opts?: { blockReason?: AttemptBlockReason; blockNote?: string; meta?: Record<string, unknown> },
): ApplyAttempt | null {
  const a = attemptsStore.get(attemptId);
  if (!a) return null;
  a.status = status;
  if (opts?.blockReason) a.blockReason = opts.blockReason;
  if (opts?.blockNote) a.blockNote = opts.blockNote;
  if (status === 'submitted' || status === 'failed' || status === 'blocked' || status === 'skipped' || status === 'needs-review' || status === 'unsupported') {
    a.endedAt = a.endedAt ?? Date.now();
  }
  if (status === 'submitted') a.submittedAt = a.submittedAt ?? Date.now();
  attemptsStore.upsert(a);

  // Update session counters
  const s = sessionsStore.get(a.sessionId);
  if (s) {
    if (status === 'submitted') s.submittedCount += 1;
    else if (status === 'needs-review' || status === 'paused') s.reviewCount += 1;
    else if (status === 'blocked' || status === 'unsupported') s.blockedCount += 1;
    else if (status === 'failed') s.failedCount += 1;
    else if (status === 'skipped') s.skippedCount += 1;
    sessionsStore.upsert(s);
  }
  return a;
}

export function addAttemptStep(
  attemptId: string,
  kind: import('../storage').AgentEventKind,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const a = attemptsStore.get(attemptId);
  if (!a) return;
  const step = { at: Date.now(), kind, message };
  a.steps.push(step);
  if (a.steps.length > 80) a.steps = a.steps.slice(-80);
  attemptsStore.upsert(a);
  appendLog({ sessionId: a.sessionId, attemptId, kind, message, meta });
}

export function activeSession(): ApplySession | undefined {
  return sessionsStore.active();
}

export function nextQueuedAttempt(sessionId: string): ApplyAttempt | undefined {
  return attemptsStore.bySession(sessionId)
    .filter(a => a.status === 'queued')
    .sort((a, b) => a.startedAt - b.startedAt)[0];
}

export function timeSavedEstimate(session: ApplySession): { minutes: number; hours: number } {
  // Rough: assume 8 minutes saved per submitted application (vs manual)
  const minutes = session.submittedCount * 8 + session.reviewCount * 4;
  return { minutes, hours: Math.round(minutes / 60 * 10) / 10 };
}
