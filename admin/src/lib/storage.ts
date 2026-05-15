// Typed localStorage wrapper. All admin data is stored under `qa_` keys.
// Schema versioning is here so future shape changes can be migrated cleanly.
//
// SECURITY: this is browser-local. Clearing site data deletes everything.
// Use the Export Center to back up.

export const SCHEMA_VERSION = 2;

export const STORAGE_KEYS = {
  schemaVersion: 'qa_schema_version',
  jobs: 'qa_jobs',
  recruiters: 'qa_recruiters',
  letters: 'qa_letters',
  notes: 'qa_notes',
  vault: 'qa_vault',
  packets: 'qa_packets',
  outcomes: 'qa_outcomes',
  llmAuditLog: 'qa_llm_audit_log',
  applySettings: 'qa_apply_settings',
  sessions: 'qa_sessions',
  attempts: 'qa_attempts',
  agentLog: 'qa_agent_log',
  applicationMemory: 'qa_application_memory',
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

// ── Profile Vault ───────────────────────────────────────────────────────
// Reusable personal answers for application form-fill + standard questions.
// Single record; lives in localStorage + KV sync.

export interface ProfileVault {
  // Identity
  displayName: string;
  legalFirstName?: string;
  legalLastName?: string;
  preferredName?: string;
  pronouns?: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;

  // Work arrangement
  remoteOnly: boolean;
  willingToRelocate: boolean;
  currentTitle?: string;
  currentEmployer?: string;
  yearsExperience?: number;

  // Links
  portfolio: string;
  linkedin: string;
  github: string;
  personalSite?: string;

  // Work auth — answers stored, autofill defaults off
  workAuthAnswer?: string;
  sponsorshipAnswer?: string;
  workAuthAutofillAllowed: boolean;

  // Salary target
  salaryMin?: number;
  salaryMax?: number;
  currency: string;
  salaryNegotiable: boolean;

  // Reusable text
  shortBio: string;
  longBio: string;
  tellMeAboutYourself: string;
  whyLooking: string;
  whyThisRoleTemplate: string;
  whyThisCompanyTemplate: string;
  aiWorkflowExplanation: string;
  designWorkflowExplanation: string;

  updatedAt: number;
}

// ── Application Packet ────────────────────────────────────────────────

export type AtsType =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workday'
  | 'smartrecruiters'
  | 'linkedin-easy'
  | 'generic';

export type ApplyMode = 'manual' | 'guided' | 'autofill';
export type PacketStatus = 'draft' | 'ready' | 'in-progress' | 'submitted' | 'archived';
export type GhostRisk = 'low' | 'medium' | 'high';
export type CallbackStrength = 'weak' | 'moderate' | 'strong';
export type FieldConfidence = 'high' | 'medium' | 'low' | 'never';

export interface PacketSelection {
  projectIds: string[];
  bulletIdsByProject: Record<string, string[]>;
  skillGroupOrder: string[];
}

export interface PacketScores {
  fit: number;
  quality: number;
  authenticity: number;
  effort: number;
  callback: CallbackStrength;
}

export interface PacketWarnings {
  missingKeywords: string[];
  redFlags: string[];
  authenticityConcerns: string[];
  ghostFlags: string[];
  salaryConflicts: string[];
  workArrangementConflicts: string[];
}

export interface FieldMapEntry {
  fieldKey: string;
  value: string;
  confidence: FieldConfidence;
  source: 'vault' | 'packet' | 'job';
  note?: string;
}

export interface PacketChecklistItem {
  id: string;
  label: string;
  done: boolean;
  doneAt?: number;
  copyTarget?: 'resume' | 'cover-letter' | 'why-role' | 'why-company' | 'salary' | 'recruiter-dm' | 'tell-me-about-yourself' | 'jd-summary';
  hint?: string;
}

export interface ApplicationPacket {
  id: string;
  jobId: string;

  resumeAngleId: string;
  recommendedAngleReason: string;
  resumeSelection: PacketSelection;
  summaryKicker: string;

  coverLetter: string;
  whyRoleAnswer: string;
  whyCompanyAnswer: string;
  tellMeAboutYourself: string;
  salaryGuidance: string;
  portfolioMentions: string[];
  recruiterDm: string;
  followUpMessage: string;
  jdSummary: string;

  scores: PacketScores;
  warnings: PacketWarnings;
  ghostRisk: GhostRisk;
  ghostReasons: string[];

  fieldMap: FieldMapEntry[];

  status: PacketStatus;
  applyMode: ApplyMode;
  atsType: AtsType;
  atsFrictionScore: number;
  estimatedMinutes: number;
  checklist: PacketChecklistItem[];

  llmUsed: { task: string; at: number }[];
  // Per-packet override of the global "use AI refinement" setting. Defaults to global.
  llmRefinementEnabled?: boolean;

  // Snapshot of generated baseline drafts for "effort" diffing. Never shown
  // to user; only diff distance.
  baseline?: {
    coverLetter: string;
    whyRoleAnswer: string;
    whyCompanyAnswer: string;
    summaryKicker: string;
  };

  createdAt: number;
  updatedAt: number;
  submittedAt?: number;
}

// ── Outcomes ──────────────────────────────────────────────────────────

export type OutcomeKind =
  | 'applied'
  | 'recruiter-reply'
  | 'screening-invite'
  | 'screen-completed'
  | 'take-home'
  | 'onsite-loop'
  | 'offer'
  | 'rejection'
  | 'ghosted'
  | 'withdrew';

export const OUTCOME_KINDS: OutcomeKind[] = [
  'applied', 'recruiter-reply', 'screening-invite', 'screen-completed',
  'take-home', 'onsite-loop', 'offer', 'rejection', 'ghosted', 'withdrew',
];

export const OUTCOME_LABELS: Record<OutcomeKind, string> = {
  'applied': 'Applied',
  'recruiter-reply': 'Recruiter replied',
  'screening-invite': 'Screen invited',
  'screen-completed': 'Screen completed',
  'take-home': 'Take-home',
  'onsite-loop': 'Onsite/loop',
  'offer': 'Offer',
  'rejection': 'Rejection',
  'ghosted': 'Ghosted',
  'withdrew': 'Withdrew',
};

export interface JobOutcome {
  id: string;
  jobId: string;
  packetId?: string;
  kind: OutcomeKind;
  at: number;
  note?: string;
  recruiterId?: string;
  // updatedAt required for the sync layer.
  updatedAt: number;
}

// ── LLM audit log ─────────────────────────────────────────────────────

export interface LlmAuditEntry {
  id: string;
  at: number;
  task: string;
  jobId?: string;
  packetId?: string;
  status: 'ok' | 'disabled' | 'error' | 'rejected-by-scrubber';
  modelUsed?: string;
  dataSentFields: string[];
  contextChars: number;
  draftChars?: number;
  errorMessage?: string;
}

// ── Apply Session settings (global app prefs) ─────────────────────────

export interface ApplySettings {
  // M3 confirmed-submit assist. Default OFF; even when ON, each submit
  // requires user typing "SUBMIT" in a per-job confirmation modal.
  confirmedSubmitAssistEnabled: boolean;
  // Default for the packet builder's "Use AI refinement" toggle.
  defaultLlmRefinementEnabled: boolean;
  // Per-day cap for Apply Session warnings.
  dailyVolumeWarnAt: number;
  // Authenticity threshold below which "Mark ready" requires override.
  authenticityThreshold: number;
  // Cover letter similarity threshold for "too generic" banner.
  similarityThreshold: number;
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
function notifyDeleted(type: 'job' | 'recruiter' | 'letter' | 'packet' | 'outcome', id: string): void {
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

// ── Profile Vault store (singleton record) ────────────────────────────

export const VAULT_DEFAULTS: ProfileVault = {
  displayName: 'Moe Qadan',
  email: 'moe@qadan.co',
  phone: '',
  city: 'Los Angeles',
  state: 'CA',
  country: 'United States',
  remoteOnly: false,
  willingToRelocate: false,
  portfolio: 'https://qadan.co',
  linkedin: 'https://linkedin.com/in/mqadan',
  github: 'https://github.com/qadanm',
  workAuthAutofillAllowed: false,
  currency: 'USD',
  salaryNegotiable: true,
  shortBio: '',
  longBio: '',
  tellMeAboutYourself: '',
  whyLooking: '',
  whyThisRoleTemplate: '',
  whyThisCompanyTemplate: '',
  aiWorkflowExplanation: '',
  designWorkflowExplanation: '',
  updatedAt: 0,
};

export const vaultStore = {
  get(): ProfileVault {
    const v = read<ProfileVault | null>(STORAGE_KEYS.vault, null);
    if (!v) return { ...VAULT_DEFAULTS };
    // Forward-fill any missing fields from defaults so older payloads
    // don't crash callers expecting newer fields.
    return { ...VAULT_DEFAULTS, ...v };
  },
  save(v: ProfileVault): void {
    v.updatedAt = Date.now();
    write(STORAGE_KEYS.vault, v);
  },
};

// ── Packets store ─────────────────────────────────────────────────────

export const packetsStore = {
  list(): ApplicationPacket[] { return read<ApplicationPacket[]>(STORAGE_KEYS.packets, []); },
  save(ps: ApplicationPacket[]): void { write(STORAGE_KEYS.packets, ps); },
  upsert(p: ApplicationPacket): void {
    const all = this.list();
    const idx = all.findIndex(x => x.id === p.id);
    p.updatedAt = Date.now();
    if (idx >= 0) all[idx] = p; else all.push(p);
    this.save(all);
  },
  remove(id: string): void {
    this.save(this.list().filter(p => p.id !== id));
    notifyDeleted('packet', id);
  },
  get(id: string): ApplicationPacket | undefined { return this.list().find(p => p.id === id); },
  byJobId(jobId: string): ApplicationPacket | undefined {
    // Latest packet for a given job. If multiple, return the most recent.
    const matches = this.list().filter(p => p.jobId === jobId);
    if (matches.length === 0) return undefined;
    return matches.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
  },
};

// ── Outcomes store ────────────────────────────────────────────────────

export const outcomesStore = {
  list(): JobOutcome[] { return read<JobOutcome[]>(STORAGE_KEYS.outcomes, []); },
  save(os: JobOutcome[]): void { write(STORAGE_KEYS.outcomes, os); },
  upsert(o: JobOutcome): void {
    const all = this.list();
    const idx = all.findIndex(x => x.id === o.id);
    o.updatedAt = Date.now();
    if (idx >= 0) all[idx] = o; else all.push(o);
    this.save(all);
  },
  remove(id: string): void {
    this.save(this.list().filter(o => o.id !== id));
    notifyDeleted('outcome', id);
  },
  byJobId(jobId: string): JobOutcome[] {
    return this.list()
      .filter(o => o.jobId === jobId)
      .sort((a, b) => a.at - b.at);
  },
};

// ── Apply Sessions + Attempts (autonomous agent) ─────────────────────

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4;

export const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  0: 'Manual (copy/paste only)',
  1: 'Fill Assist (extension fills safe fields)',
  2: 'Step Assist (fill + auto-advance, pause before submit)',
  3: 'Confirmed Auto-Submit (single-job submit after gates pass)',
  4: 'Batch Auto-Apply (process queue, submit eligible jobs)',
};

export type AtsTier = 1 | 2 | 3;
export const ATS_TIER: Record<AtsType, AtsTier> = {
  ashby: 1,
  greenhouse: 1,
  lever: 1,
  smartrecruiters: 2,
  'linkedin-easy': 2,
  workday: 3,
  generic: 3,
};

export type AttemptStatus =
  | 'queued'         // not yet started
  | 'running'        // agent currently working
  | 'paused'         // waiting on user action (CAPTCHA, login, unknown field)
  | 'needs-review'   // unfinishable without manual intervention
  | 'submitted'      // applied successfully
  | 'blocked'        // hard block (unsupported ATS, dupe, etc.)
  | 'failed'         // error during run
  | 'skipped'        // user moved past
  | 'unsupported';   // ATS or page shape not supported

export type AttemptBlockReason =
  | 'captcha'
  | 'login-required'
  | 'unknown-required-field'
  | 'demographic-required'
  | 'legal-required'
  | 'salary-unresolved'
  | 'work-auth-ambiguity'
  | 'upload-failed'
  | 'unsupported-ats'
  | 'page-error'
  | 'packet-not-ready'
  | 'low-authenticity'
  | 'low-fit'
  | 'duplicate'
  | 'gates-failed'
  | 'page-changed'
  | 'user-paused'
  | 'over-cap'
  | 'unknown';

export type AgentEventKind =
  | 'session-started'
  | 'session-paused'
  | 'session-resumed'
  | 'session-stopped'
  | 'session-finished'
  | 'attempt-queued'
  | 'attempt-started'
  | 'attempt-page-loaded'
  | 'attempt-ats-detected'
  | 'attempt-fields-detected'
  | 'attempt-fields-filled'
  | 'attempt-advance'
  | 'attempt-paused'
  | 'attempt-question-detected'
  | 'attempt-question-answered'
  | 'attempt-submit-attempted'
  | 'attempt-submitted'
  | 'attempt-blocked'
  | 'attempt-failed'
  | 'attempt-needs-review'
  | 'extension-disconnected';

export interface AgentLogEntry {
  id: string;
  sessionId: string;
  attemptId?: string;
  at: number;
  kind: AgentEventKind;
  message: string;
  meta?: Record<string, unknown>;
  // Required for the sync layer to merge entries deterministically.
  updatedAt: number;
}

export interface AttemptStep {
  at: number;
  kind: AgentEventKind;
  message: string;
}

export interface ApplyAttempt {
  id: string;
  sessionId: string;
  jobId: string;
  packetId?: string;
  atsType: AtsType;
  atsTier: AtsTier;
  autonomyLevel: AutonomyLevel;
  status: AttemptStatus;
  blockReason?: AttemptBlockReason;
  blockNote?: string;
  startedAt: number;
  endedAt?: number;
  submittedAt?: number;
  // Step log — first 100 step events stored inline for quick UI render.
  // Full log lives in agentLogStore.
  steps: AttemptStep[];
  filledFields: string[];
  reviewFields: string[];
  neverFields: string[];
  unknownQuestions: string[];
  errors: string[];
  // The tab id in chrome where the attempt is running. Set by extension.
  tabId?: number;
  // URL of the application page (resolved after open).
  currentUrl?: string;
  // Required for the sync layer.
  updatedAt: number;
}

export interface ApplySessionSettings {
  autonomyLevel: AutonomyLevel;
  fitThreshold: number;           // minimum fit to auto-submit
  authenticityThreshold: number;  // minimum authenticity to auto-submit
  qualityThreshold: number;       // minimum quality to auto-submit
  dailySubmitCap: number;         // hard daily cap on auto-submitted apps
  perSourceCap: number;           // per-source cap (e.g., max 10 from LinkedIn/day)
  // Per-ATS tier: which tiers are allowed to auto-submit
  allowAutoSubmitTier1: boolean;
  allowAutoSubmitTier2: boolean;
  allowAutoSubmitTier3: boolean;
  // Per-job opt-out for auto-submit. Job IDs in this set will NEVER auto-submit.
  autoSubmitDenylist: string[];
  // Whether DeepSeek custom-question interpretation may run.
  useDeepSeekForQuestions: boolean;
  // Dry-run mode: the runner fills + advances but NEVER clicks the final
  // submit button, even when all gates pass. Designed for testing.
  dryRun: boolean;
}

export type SessionStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'finished';

export interface ApplySession {
  id: string;
  startedAt: number;
  endedAt?: number;
  status: SessionStatus;
  settings: ApplySessionSettings;
  jobIds: string[];
  currentJobId?: string;
  // Counters for fast UI
  submittedCount: number;
  reviewCount: number;
  blockedCount: number;
  failedCount: number;
  skippedCount: number;
  // Required for the sync layer.
  updatedAt: number;
}

const LLM_AUDIT_CAP = 500;

export const llmAuditStore = {
  list(): LlmAuditEntry[] { return read<LlmAuditEntry[]>(STORAGE_KEYS.llmAuditLog, []); },
  append(entry: LlmAuditEntry): void {
    const all = this.list();
    all.push(entry);
    // Keep most-recent N
    const trimmed = all.length > LLM_AUDIT_CAP ? all.slice(-LLM_AUDIT_CAP) : all;
    write(STORAGE_KEYS.llmAuditLog, trimmed);
  },
  clear(): void { write(STORAGE_KEYS.llmAuditLog, []); },
};

// ── Apply settings (global prefs) ────────────────────────────────────

export const APPLY_SETTINGS_DEFAULTS: ApplySettings = {
  confirmedSubmitAssistEnabled: false,
  defaultLlmRefinementEnabled: true,
  dailyVolumeWarnAt: 20,
  authenticityThreshold: 70,
  similarityThreshold: 0.8,
  updatedAt: 0,
};

export const applySettingsStore = {
  get(): ApplySettings {
    const s = read<ApplySettings | null>(STORAGE_KEYS.applySettings, null);
    if (!s) return { ...APPLY_SETTINGS_DEFAULTS };
    return { ...APPLY_SETTINGS_DEFAULTS, ...s };
  },
  save(s: ApplySettings): void {
    s.updatedAt = Date.now();
    write(STORAGE_KEYS.applySettings, s);
  },
};

// ── Application memory: per-ATS / per-domain learned signals ──────────
// Records what selectors worked / failed on real pages, which upload
// method took, what unknown questions came up, and the recent reliability.
// The agent reads this on next visit to the same domain so it can prefer
// what's known to work and pause faster on known-bad selectors.

export interface AppMemoryEntry {
  id: string;            // hash of `${atsType}::${hostname}`
  atsType: AtsType;
  hostname: string;
  lastSeenAt: number;
  visits: number;
  // Selectors that filled successfully at least once
  selectorsThatWorked: string[];
  // Selectors that failed (e.g., the input was disabled / detached / stale)
  selectorsThatFailed: string[];
  // Upload method last seen: 'native-file' | 'dropzone-with-input' | 'dropzone-unbound' | 'none'
  uploadMethod?: string;
  // Whether textareas accepted typed values (some React UIs reset on type)
  textareaTypingWorks?: boolean;
  // Unknown required questions we've seen at this domain (helps Moe
  // configure vault templates proactively).
  knownUnknownQuestions: string[];
  // Last seen blockers
  lastBlockerReasons: string[];
  // Rolling reliability — submit-ready %, last 10 visits
  rollingSubmitReady: number;
  // Notes the user can add (e.g., "always click 'Continue' twice")
  notes: string;
  updatedAt: number;
}

export const appMemoryStore = {
  list(): AppMemoryEntry[] { return read<AppMemoryEntry[]>(STORAGE_KEYS.applicationMemory, []); },
  save(es: AppMemoryEntry[]): void { write(STORAGE_KEYS.applicationMemory, es); },
  getOrCreate(atsType: AtsType, hostname: string): AppMemoryEntry {
    const id = `${atsType}::${hostname}`;
    const all = this.list();
    const existing = all.find(e => e.id === id);
    if (existing) return existing;
    const fresh: AppMemoryEntry = {
      id, atsType, hostname,
      lastSeenAt: Date.now(),
      visits: 0,
      selectorsThatWorked: [],
      selectorsThatFailed: [],
      knownUnknownQuestions: [],
      lastBlockerReasons: [],
      rollingSubmitReady: 0,
      notes: '',
      updatedAt: Date.now(),
    };
    return fresh;
  },
  upsert(e: AppMemoryEntry): void {
    e.updatedAt = Date.now();
    const all = this.list();
    const idx = all.findIndex(x => x.id === e.id);
    if (idx >= 0) all[idx] = e; else all.push(e);
    this.save(all);
  },
  remove(id: string): void {
    this.save(this.list().filter(e => e.id !== id));
  },
};

// ── Agent: Sessions, Attempts, Logs ───────────────────────────────────

export const SESSION_SETTINGS_DEFAULTS: ApplySessionSettings = {
  autonomyLevel: 2,
  fitThreshold: 60,
  authenticityThreshold: 70,
  qualityThreshold: 60,
  dailySubmitCap: 20,
  perSourceCap: 8,
  allowAutoSubmitTier1: true,
  allowAutoSubmitTier2: false,
  allowAutoSubmitTier3: false,
  autoSubmitDenylist: [],
  useDeepSeekForQuestions: true,
  dryRun: true, // SAFE DEFAULT — must be turned off explicitly to enable real submits
};

export const sessionsStore = {
  list(): ApplySession[] { return read<ApplySession[]>(STORAGE_KEYS.sessions, []); },
  save(s: ApplySession[]): void { write(STORAGE_KEYS.sessions, s); },
  upsert(s: ApplySession): void {
    const all = this.list();
    const idx = all.findIndex(x => x.id === s.id);
    s.updatedAt = Date.now();
    if (idx >= 0) all[idx] = s; else all.push(s);
    this.save(all);
  },
  get(id: string): ApplySession | undefined { return this.list().find(s => s.id === id); },
  active(): ApplySession | undefined {
    return this.list().find(s => s.status === 'running' || s.status === 'paused');
  },
  remove(id: string): void {
    this.save(this.list().filter(s => s.id !== id));
    notifyDeleted('session' as any, id);
  },
};

export const attemptsStore = {
  list(): ApplyAttempt[] { return read<ApplyAttempt[]>(STORAGE_KEYS.attempts, []); },
  save(a: ApplyAttempt[]): void { write(STORAGE_KEYS.attempts, a); },
  upsert(a: ApplyAttempt): void {
    const all = this.list();
    const idx = all.findIndex(x => x.id === a.id);
    a.updatedAt = Date.now();
    if (idx >= 0) all[idx] = a; else all.push(a);
    this.save(all);
  },
  get(id: string): ApplyAttempt | undefined { return this.list().find(a => a.id === id); },
  bySession(sessionId: string): ApplyAttempt[] {
    return this.list().filter(a => a.sessionId === sessionId);
  },
  byJob(jobId: string): ApplyAttempt[] {
    return this.list().filter(a => a.jobId === jobId);
  },
  needsReview(): ApplyAttempt[] {
    return this.list().filter(a => a.status === 'needs-review' || a.status === 'paused' || a.status === 'blocked');
  },
  remove(id: string): void {
    this.save(this.list().filter(a => a.id !== id));
  },
};

const AGENT_LOG_CAP = 2000; // per-page rolling cap; survives sync

export const agentLogStore = {
  list(): AgentLogEntry[] { return read<AgentLogEntry[]>(STORAGE_KEYS.agentLog, []); },
  save(l: AgentLogEntry[]): void { write(STORAGE_KEYS.agentLog, l); },
  append(entry: AgentLogEntry): void {
    const all = this.list();
    entry.updatedAt = Date.now();
    all.push(entry);
    const trimmed = all.length > AGENT_LOG_CAP ? all.slice(-AGENT_LOG_CAP) : all;
    this.save(trimmed);
  },
  appendMany(entries: AgentLogEntry[]): void {
    if (entries.length === 0) return;
    const all = this.list();
    const now = Date.now();
    for (const e of entries) e.updatedAt = e.updatedAt || now;
    const merged = [...all, ...entries];
    const trimmed = merged.length > AGENT_LOG_CAP ? merged.slice(-AGENT_LOG_CAP) : merged;
    this.save(trimmed);
  },
  forSession(sessionId: string): AgentLogEntry[] {
    return this.list().filter(e => e.sessionId === sessionId).sort((a, b) => a.at - b.at);
  },
  forAttempt(attemptId: string): AgentLogEntry[] {
    return this.list().filter(e => e.attemptId === attemptId).sort((a, b) => a.at - b.at);
  },
  clear(): void { write(STORAGE_KEYS.agentLog, []); },
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
  // Apply-cockpit payload — optional for backward-compat.
  vault?: ProfileVault;
  packets?: ApplicationPacket[];
  outcomes?: JobOutcome[];
  applySettings?: ApplySettings;
  sessions?: ApplySession[];
  attempts?: ApplyAttempt[];
  agentLog?: AgentLogEntry[];
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
    vault: vaultStore.get(),
    packets: packetsStore.list(),
    outcomes: outcomesStore.list(),
    applySettings: applySettingsStore.get(),
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
    if (backup.vault) vaultStore.save(backup.vault);
    if (Array.isArray(backup.packets)) packetsStore.save(backup.packets);
    if (Array.isArray(backup.outcomes)) outcomesStore.save(backup.outcomes);
    if (backup.applySettings) applySettingsStore.save(backup.applySettings);
    if (Array.isArray(backup.sessions)) sessionsStore.save(backup.sessions);
    if (Array.isArray(backup.attempts)) attemptsStore.save(backup.attempts);
    if (Array.isArray(backup.agentLog)) agentLogStore.save(backup.agentLog);
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
  if (Array.isArray(backup.packets)) {
    packetsStore.save(mergeBy(packetsStore.list(), backup.packets));
  }
  if (Array.isArray(backup.outcomes)) {
    outcomesStore.save(mergeBy(outcomesStore.list(), backup.outcomes));
  }
  if (Array.isArray(backup.sessions)) {
    sessionsStore.save(mergeBy(sessionsStore.list(), backup.sessions));
  }
  if (Array.isArray(backup.attempts)) {
    attemptsStore.save(mergeBy(attemptsStore.list(), backup.attempts));
  }
  if (Array.isArray(backup.agentLog)) {
    agentLogStore.save(mergeBy(agentLogStore.list(), backup.agentLog));
  }
  // Vault and settings: incoming wins if newer.
  if (backup.vault && (backup.vault.updatedAt ?? 0) > (vaultStore.get().updatedAt ?? 0)) {
    vaultStore.save(backup.vault);
  }
  if (backup.applySettings && (backup.applySettings.updatedAt ?? 0) > (applySettingsStore.get().updatedAt ?? 0)) {
    applySettingsStore.save(backup.applySettings);
  }
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
  packetsStore.save([]);
  outcomesStore.save([]);
  llmAuditStore.clear();
  writeRaw(DISCOVERY_KEYS.discoveredJobs, []);
  writeRaw(DISCOVERY_KEYS.sources, []);
  writeRaw(DISCOVERY_KEYS.watched, []);
  // Don't wipe vault, apply settings, or prefs — those are user settings.
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
