// Cross-device sync layer. Talks to the /api/sync Pages Function (which is
// backed by a Cloudflare KV namespace and gated by Cloudflare Access).
//
// Design:
//   • Local storage is the source of truth for the working session — every
//     read still hits localStorage so the UI stays instant.
//   • On load, init() pulls the cloud blob, merges it with local using
//     per-record `updatedAt`, writes the merged result back locally, then
//     pushes up if the merged result is newer than what the cloud had.
//   • On every write through the storage layer, notifyChange() debounces a
//     push with the current local state.
//   • Tombstones (per-record { type, id, deletedAt }) propagate deletes
//     across devices. Without them a deleted record would resurrect itself
//     on the next pull.
//   • Periodic poll every 60s catches background updates from another
//     device. Cheap; runs only while the page is visible.

import {
  jobsStore,
  recruitersStore,
  lettersStore,
  STORAGE_KEYS,
  SCHEMA_VERSION,
  type Job,
  type Recruiter,
  type SavedLetter,
} from './storage';

// ── Types ────────────────────────────────────────────────────────────

export type RecordType = 'job' | 'recruiter' | 'letter';
export interface Tombstone {
  type: RecordType;
  id: string;
  deletedAt: number;
}

export interface SyncState {
  schemaVersion: number;
  jobs: Job[];
  recruiters: Recruiter[];
  letters: SavedLetter[];
  tombstones: Tombstone[];
  // The wall-clock timestamp this device produced the snapshot. Used for
  // tie-breaking when neither side has a newer per-record timestamp.
  exportedAt: number;
}

export type SyncStatus =
  | 'idle'
  | 'pulling'
  | 'pushing'
  | 'synced'
  | 'offline'
  | 'unconfigured'
  | 'error';

export interface SyncStatusEvent {
  status: SyncStatus;
  message?: string;
  lastSyncedAt?: number;
}

const TOMBSTONE_KEY = 'qa_tombstones';
const LAST_SYNCED_KEY = 'qa_last_synced_at';
const TOMBSTONE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const PUSH_DEBOUNCE_MS = 1500;
const POLL_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 12_000;

// ── Tombstone storage ────────────────────────────────────────────────

export function listTombstones(): Tombstone[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as Tombstone[];
    // Drop ancient tombstones — both devices have long since converged.
    const cutoff = Date.now() - TOMBSTONE_MAX_AGE_MS;
    return all.filter(t => t.deletedAt > cutoff);
  } catch {
    return [];
  }
}

export function saveTombstones(stones: Tombstone[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(stones));
}

export function recordTombstone(type: RecordType, id: string): void {
  const all = listTombstones();
  // De-dupe by (type,id) — keep the latest deletion timestamp.
  const filtered = all.filter(t => !(t.type === type && t.id === id));
  filtered.push({ type, id, deletedAt: Date.now() });
  saveTombstones(filtered);
}

// ── Snapshot build / apply ───────────────────────────────────────────

export function buildLocalSnapshot(): SyncState {
  return {
    schemaVersion: SCHEMA_VERSION,
    jobs: jobsStore.list(),
    recruiters: recruitersStore.list(),
    letters: lettersStore.list(),
    tombstones: listTombstones(),
    exportedAt: Date.now(),
  };
}

function applySnapshot(snap: SyncState): void {
  // Direct localStorage write; do NOT route through the stores since their
  // upsert() bumps updatedAt and would overwrite synced timestamps.
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.jobs, JSON.stringify(snap.jobs));
  localStorage.setItem(STORAGE_KEYS.recruiters, JSON.stringify(snap.recruiters));
  localStorage.setItem(STORAGE_KEYS.letters, JSON.stringify(snap.letters));
  saveTombstones(snap.tombstones);
}

// ── Merge ────────────────────────────────────────────────────────────

interface Stamped { id: string; updatedAt?: number; createdAt?: number }

function getStamp(rec: Stamped): number {
  return Number(rec.updatedAt ?? rec.createdAt ?? 0);
}

function tombstoneKey(t: Tombstone): string {
  return `${t.type}:${t.id}`;
}

// Merge two arrays of records by id, taking the side with the higher
// updatedAt for each record. Tombstones override either side: any record
// whose (type,id) matches a tombstone newer than its updatedAt is dropped.
function mergeRecords<T extends Stamped>(
  type: RecordType,
  local: T[],
  remote: T[],
  tombstones: Map<string, Tombstone>,
): T[] {
  const map = new Map<string, T>();
  for (const r of local) map.set(r.id, r);
  for (const r of remote) {
    const cur = map.get(r.id);
    if (!cur || getStamp(r) > getStamp(cur)) map.set(r.id, r);
  }
  const out: T[] = [];
  for (const r of map.values()) {
    const t = tombstones.get(`${type}:${r.id}`);
    if (t && t.deletedAt >= getStamp(r)) continue;
    out.push(r);
  }
  return out;
}

function mergeTombstones(local: Tombstone[], remote: Tombstone[]): Tombstone[] {
  const map = new Map<string, Tombstone>();
  for (const t of local) {
    const k = tombstoneKey(t);
    const cur = map.get(k);
    if (!cur || t.deletedAt > cur.deletedAt) map.set(k, t);
  }
  for (const t of remote) {
    const k = tombstoneKey(t);
    const cur = map.get(k);
    if (!cur || t.deletedAt > cur.deletedAt) map.set(k, t);
  }
  return [...map.values()];
}

export function mergeSnapshots(local: SyncState, remote: SyncState): SyncState {
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  const tMap = new Map<string, Tombstone>();
  for (const t of tombstones) tMap.set(tombstoneKey(t), t);

  return {
    schemaVersion: Math.max(local.schemaVersion, remote.schemaVersion),
    jobs: mergeRecords('job', local.jobs, remote.jobs, tMap),
    recruiters: mergeRecords('recruiter', local.recruiters, remote.recruiters, tMap),
    letters: mergeRecords('letter', local.letters, remote.letters, tMap),
    tombstones,
    exportedAt: Math.max(local.exportedAt, remote.exportedAt),
  };
}

// Detects whether two snapshots are byte-equivalent for the data we care
// about. Used to skip pushing a "merged" result that is identical to what
// the server already has.
export function snapshotsEqual(a: SyncState, b: SyncState): boolean {
  return (
    JSON.stringify(a.jobs) === JSON.stringify(b.jobs) &&
    JSON.stringify(a.recruiters) === JSON.stringify(b.recruiters) &&
    JSON.stringify(a.letters) === JSON.stringify(b.letters) &&
    JSON.stringify(a.tombstones) === JSON.stringify(b.tombstones)
  );
}

// ── Network ──────────────────────────────────────────────────────────

type PullResult =
  | { kind: 'ok'; state: SyncState; updatedAt: number }
  | { kind: 'empty' } // no cloud blob yet
  | { kind: 'unconfigured'; message: string } // KV binding missing
  | { kind: 'unavailable'; message: string } // network error / dev mode
  | { kind: 'error'; message: string };

async function pullFromCloud(signal?: AbortSignal): Promise<PullResult> {
  let res: Response;
  try {
    res = await fetch('/api/sync', { method: 'GET', signal });
  } catch (e: any) {
    return { kind: 'unavailable', message: e?.name === 'AbortError' ? 'Pull timed out.' : 'Network error.' };
  }
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    // 404 with HTML = function not running (dev mode).
    return {
      kind: 'unavailable',
      message: res.status === 404
        ? 'Sync endpoint not running (deploy or use wrangler).'
        : `Sync returned non-JSON (${res.status}).`,
    };
  }
  let body: any;
  try {
    body = await res.json();
  } catch {
    return { kind: 'error', message: 'Sync returned malformed JSON.' };
  }
  if (res.status === 503 && body?.error === 'kv-binding-missing') {
    return { kind: 'unconfigured', message: body.message };
  }
  if (!res.ok || body?.ok === false) {
    return { kind: 'error', message: body?.message ?? `Sync failed (${res.status}).` };
  }
  if (body.empty) return { kind: 'empty' };
  if (!body.state) return { kind: 'empty' };
  return {
    kind: 'ok',
    state: normalizeState(body.state),
    updatedAt: Number(body.updatedAt ?? 0),
  };
}

interface PushResult {
  ok: boolean;
  message?: string;
  updatedAt?: number;
}

async function pushToCloud(state: SyncState, signal?: AbortSignal): Promise<PushResult> {
  let res: Response;
  try {
    res = await fetch('/api/sync', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, updatedAt: state.exportedAt }),
      signal,
    });
  } catch (e: any) {
    return { ok: false, message: e?.name === 'AbortError' ? 'Push timed out.' : 'Network error.' };
  }
  let body: any;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok || body?.ok === false) {
    return { ok: false, message: body?.message ?? `Push failed (${res.status}).` };
  }
  return { ok: true, updatedAt: Number(body?.updatedAt ?? state.exportedAt) };
}

// Coerce an incoming "state" into the SyncState shape, filling defaults for
// any fields the older client may have omitted.
function normalizeState(raw: any): SyncState {
  return {
    schemaVersion: Number(raw?.schemaVersion ?? SCHEMA_VERSION),
    jobs: Array.isArray(raw?.jobs) ? raw.jobs : [],
    recruiters: Array.isArray(raw?.recruiters) ? raw.recruiters : [],
    letters: Array.isArray(raw?.letters) ? raw.letters : [],
    tombstones: Array.isArray(raw?.tombstones) ? raw.tombstones : [],
    exportedAt: Number(raw?.exportedAt ?? 0),
  };
}

// ── Sync manager ─────────────────────────────────────────────────────

type Listener = (e: SyncStatusEvent) => void;

interface SyncManager {
  init(): Promise<void>;
  notifyChange(): void;
  forcePull(): Promise<void>;
  forcePush(): Promise<void>;
  status(): SyncStatusEvent;
  subscribe(fn: Listener): () => void;
  isConfigured(): boolean;
  lastSyncedAt(): number;
}

function createSyncManager(): SyncManager {
  let current: SyncStatusEvent = { status: 'idle' };
  const listeners = new Set<Listener>();
  let configured = true;
  let initialized = false;

  let pushTimer: number | null = null;
  let pollTimer: number | null = null;
  let inflight: AbortController | null = null;

  function setStatus(next: SyncStatusEvent) {
    current = next;
    for (const fn of listeners) {
      try { fn(next); } catch { /* listener error, swallow */ }
    }
  }

  function getLastSynced(): number {
    if (typeof window === 'undefined') return 0;
    return Number(localStorage.getItem(LAST_SYNCED_KEY) ?? 0);
  }
  function setLastSynced(t: number) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LAST_SYNCED_KEY, String(t));
  }

  async function pullAndMerge(): Promise<void> {
    setStatus({ status: 'pulling' });
    inflight?.abort();
    inflight = new AbortController();
    const timer = setTimeout(() => inflight?.abort(), FETCH_TIMEOUT_MS);
    try {
      const pull = await pullFromCloud(inflight.signal);
      if (pull.kind === 'unconfigured') {
        configured = false;
        setStatus({ status: 'unconfigured', message: pull.message });
        return;
      }
      if (pull.kind === 'unavailable') {
        setStatus({ status: 'offline', message: pull.message, lastSyncedAt: getLastSynced() });
        return;
      }
      if (pull.kind === 'error') {
        setStatus({ status: 'error', message: pull.message, lastSyncedAt: getLastSynced() });
        return;
      }
      const local = buildLocalSnapshot();
      const remote = pull.kind === 'empty' ? null : pull.state;

      if (!remote) {
        // First-time push.
        setStatus({ status: 'pushing' });
        const push = await pushToCloud(local, inflight.signal);
        if (!push.ok) {
          setStatus({ status: 'error', message: push.message, lastSyncedAt: getLastSynced() });
          return;
        }
        setLastSynced(Date.now());
        setStatus({ status: 'synced', lastSyncedAt: getLastSynced() });
        return;
      }

      const merged = mergeSnapshots(local, remote);
      // If the merge differs from local, apply it locally and notify the
      // page so views can refresh.
      if (!snapshotsEqual(merged, local)) {
        applySnapshot(merged);
        broadcastDataChanged();
      }
      // If the merge differs from remote, push it back.
      if (!snapshotsEqual(merged, remote)) {
        setStatus({ status: 'pushing' });
        const push = await pushToCloud(merged, inflight.signal);
        if (!push.ok) {
          setStatus({ status: 'error', message: push.message, lastSyncedAt: getLastSynced() });
          return;
        }
      }
      setLastSynced(Date.now());
      setStatus({ status: 'synced', lastSyncedAt: getLastSynced() });
    } finally {
      clearTimeout(timer);
    }
  }

  async function pushNow(): Promise<void> {
    if (!configured) return;
    setStatus({ status: 'pushing' });
    inflight?.abort();
    inflight = new AbortController();
    const timer = setTimeout(() => inflight?.abort(), FETCH_TIMEOUT_MS);
    try {
      const local = buildLocalSnapshot();
      const push = await pushToCloud(local, inflight.signal);
      if (!push.ok) {
        setStatus({ status: 'error', message: push.message, lastSyncedAt: getLastSynced() });
        return;
      }
      setLastSynced(Date.now());
      setStatus({ status: 'synced', lastSyncedAt: getLastSynced() });
    } finally {
      clearTimeout(timer);
    }
  }

  function startPolling() {
    if (pollTimer != null) return;
    pollTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      // Pulls only — pushes are handled by notifyChange's debounce.
      pullAndMerge().catch(() => { /* surfaced via setStatus */ });
    }, POLL_INTERVAL_MS);
  }

  return {
    isConfigured: () => configured,
    lastSyncedAt: () => getLastSynced(),
    status: () => current,

    subscribe(fn) {
      listeners.add(fn);
      // Replay the latest status to the new subscriber so it can render.
      try { fn(current); } catch { /* ignore */ }
      return () => listeners.delete(fn);
    },

    async init() {
      if (initialized) return;
      initialized = true;
      if (typeof window === 'undefined') return;

      // Listen for storage-layer events: every write debounces a push;
      // every delete records a tombstone first.
      window.addEventListener('qa-record-deleted', (e: Event) => {
        const detail = (e as CustomEvent).detail as { type?: RecordType; id?: string };
        if (detail?.type && detail?.id) recordTombstone(detail.type, detail.id);
      });
      window.addEventListener('qa-data-changed', () => {
        // Debounce a push.
        if (typeof window === 'undefined') return;
        if (!configured) return;
        if (pushTimer != null) clearTimeout(pushTimer);
        pushTimer = window.setTimeout(() => {
          pushNow().catch(() => {});
        }, PUSH_DEBOUNCE_MS);
      });

      await pullAndMerge().catch(() => { /* status set inside */ });
      startPolling();
      // Re-pull when the tab regains focus — the other device may have
      // pushed while we were away.
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          pullAndMerge().catch(() => {});
        }
      });
    },

    notifyChange() {
      if (typeof window === 'undefined') return;
      if (!configured) return;
      if (pushTimer != null) clearTimeout(pushTimer);
      pushTimer = window.setTimeout(() => {
        pushNow().catch(() => {});
      }, PUSH_DEBOUNCE_MS);
    },

    async forcePull() { await pullAndMerge(); },
    async forcePush() { await pushNow(); },
  };
}

// Singleton — there should only ever be one sync manager per page.
const sync: SyncManager = createSyncManager();
export default sync;

// ── Cross-tab / same-page broadcast ──────────────────────────────────
// When a merged pull updates localStorage, downstream views (today, jobs,
// etc.) need to re-read. We dispatch a custom event they can listen for;
// the storage layer also fires the standard 'storage' event because we
// write through localStorage directly, so two tabs in the same browser
// get free updates.

const DATA_EVENT = 'qa-data-changed';

export function broadcastDataChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DATA_EVENT));
}

export function onDataChanged(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = () => fn();
  window.addEventListener(DATA_EVENT, listener);
  // Cross-tab: another tab in the same browser writes localStorage → 'storage'
  // event fires here. Treat it the same.
  const storageListener = (e: StorageEvent) => {
    if (e.key && (e.key.startsWith('qa_') || e.key === STORAGE_KEYS.jobs)) fn();
  };
  window.addEventListener('storage', storageListener);
  return () => {
    window.removeEventListener(DATA_EVENT, listener);
    window.removeEventListener('storage', storageListener);
  };
}
