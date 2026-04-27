// Discovery types — the shape of a "found job" before it commits to the
// application queue. A DiscoveredJob is intentionally separate from a Job:
// jobs are decisions (queued, applied, etc.), discovered jobs are candidates.

export type DiscoverySourceType =
  | 'remotive'
  | 'remoteok'
  | 'hn-hiring'
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'manual-paste';

export type RemoteStatus = 'remote' | 'hybrid' | 'onsite' | 'unclear';

export type DiscoveryStatus =
  | 'new'        // freshly fetched, not yet decided
  | 'queued'     // user added it to /today (becomes a Saved Job)
  | 'saved'      // user marked "Save for later" (kept for future review)
  | 'dismissed'  // user passed on it
  | 'filtered';  // dropped by preferences; kept for inspection on the Filtered tab

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

  // ── Reasons (for transparency: why did this match / get downranked / get filtered) ──
  /** Positive signals that informed the score. */
  matchReasons?: string[];
  /** Negative signals that did NOT trigger filtering but lowered confidence. */
  downrankReasons?: string[];
  /** Reasons this job was filtered out (only set when status === 'filtered'). */
  filterReasons?: string[];

  /** Reference back to the SourceConfig that produced this job. */
  sourceConfigId?: string;
  /** Snapshot of source reliability at discovery time. */
  sourceReliability?: number;

  // ── Lifecycle ─────────────────────────────────────────────────────────
  discoveredAt: number;
  status: DiscoveryStatus;
  queuedAt?: number;
  savedAt?: number;
  dismissedAt?: number;
  filteredAt?: number;
  /** When status === 'queued', the id of the Job that was created. */
  queuedJobId?: string;
}

export type SourceStatus = 'active' | 'needs-setup' | 'unsupported' | 'failing';

export interface SourceConfig {
  id: string;
  type: DiscoverySourceType;
  /** Human-readable name (e.g. "Remotive · Design"). */
  name: string;
  enabled: boolean;
  /** Display name for the company — distinct from `name` which may be prefixed. */
  companyName?: string;
  /** Direct URL to view the board in a browser. */
  boardUrl?: string;
  /** Convenience copy of params.slug for typed access. */
  slug?: string;
  /** Source-specific config — board slug for Greenhouse, search term for HN, etc. */
  params?: Record<string, string>;
  /** True when seeded by us as part of the curated list. */
  curated?: boolean;
  /** True when added via "Watch company" from a discovered job. */
  watched?: boolean;
  /** Current health. Computed by the orchestrator after each run. */
  status?: SourceStatus;
  /** Rolling success rate (0–1), updated as exponential moving average. */
  reliability?: number;
  consecutiveErrors?: number;
  consecutiveSuccesses?: number;
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
  /** Re-encountered jobs whose lifecycle status was preserved (dedupe). */
  refreshed?: number;
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
  /** Reject jobs whose title/description suggests contract / contract-to-hire. */
  excludeContract?: boolean;
  /** Reject jobs that look IC/junior level. */
  excludeJunior?: boolean;
  // ── Auto-poll ────────────────────────────────────────────────────────
  autoPollEnabled?: boolean;
  /** Minutes between automatic runs. Floor 30, ceiling 480. */
  autoPollIntervalMinutes?: number;
}

/** Companies the user wants to watch but for which we don't yet have a board URL. */
export interface WatchedCompany {
  id: string;
  companyName: string;
  /** The job URL the user clicked "Watch" on. */
  originalJobUrl: string;
  /** Best-guess platform from URL inspection. */
  detectedPlatform: 'greenhouse' | 'lever' | 'ashby' | 'unsupported';
  /** Direct URL to the public board, when known. */
  boardUrl?: string;
  status: 'needs-setup' | 'active' | 'unsupported';
  notes?: string;
  createdAt: number;
}
