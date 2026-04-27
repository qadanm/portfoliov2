// Discovery types — the shape of a "found job" before it commits to the
// application queue. A DiscoveredJob is intentionally separate from a Job:
// jobs are decisions (queued, applied, etc.), discovered jobs are candidates.

export type DiscoverySourceType =
  | 'remotive'
  | 'hn-hiring'
  | 'greenhouse'
  | 'lever'
  | 'manual-paste';

export type RemoteStatus = 'remote' | 'hybrid' | 'onsite' | 'unclear';

export type DiscoveryStatus =
  | 'new'        // freshly fetched, not yet decided
  | 'queued'     // user added it to /today (becomes a Saved Job)
  | 'saved'      // user marked "Save for later" (kept for future review)
  | 'dismissed'; // user passed on it

export interface DiscoveredJob {
  /** Stable local id; survives re-runs. Hash of source + sourceJobId or URL. */
  id: string;
  source: DiscoverySourceType;
  /** Pretty source label for the UI. */
  sourceLabel: string;
  /** Remote source's own job id, when available. Used for dedupe. */
  sourceJobId?: string;
  /** The canonical posting URL the user should visit to inspect. */
  sourceUrl: string;
  /** When set, the apply target differs from the source URL. */
  applyUrl?: string;

  company: string;
  title: string;
  location?: string;
  remoteStatus: RemoteStatus;

  salaryMin?: number;
  salaryMax?: number;
  salaryRaw?: string;

  /** Plain-text description; may be the full JD or just a board summary. */
  description?: string;
  /** ~200-char single-line summary used in list view. */
  excerpt?: string;

  /** Normalized role family (Product Designer, Design Engineer, etc.). */
  roleFamily?: string;
  /** Best-guess seniority signal. */
  seniority?: 'ic' | 'senior' | 'lead' | 'principal' | 'unclear';

  // ── Scoring (mirrors scoring.ts OpportunityScore) ────────────────────
  fitScore: number;             // 0–100
  priorityScore: 1 | 2 | 3;     // 1 highest
  confidence: 'low' | 'medium' | 'high';
  recommendedAngle: string;     // angle id
  recommendedAngleLabel: string;
  matchedStrengths: string[];
  missingSignals: string[];     // gaps + JD signals not in profile
  redFlags: string[];

  // ── Lifecycle ─────────────────────────────────────────────────────────
  discoveredAt: number;
  status: DiscoveryStatus;
  queuedAt?: number;
  savedAt?: number;
  dismissedAt?: number;
  /** When status === 'queued', the id of the Job that was created. */
  queuedJobId?: string;
}

export interface SourceConfig {
  id: string;
  type: DiscoverySourceType;
  /** Human-readable name (e.g. "Remotive · Design"). */
  name: string;
  enabled: boolean;
  /** Source-specific config — board slug for Greenhouse, search term for HN, etc. */
  params?: Record<string, string>;
  lastRunAt?: number;
  lastResultCount?: number;
  lastError?: string;
  /** A short note explaining what the source covers, shown next to the toggle. */
  notes?: string;
}

export interface DiscoveryRun {
  id: string;
  startedAt: number;
  completedAt?: number;
  /** Source ids that participated. */
  sources: string[];
  /** Total raw jobs fetched (pre-filter). */
  fetched: number;
  /** Newly added DiscoveredJobs (after dedupe). */
  found: number;
  /** Filtered out by preferences. */
  filtered: number;
  /** Errors per source. */
  errors: { source: string; message: string }[];
}

/** Preferences that govern filtering. Exposed in the discovery UI. */
export interface DiscoveryPreferences {
  /** Reject jobs whose remote status is 'onsite'. */
  remoteOnly: boolean;
  /** Reject jobs where the high end of salary is below this. Null = unset. */
  minSalary: number | null;
  /** Reject jobs scoring below this. */
  minScore: number;
  /** Reject roles that include any of these substrings (lowercased). */
  excludeKeywords: string[];
  /** When true, the "Auto-queue 75+" batch button is enabled. */
  autoQueueThreshold: number;
}
