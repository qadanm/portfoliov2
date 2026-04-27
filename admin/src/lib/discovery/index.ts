// Public entry point for the discovery system. The Discovery page
// imports `runDiscovery` and the action helpers; everything else is an
// implementation detail.

import type {
  DiscoveredJob,
  SourceConfig,
  DiscoveryRun,
  DiscoveryPreferences,
} from './types';
import type { RawSourceJob } from './sources/types';
import { fetchRemotive } from './sources/remotive';
import { fetchRemoteOk } from './sources/remoteok';
import { fetchHNHiring } from './sources/hn-hiring';
import { fetchGreenhouse } from './sources/greenhouse';
import { fetchLever } from './sources/lever';
import { fetchAshby } from './sources/ashby';
import { parsePastedAlerts } from './sources/manual-paste';
import { normalize } from './normalize';
import { applyFilters } from './filter';
import { discoveredStore, sourceStore, runStore, prefsStore, watchedStore } from './store';
import { jobsStore, type Job } from '../storage';
import { angleById } from '@/data/angles';

export type {
  DiscoveredJob,
  SourceConfig,
  DiscoveryRun,
  DiscoveryPreferences,
  WatchedCompany,
} from './types';
export { discoveredStore, sourceStore, runStore, prefsStore, watchedStore } from './store';
export { watchCompany, promoteWatched, detectPlatform } from './watch';
export { CURATED_BOARDS } from './curated';

// ── Source dispatch ───────────────────────────────────────────────────

async function fetchSource(source: SourceConfig): Promise<RawSourceJob[]> {
  switch (source.type) {
    case 'remotive': return fetchRemotive(source);
    case 'remoteok': return fetchRemoteOk(source);
    case 'hn-hiring': return fetchHNHiring(source);
    case 'greenhouse': return fetchGreenhouse(source);
    case 'lever': return fetchLever(source);
    case 'ashby': return fetchAshby(source);
    case 'manual-paste': return []; // populated via importPastedAlerts() instead
    default: return [];
  }
}

// ── Run orchestrator ──────────────────────────────────────────────────

export interface RunOptions {
  /** Limit to specific source ids (default: all enabled). */
  sourceIds?: string[];
  /** Only run sources flagged `watched: true`. */
  watchedOnly?: boolean;
  /** Only run sources flagged `curated: true`. */
  curatedOnly?: boolean;
}

/** Single in-flight run guard so auto-poll cannot overlap a manual run. */
let _isRunning = false;
export function isRunning(): boolean { return _isRunning; }

export async function runDiscovery(opts: RunOptions = {}): Promise<DiscoveryRun> {
  if (_isRunning) {
    // Caller should treat this as a no-op; surface the prior run as the result.
    const last = runStore.last();
    if (last) return last;
  }
  _isRunning = true;
  try {
    const allSources = sourceStore.list();
    let candidates = opts.sourceIds
      ? allSources.filter(s => opts.sourceIds!.includes(s.id))
      : allSources.filter(s => s.enabled);
    if (opts.watchedOnly) candidates = candidates.filter(s => s.watched);
    if (opts.curatedOnly) candidates = candidates.filter(s => s.curated);
    const sources = candidates.filter(s => s.type !== 'manual-paste');

    const run: DiscoveryRun = {
      id: `run-${Date.now()}`,
      startedAt: Date.now(),
      sources: sources.map(s => s.id),
      fetched: 0,
      found: 0,
      filtered: 0,
      errors: [],
    };

    // Run sources in parallel; one source's error must not block the others.
    const results = await Promise.all(
      sources.map(async (source) => {
        try {
          const raw = await fetchSource(source);
          sourceStore.recordOutcome(source.id, true, undefined, raw.length);
          return { source, raw };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          sourceStore.recordOutcome(source.id, false, msg, 0);
          run.errors.push({ source: source.id, message: msg });
          return { source, raw: [] as RawSourceJob[] };
        }
      }),
    );

    // Normalize → score → dedupe via stable id (handled by upsertMany).
    // We tag each row with its sourceConfigId + reliability snapshot.
    const allRaw = results.flatMap(({ source, raw }) =>
      raw.map(r => ({
        raw: r,
        sourceConfigId: source.id,
        sourceReliability: source.reliability ?? 1,
      })),
    );
    run.fetched = allRaw.length;

    const normalized = allRaw.map(({ raw, sourceConfigId, sourceReliability }) =>
      normalize(raw, { sourceConfigId, sourceReliability }),
    );

    const prefs = prefsStore.get();
    const { kept, dropped } = applyFilters(normalized, prefs);
    run.filtered = dropped.length;

    // Persist kept jobs as `new`; persist dropped jobs as `filtered` so they
    // remain inspectable. `upsertMany` preserves prior user decisions.
    const filteredAt = Date.now();
    const filteredJobs: DiscoveredJob[] = dropped.map(({ job, reasons }) => ({
      ...job,
      status: 'filtered',
      filteredAt,
      filterReasons: reasons.map(r => r.label),
    }));
    const { inserted, updated } = discoveredStore.upsertMany([...kept, ...filteredJobs]);
    run.found = inserted;
    run.refreshed = updated;
    run.completedAt = Date.now();

    runStore.add(run);
    return run;
  } finally {
    _isRunning = false;
  }
}

// ── Manual paste import ───────────────────────────────────────────────

export interface PasteImportResult {
  parsed: number;
  inserted: number;
  filtered: number;
}

export function importPastedAlerts(text: string): PasteImportResult {
  const raw = parsePastedAlerts(text);
  const normalized = raw.map(r => normalize(r, { sourceConfigId: 'manual-paste' }));
  const prefs = prefsStore.get();
  const { kept, dropped } = applyFilters(normalized, prefs);
  const filteredAt = Date.now();
  const filteredJobs: DiscoveredJob[] = dropped.map(({ job, reasons }) => ({
    ...job,
    status: 'filtered',
    filteredAt,
    filterReasons: reasons.map(r => r.label),
  }));
  const { inserted } = discoveredStore.upsertMany([...kept, ...filteredJobs]);

  runStore.add({
    id: `run-${Date.now()}`,
    startedAt: Date.now(),
    completedAt: Date.now(),
    sources: ['manual-paste'],
    fetched: raw.length,
    found: inserted,
    filtered: dropped.length,
    errors: [],
  });
  return { parsed: raw.length, inserted, filtered: dropped.length };
}

// ── Decision actions ──────────────────────────────────────────────────
// These mutate the DiscoveredJob and (for queue) create a Job record.
// Each returns the updated DiscoveredJob so callers can reflect state
// without re-reading the store.

/**
 * Add to today: convert the DiscoveredJob into a Saved Job (queued for
 * the /today triage screen) and record the link back so the user can
 * navigate to it. Idempotent — re-running on an already-queued job is a
 * no-op.
 */
export function decideQueue(jobId: string): DiscoveredJob | null {
  const dj = discoveredStore.get(jobId);
  if (!dj) return null;
  if (dj.status === 'queued' && dj.queuedJobId) {
    return dj;
  }

  const angle = angleById(dj.recommendedAngle);
  const now = Date.now();
  const newJob: Job = {
    id: `job-${dj.id}`,
    company: dj.company,
    role: dj.title,
    url: dj.applyUrl ?? dj.sourceUrl,
    source: dj.sourceLabel,
    location: dj.location ?? (dj.remoteStatus === 'remote' ? 'Remote' : undefined),
    salaryMin: dj.salaryMin,
    salaryMax: dj.salaryMax,
    status: 'Saved',
    dateFound: dj.discoveredAt,
    resumeAngle: angle?.id,
    fitScore: dj.fitScore,
    priority: dj.priorityScore,
    jdText: dj.description,
    nextStep: `Queued from discovery — ${dj.recommendedAngleLabel} angle`,
    createdAt: now,
    updatedAt: now,
  };
  jobsStore.upsert(newJob);

  const updated: DiscoveredJob = {
    ...dj,
    status: 'queued',
    queuedAt: now,
    queuedJobId: newJob.id,
    dismissedAt: undefined,
    savedAt: undefined,
    filteredAt: undefined,
  };
  discoveredStore.upsert(updated);
  return updated;
}

export function decideSave(jobId: string): DiscoveredJob | null {
  const dj = discoveredStore.get(jobId);
  if (!dj) return null;
  const updated: DiscoveredJob = { ...dj, status: 'saved', savedAt: Date.now(), dismissedAt: undefined };
  discoveredStore.upsert(updated);
  return updated;
}

export function decideDismiss(jobId: string): DiscoveredJob | null {
  const dj = discoveredStore.get(jobId);
  if (!dj) return null;
  const updated: DiscoveredJob = { ...dj, status: 'dismissed', dismissedAt: Date.now() };
  discoveredStore.upsert(updated);
  return updated;
}

/**
 * Restore a filtered job back to 'new' so it shows up in the To-decide
 * tab. Used when the user inspects the Filtered tab and disagrees with
 * the system.
 */
export function decideRestore(jobId: string): DiscoveredJob | null {
  const dj = discoveredStore.get(jobId);
  if (!dj) return null;
  const updated: DiscoveredJob = {
    ...dj,
    status: 'new',
    filteredAt: undefined,
    dismissedAt: undefined,
    savedAt: undefined,
    queuedAt: undefined,
    queuedJobId: undefined,
  };
  discoveredStore.upsert(updated);
  return updated;
}

/** Reverse any decision back to 'new'. If the job had been queued, also
 * removes the Saved Job record so /today doesn't show a ghost entry. */
export function decideUndo(jobId: string): DiscoveredJob | null {
  const dj = discoveredStore.get(jobId);
  if (!dj) return null;
  if (dj.status === 'queued' && dj.queuedJobId) {
    const job = jobsStore.get(dj.queuedJobId);
    if (job && job.status === 'Saved') jobsStore.remove(dj.queuedJobId);
  }
  const updated: DiscoveredJob = {
    ...dj,
    status: 'new',
    queuedAt: undefined,
    savedAt: undefined,
    dismissedAt: undefined,
    queuedJobId: undefined,
  };
  discoveredStore.upsert(updated);
  return updated;
}

// ── Batch operations ──────────────────────────────────────────────────

export interface BatchResult {
  affected: number;
  ids: string[];
}

/** Push every "new" job scoring at or above the threshold into the queue. */
export function batchQueueAbove(threshold: number): BatchResult {
  const ids: string[] = [];
  const all = discoveredStore.list();
  for (const dj of all) {
    if (dj.status !== 'new') continue;
    if (dj.fitScore < threshold) continue;
    const updated = decideQueue(dj.id);
    if (updated) ids.push(updated.id);
  }
  return { affected: ids.length, ids };
}

/** Dismiss every "new" job scoring strictly below the threshold. */
export function batchDismissBelow(threshold: number): BatchResult {
  const ids: string[] = [];
  const all = discoveredStore.list();
  for (const dj of all) {
    if (dj.status !== 'new') continue;
    if (dj.fitScore >= threshold) continue;
    const updated = decideDismiss(dj.id);
    if (updated) ids.push(updated.id);
  }
  return { affected: ids.length, ids };
}
