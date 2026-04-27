// Watch this company. Detects whether the source URL points at a public
// Greenhouse or Lever board; if yes, creates an active SourceConfig so the
// next discovery run pulls every open role at that company. If no, stores
// a WatchedCompany record for the user to set up manually.

import type {
  DiscoveredJob,
  SourceConfig,
  WatchedCompany,
  DiscoverySourceType,
} from './types';
import { sourceStore, watchedStore } from './store';

interface PlatformDetect {
  platform: 'greenhouse' | 'lever' | 'unsupported';
  slug?: string;
  boardUrl?: string;
}

export function detectPlatform(url: string | undefined): PlatformDetect {
  if (!url) return { platform: 'unsupported' };
  let parsed: URL;
  try { parsed = new URL(url); } catch { return { platform: 'unsupported' }; }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  if (host.endsWith('greenhouse.io') || host === 'job-boards.greenhouse.io' || host === 'boards.greenhouse.io') {
    // boards.greenhouse.io/{slug}/jobs/{id}  OR  job-boards.greenhouse.io/{slug}/jobs/{id}
    const m = path.match(/^\/(?:embed\/)?([^/]+)/);
    if (m && m[1] && m[1] !== 'jobs') {
      const slug = m[1];
      return {
        platform: 'greenhouse',
        slug,
        boardUrl: `https://boards.greenhouse.io/${slug}`,
      };
    }
  }

  if (host.endsWith('lever.co')) {
    const m = path.match(/^\/([^/]+)/);
    if (m && m[1]) {
      const slug = m[1];
      return {
        platform: 'lever',
        slug,
        boardUrl: `https://jobs.lever.co/${slug}`,
      };
    }
  }

  return { platform: 'unsupported' };
}

export type WatchOutcome =
  | { kind: 'watching'; source: SourceConfig; message: string }
  | { kind: 'already-watching'; source: SourceConfig; message: string }
  | { kind: 'saved-unsupported'; watched: WatchedCompany; message: string }
  | { kind: 'error'; message: string };

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export function watchCompany(job: DiscoveredJob): WatchOutcome {
  // Try the apply URL first (often the canonical board URL); fall back to source.
  const detected = detectPlatform(job.applyUrl) ?? detectPlatform(job.sourceUrl);
  const source = detected.platform !== 'unsupported' ? detected : detectPlatform(job.sourceUrl);

  if (source.platform !== 'unsupported' && source.slug) {
    const id = `${source.platform}-${source.slug}`;
    const existing = sourceStore.list().find(s => s.id === id);
    if (existing) {
      // Promote / re-enable. Mark as watched so the panel groups it.
      const updated: SourceConfig = {
        ...existing,
        watched: true,
        enabled: true,
        companyName: existing.companyName ?? job.company,
        boardUrl: existing.boardUrl ?? source.boardUrl,
      };
      sourceStore.upsert(updated);
      return {
        kind: 'already-watching',
        source: updated,
        message: `Already watching ${job.company} — re-enabled.`,
      };
    }

    const fresh: SourceConfig = {
      id,
      type: source.platform as DiscoverySourceType,
      name: `${source.platform === 'greenhouse' ? 'Greenhouse' : 'Lever'} · ${job.company}`,
      companyName: job.company,
      slug: source.slug,
      boardUrl: source.boardUrl,
      params: { slug: source.slug },
      enabled: true,
      watched: true,
      curated: false,
      status: 'active',
      reliability: 1,
      consecutiveErrors: 0,
      consecutiveSuccesses: 0,
    };
    sourceStore.upsert(fresh);
    return {
      kind: 'watching',
      source: fresh,
      message: `Now watching ${job.company} via ${source.platform === 'greenhouse' ? 'Greenhouse' : 'Lever'}.`,
    };
  }

  // No supported platform detected — save as a manual watched company.
  const watchedId = `wc-${slugify(job.company)}`;
  const existingWatched = watchedStore.get(watchedId);
  if (existingWatched) {
    return {
      kind: 'saved-unsupported',
      watched: existingWatched,
      message: `Already saved ${job.company}. Add its board URL to start watching.`,
    };
  }
  const watched: WatchedCompany = {
    id: watchedId,
    companyName: job.company,
    originalJobUrl: job.applyUrl ?? job.sourceUrl,
    detectedPlatform: 'unsupported',
    status: 'needs-setup',
    createdAt: Date.now(),
  };
  watchedStore.upsert(watched);
  return {
    kind: 'saved-unsupported',
    watched,
    message: `Saved ${job.company}. Add a Greenhouse or Lever board URL when you have it.`,
  };
}

/**
 * Promote a WatchedCompany to an active SourceConfig once the user has
 * pasted in a board URL. Detects the platform from the URL and removes the
 * WatchedCompany row on success.
 */
export function promoteWatched(id: string, boardUrl: string): WatchOutcome {
  const wc = watchedStore.get(id);
  if (!wc) return { kind: 'error', message: 'Watched company not found.' };
  const detected = detectPlatform(boardUrl);
  if (detected.platform === 'unsupported' || !detected.slug) {
    return {
      kind: 'error',
      message: 'That URL is not a supported Greenhouse or Lever board.',
    };
  }

  const sourceId = `${detected.platform}-${detected.slug}`;
  const fresh: SourceConfig = {
    id: sourceId,
    type: detected.platform as DiscoverySourceType,
    name: `${detected.platform === 'greenhouse' ? 'Greenhouse' : 'Lever'} · ${wc.companyName}`,
    companyName: wc.companyName,
    slug: detected.slug,
    boardUrl: detected.boardUrl,
    params: { slug: detected.slug },
    enabled: true,
    watched: true,
    curated: false,
    status: 'active',
    reliability: 1,
    consecutiveErrors: 0,
    consecutiveSuccesses: 0,
  };
  sourceStore.upsert(fresh);
  watchedStore.remove(id);
  return {
    kind: 'watching',
    source: fresh,
    message: `Now watching ${wc.companyName}.`,
  };
}
