// Typed localStorage wrapper. All admin data is stored under `qa_` keys.
// Schema versioning is here so future shape changes can be migrated cleanly.
//
// SECURITY: this is browser-local. Clearing site data deletes everything.
// Use the Export Center to back up.

export const SCHEMA_VERSION = 1;

export const STORAGE_KEYS = {
  schemaVersion: 'qa_schema_version',
  jobs: 'qa_jobs',
  recruiters: 'qa_recruiters',
  letters: 'qa_letters',
  notes: 'qa_notes',
} as const;

// ── Types ──────────────────────────────────────────────────────────────

export type JobStatus =
  | 'Saved'
  | 'Applying'
  | 'Applied'
  | 'Recruiter Screen'
  | 'Hiring Manager'
  | 'Take-home'
  | 'Interview Loop'
  | 'Offer'
  | 'Rejected'
  | 'Ghosted'
  | 'Archived';

export const JOB_STATUSES: JobStatus[] = [
  'Saved', 'Applying', 'Applied', 'Recruiter Screen',
  'Hiring Manager', 'Take-home', 'Interview Loop',
  'Offer', 'Rejected', 'Ghosted', 'Archived',
];

// Active = still moving. Used for dashboard counts.
export const ACTIVE_STATUSES: JobStatus[] = [
  'Saved', 'Applying', 'Applied', 'Recruiter Screen',
  'Hiring Manager', 'Take-home', 'Interview Loop', 'Offer',
];

export interface Job {
  id: string;
  company: string;
  role: string;
  url?: string;
  source?: string;
  location?: string;     // city or "Remote" or "Hybrid - SF"
  salaryMin?: number;
  salaryMax?: number;
  status: JobStatus;
  dateFound?: number;    // epoch ms
  dateApplied?: number;
  contactName?: string;  // recruiter or HM
  contactEmail?: string;
  nextStep?: string;
  followUpDate?: number;
  resumeAngle?: string;  // angle id used
  letterId?: string;     // ref to a saved letter
  notes?: string;
  priority?: 1 | 2 | 3;  // 1 = highest
  fitScore?: number;     // 0–100, derived from analyzer
  jdText?: string;       // raw JD pasted in analyzer (kept for re-analysis)
  // When set, the job is "deferred" in the Today queue: still visible but
  // sorted to the bottom and dimmed. Persisted on the job so the state
  // survives refresh AND syncs across devices via the standard sync layer.
  deferredAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type RecruiterType = 'internal' | 'agency' | 'hiring-manager' | 'referral';
export type RelationshipStatus = 'cold' | 'warm' | 'active' | 'cooled';

export interface Recruiter {
  id: string;
  name: string;
  company?: string;
  email?: string;
  linkedin?: string;
  type: RecruiterType;
  relationship: RelationshipStatus;
  rolesDiscussed?: string;
  lastContactDate?: number;
  followUpDate?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type LetterKind =
  | 'cover-letter'
  | 'recruiter-dm'
  | 'connect-note'
  | 'follow-up-applied'
  | 'follow-up-interview'
  | 'thank-you'
  | 'negotiation'
  | 'rejection-followup'
  | 'check-in';

export interface SavedLetter {
  id: string;
  kind: LetterKind;
  tone: 'direct' | 'warm' | 'design' | 'technical' | 'senior';
  jobId?: string;
  recruiterId?: string;
  body: string;
  createdAt: number;
  /** Last edit time. Required for the cross-device sync layer. */
  updatedAt: number;
}

// ── Generic accessors ──────────────────────────────────────────────────

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return safeParse<T>(localStorage.getItem(key), fallback);
  } catch {
    // localStorage can throw under private-browsing / disabled storage.
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err: unknown) {
    // Quota exceeded, private browsing, or storage disabled. Surface a
    // single broadcast so any open page can prompt the user to export +
    // prune. Don't throw — losing a write is bad, crashing the page is
    // worse. The sync layer's tombstone protocol will heal once the
    // user makes room.
    try {
      const message = err instanceof Error ? err.message : String(err);
      window.dispatchEvent(new CustomEvent('qa-storage-error', { detail: { key, message } }));
      // eslint-disable-next-line no-console
      console.error(`[qa-storage] write failed for ${key}:`, message);
    } catch { /* no-op */ }
    return;
  }
  // Notify the sync layer (and any other subscribers) that data changed
  // so it can debounce a push to the cloud. This is event-based so
  // storage.ts has no compile-time dependency on sync.ts.
  try {
    window.dispatchEvent(new CustomEvent('qa-data-changed', { detail: { key } }));
  } catch { /* no-op */ }
}

// Fire a "record was deleted" event so the sync layer can record a
// tombstone. Without tombstones, a deleted record would resurrect itself
// the next time the other device pushed.
function notifyDeleted(type: 'job' | 'recruiter' | 'letter', id: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('qa-record-deleted', { detail: { type, id } }));
  } catch { /* no-op */ }
}

// ── Schema migration ───────────────────────────────────────────────────

export function ensureSchema(): void {
  if (typeof window === 'undefined') return;
  const v = Number(localStorage.getItem(STORAGE_KEYS.schemaVersion) || 0);
  if (v < SCHEMA_VERSION) {
    // Migrate older shapes here when we bump the version.
    // For v1: try to forward-port the legacy `qadan-admin-jobs-v1` key
    // from the V1 job tracker.
    if (v === 0) {
      const legacy = localStorage.getItem('qadan-admin-jobs-v1');
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy) as Array<{ id: string; company: string; role: string; source: string; stage: string; addedAt: number }>;
          const migrated: Job[] = parsed.map(j => ({
            id: j.id,
            company: j.company,
            role: j.role,
            source: j.source,
            // Validate against the canonical status list — a junk legacy
            // value would otherwise propagate as an invalid status that
            // breaks every filter downstream.
            status: JOB_STATUSES.includes(j.stage as JobStatus) ? (j.stage as JobStatus) : 'Applied',
            createdAt: j.addedAt,
            updatedAt: j.addedAt,
            dateFound: j.addedAt,
          }));
          write(STORAGE_KEYS.jobs, migrated);
        } catch { /* ignore */ }
      }
    }
    localStorage.setItem(STORAGE_KEYS.schemaVersion, String(SCHEMA_VERSION));
  }
}

// ── Domain accessors ───────────────────────────────────────────────────

export const jobsStore = {
  list(): Job[] { return read<Job[]>(STORAGE_KEYS.jobs, []); },
  save(jobs: Job[]): void { write(STORAGE_KEYS.jobs, jobs); },
  upsert(job: Job): void {
    const all = this.list();
    const idx = all.findIndex(j => j.id === job.id);
    job.updatedAt = Date.now();
    if (idx >= 0) all[idx] = job; else all.push(job);
    this.save(all);
  },
  remove(id: string): void {
    this.save(this.list().filter(j => j.id !== id));
    notifyDeleted('job', id);
  },
  get(id: string): Job | undefined { return this.list().find(j => j.id === id); },
};

export const recruitersStore = {
  list(): Recruiter[] { return read<Recruiter[]>(STORAGE_KEYS.recruiters, []); },
  save(rs: Recruiter[]): void { write(STORAGE_KEYS.recruiters, rs); },
  upsert(r: Recruiter): void {
    const all = this.list();
    const idx = all.findIndex(x => x.id === r.id);
    r.updatedAt = Date.now();
    if (idx >= 0) all[idx] = r; else all.push(r);
    this.save(all);
  },
  remove(id: string): void {
    this.save(this.list().filter(r => r.id !== id));
    notifyDeleted('recruiter', id);
  },
  get(id: string): Recruiter | undefined { return this.list().find(r => r.id === id); },
};

export const lettersStore = {
  list(): SavedLetter[] { return read<SavedLetter[]>(STORAGE_KEYS.letters, []); },
  save(ls: SavedLetter[]): void { write(STORAGE_KEYS.letters, ls); },
  upsert(l: SavedLetter): void {
    const all = this.list();
    const idx = all.findIndex(x => x.id === l.id);
    l.updatedAt = Date.now();
    if (idx >= 0) all[idx] = l; else all.push(l);
    this.save(all);
  },
  remove(id: string): void {
    this.save(this.list().filter(l => l.id !== id));
    notifyDeleted('letter', id);
  },
};

// ── Backup / restore ───────────────────────────────────────────────────

export interface Backup {
  schemaVersion: number;
  exportedAt: number;
  jobs: Job[];
  recruiters: Recruiter[];
  letters: SavedLetter[];
  // Discovery payload — optional for backward-compat with pre-discovery
  // backups. New backups always include these.
  discoveredJobs?: unknown[];
  discoverySources?: unknown[];
  watchedCompanies?: unknown[];
  discoveryPrefs?: unknown;
}

// Read raw discovery keys directly from localStorage so storage.ts has no
// compile-time dependency on the discovery module. Discovery owns its own
// types; here we just shuttle the JSON.
function readRaw<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function writeRaw(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota — surfaced elsewhere */ }
}

const DISCOVERY_KEYS = {
  discoveredJobs: 'qa_discovered_jobs',
  sources: 'qa_discovery_sources',
  watched: 'qa_watched_companies',
  prefs: 'qa_discovery_prefs',
};

export function exportAll(): Backup {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    jobs: jobsStore.list(),
    recruiters: recruitersStore.list(),
    letters: lettersStore.list(),
    discoveredJobs: readRaw<unknown[]>(DISCOVERY_KEYS.discoveredJobs, []),
    discoverySources: readRaw<unknown[]>(DISCOVERY_KEYS.sources, []),
    watchedCompanies: readRaw<unknown[]>(DISCOVERY_KEYS.watched, []),
    discoveryPrefs: readRaw<unknown>(DISCOVERY_KEYS.prefs, null),
  };
}

export function importAll(backup: Backup, mode: 'replace' | 'merge'): void {
  if (mode === 'replace') {
    jobsStore.save(backup.jobs ?? []);
    recruitersStore.save(backup.recruiters ?? []);
    lettersStore.save(backup.letters ?? []);
    if (backup.discoveredJobs) writeRaw(DISCOVERY_KEYS.discoveredJobs, backup.discoveredJobs);
    if (backup.discoverySources) writeRaw(DISCOVERY_KEYS.sources, backup.discoverySources);
    if (backup.watchedCompanies) writeRaw(DISCOVERY_KEYS.watched, backup.watchedCompanies);
    if (backup.discoveryPrefs != null) writeRaw(DISCOVERY_KEYS.prefs, backup.discoveryPrefs);
    return;
  }
  // merge by id (incoming wins)
  const mergeBy = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
    const map = new Map(existing.map(e => [e.id, e]));
    for (const i of incoming) map.set(i.id, i);
    return Array.from(map.values());
  };
  jobsStore.save(mergeBy(jobsStore.list(), backup.jobs ?? []));
  recruitersStore.save(mergeBy(recruitersStore.list(), backup.recruiters ?? []));
  lettersStore.save(mergeBy(lettersStore.list(), backup.letters ?? []));
  // Discovery merge: union by id for arrays of objects with `id`. Sources
  // and watched companies have ids; discoveredJobs do too.
  if (Array.isArray(backup.discoveredJobs)) {
    const existing = readRaw<Array<{ id: string }>>(DISCOVERY_KEYS.discoveredJobs, []);
    const incoming = backup.discoveredJobs as Array<{ id: string }>;
    writeRaw(DISCOVERY_KEYS.discoveredJobs, mergeBy(existing, incoming));
  }
  if (Array.isArray(backup.discoverySources)) {
    const existing = readRaw<Array<{ id: string }>>(DISCOVERY_KEYS.sources, []);
    const incoming = backup.discoverySources as Array<{ id: string }>;
    writeRaw(DISCOVERY_KEYS.sources, mergeBy(existing, incoming));
  }
  if (Array.isArray(backup.watchedCompanies)) {
    const existing = readRaw<Array<{ id: string }>>(DISCOVERY_KEYS.watched, []);
    const incoming = backup.watchedCompanies as Array<{ id: string }>;
    writeRaw(DISCOVERY_KEYS.watched, mergeBy(existing, incoming));
  }
  // Prefs are a single object — incoming replaces.
  if (backup.discoveryPrefs != null) writeRaw(DISCOVERY_KEYS.prefs, backup.discoveryPrefs);
}

export function clearAll(): void {
  jobsStore.save([]);
  recruitersStore.save([]);
  lettersStore.save([]);
  writeRaw(DISCOVERY_KEYS.discoveredJobs, []);
  writeRaw(DISCOVERY_KEYS.sources, []);
  writeRaw(DISCOVERY_KEYS.watched, []);
  // Don't wipe prefs — those are user settings, restored separately.
}

// ── CSV helpers ────────────────────────────────────────────────────────

// UTF-8 BOM so Excel opens the CSV without garbling accented characters.
// Numbers don't need it but most users open these in Excel at least once.
const CSV_BOM = '﻿';

export function jobsToCSV(jobs: Job[]): string {
  const cols: (keyof Job)[] = ['company', 'role', 'url', 'source', 'location', 'salaryMin', 'salaryMax', 'status', 'dateFound', 'dateApplied', 'contactName', 'contactEmail', 'nextStep', 'followUpDate', 'resumeAngle', 'priority', 'fitScore', 'notes'];
  const esc = (v: unknown) => {
    if (v == null) return '';
    const s = typeof v === 'number' && (String(v).length === 13) ? new Date(v).toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = cols.join(',');
  const rows = jobs.map(j => cols.map(c => esc((j as any)[c])).join(','));
  return CSV_BOM + [header, ...rows].join('\n');
}

export function recruitersToCSV(rs: Recruiter[]): string {
  const cols: (keyof Recruiter)[] = ['name', 'company', 'email', 'linkedin', 'type', 'relationship', 'rolesDiscussed', 'lastContactDate', 'followUpDate', 'notes'];
  const esc = (v: unknown) => {
    if (v == null) return '';
    const s = typeof v === 'number' && (String(v).length === 13) ? new Date(v).toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return CSV_BOM + [cols.join(','), ...rs.map(r => cols.map(c => esc((r as any)[c])).join(','))].join('\n');
}
