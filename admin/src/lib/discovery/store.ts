// localStorage-backed stores for the discovery system. Mirrors the pattern
// in lib/storage.ts (qa_ prefix, same change-event protocol so the cross-
// device sync layer picks them up automatically).

import type {
  DiscoveredJob,
  SourceConfig,
  DiscoveryRun,
  DiscoveryPreferences,
  WatchedCompany,
} from './types';
import { CURATED_BOARDS } from './curated';

const KEYS = {
  discovered: 'qa_discovered_jobs',
  sources: 'qa_discovery_sources',
  runs: 'qa_discovery_runs',
  prefs: 'qa_discovery_prefs',
  watched: 'qa_watched_companies',
} as const;

const DEFAULT_PREFS: DiscoveryPreferences = {
  remoteOnly: true,
  minSalary: 150_000,
  minScore: 50,
  excludeKeywords: [
    'graphic designer',
    'print designer',
    'social media designer',
    'junior',
    'intern',
    'entry level',
    'entry-level',
  ],
  autoQueueThreshold: 75,
  excludeContract: false,
  excludeJunior: true,
  autoPollEnabled: false,
  autoPollIntervalMinutes: 180,
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return safeParse<T>(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err: unknown) {
    try {
      const message = err instanceof Error ? err.message : String(err);
      window.dispatchEvent(new CustomEvent('qa-storage-error', { detail: { key, message } }));
      // eslint-disable-next-line no-console
      console.error(`[qa-storage] discovery write failed for ${key}:`, message);
    } catch { /* no-op */ }
    return;
  }
  try {
    window.dispatchEvent(new CustomEvent('qa-data-changed', { detail: { key } }));
  } catch { /* no-op */ }
}

// ── DiscoveredJob ─────────────────────────────────────────────────────

export const discoveredStore = {
  list(): DiscoveredJob[] {
    return read<DiscoveredJob[]>(KEYS.discovered, []);
  },
  save(jobs: DiscoveredJob[]): void {
    write(KEYS.discovered, jobs);
  },
  upsert(job: DiscoveredJob): void {
    const all = this.list();
    const idx = all.findIndex(j => j.id === job.id);
    if (idx >= 0) all[idx] = job; else all.push(job);
    this.save(all);
  },
  /** Insert many; existing ids keep their lifecycle status (queued, etc.). */
  upsertMany(jobs: DiscoveredJob[]): { inserted: number; updated: number } {
    const all = this.list();
    const byId = new Map(all.map(j => [j.id, j]));
    let inserted = 0, updated = 0;
    for (const j of jobs) {
      const existing = byId.get(j.id);
      if (existing) {
        // Preserve user decisions; refresh score and discoveredAt.
        byId.set(j.id, {
          ...j,
          status: existing.status,
          queuedAt: existing.queuedAt,
          savedAt: existing.savedAt,
          dismissedAt: existing.dismissedAt,
          queuedJobId: existing.queuedJobId,
        });
        updated++;
      } else {
        byId.set(j.id, j);
        inserted++;
      }
    }
    this.save(Array.from(byId.values()));
    return { inserted, updated };
  },
  get(id: string): DiscoveredJob | undefined {
    return this.list().find(j => j.id === id);
  },
  remove(id: string): void {
    this.save(this.list().filter(j => j.id !== id));
  },
  /** Drop everything — used by the "clear all" admin button. */
  clear(): void {
    this.save([]);
  },
  /** Drop dismissed jobs older than N days (housekeeping). */
  pruneDismissed(maxAgeDays = 14): number {
    const cutoff = Date.now() - maxAgeDays * 86_400_000;
    const before = this.list();
    const after = before.filter(j => j.status !== 'dismissed' || (j.dismissedAt ?? 0) > cutoff);
    this.save(after);
    return before.length - after.length;
  },
};

// ── SourceConfig ──────────────────────────────────────────────────────

export const sourceStore = {
  list(): SourceConfig[] {
    const raw = read<SourceConfig[]>(KEYS.sources, []);
    if (raw.length === 0) {
      // First boot — seed with the curated default mix.
      const seeded = defaultSources();
      this.save(seeded);
      return seeded;
    }
    // Backward-compat: graft curated entries onto stores that pre-date them.
    // Existing user toggles are preserved (we only add ids that aren't there).
    let needsSave = false;
    const ids = new Set(raw.map(s => s.id));
    const merged = [...raw];
    for (const s of defaultSources()) {
      if (!ids.has(s.id) && s.curated) {
        merged.push(s);
        needsSave = true;
      }
    }
    if (needsSave) this.save(merged);
    return merged;
  },
  save(sources: SourceConfig[]): void {
    write(KEYS.sources, sources);
  },
  upsert(source: SourceConfig): void {
    const all = this.list();
    const idx = all.findIndex(s => s.id === source.id);
    if (idx >= 0) all[idx] = source; else all.push(source);
    this.save(all);
  },
  remove(id: string): void {
    this.save(this.list().filter(s => s.id !== id));
  },
  /**
   * Update health metrics after a run. Reliability is an exponential
   * moving average so a single failure dings it but doesn't crash the
   * whole signal.
   */
  recordOutcome(id: string, success: boolean, error?: string, resultCount?: number): void {
    const list = this.list();
    const s = list.find(x => x.id === id);
    if (!s) return;
    const prev = s.reliability ?? 1;
    s.reliability = Math.max(0, Math.min(1, prev * 0.7 + (success ? 1 : 0) * 0.3));
    s.lastRunAt = Date.now();
    s.lastResultCount = resultCount;
    s.lastError = success ? undefined : error;
    if (success) {
      s.consecutiveSuccesses = (s.consecutiveSuccesses ?? 0) + 1;
      s.consecutiveErrors = 0;
    } else {
      s.consecutiveErrors = (s.consecutiveErrors ?? 0) + 1;
      s.consecutiveSuccesses = 0;
    }
    if ((s.consecutiveErrors ?? 0) >= 3) s.status = 'failing';
    else if (success) s.status = 'active';
    this.save(list);
  },
  /** Reset to the curated defaults. */
  reseed(): void {
    this.save(defaultSources());
  },
  /** Reset only curated sources (preserve user-added watched + non-curated). */
  reseedCurated(): void {
    const existing = this.list().filter(s => !s.curated);
    const fresh = defaultSources().filter(s => s.curated);
    this.save([...existing, ...fresh]);
  },
};

// ── WatchedCompany ────────────────────────────────────────────────────

export const watchedStore = {
  list(): WatchedCompany[] {
    return read<WatchedCompany[]>(KEYS.watched, []);
  },
  save(rows: WatchedCompany[]): void {
    write(KEYS.watched, rows);
  },
  upsert(row: WatchedCompany): void {
    const all = this.list();
    const idx = all.findIndex(x => x.id === row.id);
    if (idx >= 0) all[idx] = row; else all.push(row);
    this.save(all);
  },
  remove(id: string): void {
    this.save(this.list().filter(x => x.id !== id));
  },
  get(id: string): WatchedCompany | undefined {
    return this.list().find(x => x.id === id);
  },
};

function defaultSources(): SourceConfig[] {
  const now: Partial<SourceConfig> = {
    status: 'active',
    reliability: 1,
    consecutiveSuccesses: 0,
    consecutiveErrors: 0,
  };
  const base: SourceConfig[] = [
    {
      ...now,
      id: 'remotive-design',
      type: 'remotive',
      name: 'Remotive · Design',
      enabled: true,
      params: { category: 'design' },
      notes: 'Public API. Remote-first design roles.',
    },
    {
      ...now,
      id: 'remotive-software-dev',
      type: 'remotive',
      name: 'Remotive · Software Dev',
      enabled: true,
      params: { category: 'software-dev' },
      notes: 'Public API. Catches Frontend/Design Engineer roles.',
    },
    {
      ...now,
      id: 'hn-hiring',
      type: 'hn-hiring',
      name: 'HN — Who is hiring',
      enabled: true,
      params: { keywords: 'design,frontend,ux,product designer,design engineer,react' },
      notes: 'Algolia-backed search of the latest "Who is hiring?" thread.',
    },
    {
      ...now,
      id: 'manual-paste',
      type: 'manual-paste',
      name: 'Email alert paste',
      enabled: true,
      notes: 'Paste a block of email-alert text. Parses URLs and titles.',
    },
  ];
  // Curated boards are seeded as sources but disabled by default to avoid
  // overloading the first run. Moe enables what they want from the panel.
  const curated: SourceConfig[] = CURATED_BOARDS.map(b => ({
    id: `${b.type}-${b.slug}`,
    type: b.type,
    name: `${b.type === 'greenhouse' ? 'Greenhouse' : 'Lever'} · ${b.companyName}`,
    companyName: b.companyName,
    slug: b.slug,
    boardUrl: b.boardUrl,
    params: { slug: b.slug },
    enabled: false,
    curated: true,
    status: 'active',
    reliability: 1,
    consecutiveSuccesses: 0,
    consecutiveErrors: 0,
    notes: b.notes,
  }));
  return [...base, ...curated];
}

// ── DiscoveryRun ──────────────────────────────────────────────────────

export const runStore = {
  list(): DiscoveryRun[] {
    return read<DiscoveryRun[]>(KEYS.runs, []);
  },
  save(runs: DiscoveryRun[]): void {
    // Keep last 30 runs only — anything older is noise.
    write(KEYS.runs, runs.slice(-30));
  },
  add(run: DiscoveryRun): void {
    this.save([...this.list(), run]);
  },
  last(): DiscoveryRun | undefined {
    const all = this.list();
    return all[all.length - 1];
  },
};

// ── DiscoveryPreferences ──────────────────────────────────────────────

export const prefsStore = {
  get(): DiscoveryPreferences {
    return { ...DEFAULT_PREFS, ...read<Partial<DiscoveryPreferences>>(KEYS.prefs, {}) };
  },
  set(prefs: DiscoveryPreferences): void {
    write(KEYS.prefs, prefs);
  },
  reset(): void {
    write(KEYS.prefs, DEFAULT_PREFS);
  },
};
