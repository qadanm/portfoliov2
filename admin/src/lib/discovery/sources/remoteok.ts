// Remote OK source. Public CORS-friendly JSON feed.
// API: https://remoteok.com/api  (returns an array; element [0] is metadata)
//
// The feed mixes every category — we filter with the source's `tags` param,
// matching against each posting's `tags` field. Default tags target Moe's
// role surface: design, frontend, ux, ui, product designer, design engineer.
//
// Tag matching is OR (any match keeps the row). Without a tag filter the
// feed would dump 100+ backend / DevOps / sales engineering listings on
// every run.

import type { SourceConfig } from '../types';
import type { RawSourceJob } from './types';

const ENDPOINT = 'https://remoteok.com/api';

interface RemoteOkRow {
  id: string | number;
  slug?: string;
  position?: string;
  company?: string;
  location?: string;
  tags?: string[];
  description?: string;
  url?: string;
  apply_url?: string;
  date?: string;
  salary_min?: number | string;
  salary_max?: number | string;
}

const DEFAULT_TAGS = ['design', 'frontend', 'front-end', 'ux', 'ui', 'product designer', 'design engineer', 'react', 'typescript'];

export async function fetchRemoteOk(source: SourceConfig): Promise<RawSourceJob[]> {
  const tagsParam = source.params?.tags;
  const tags = (tagsParam ? tagsParam.split(',') : DEFAULT_TAGS)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);

  const res = await fetch(ENDPOINT, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Remote OK returned ${res.status}`);

  const body = (await res.json()) as RemoteOkRow[];
  // The first element is metadata, drop it.
  const rows = Array.isArray(body) ? body.slice(1) : [];

  const matches: RawSourceJob[] = [];
  for (const r of rows) {
    if (!r.position || !r.company) continue;
    const rowTags = (r.tags ?? []).map(t => String(t).toLowerCase());
    const haystack = `${r.position} ${rowTags.join(' ')}`.toLowerCase();
    // OR match: any keyword anywhere wins.
    const hit = tags.some(t => haystack.includes(t));
    if (!hit) continue;

    const salaryRaw = r.salary_min && r.salary_max
      ? `$${Math.round(Number(r.salary_min) / 1000)}k–$${Math.round(Number(r.salary_max) / 1000)}k`
      : undefined;

    matches.push({
      sourceType: 'remoteok',
      sourceLabel: 'Remote OK',
      sourceJobId: String(r.id),
      sourceUrl: r.url || `https://remoteok.com/remote-jobs/${r.slug ?? r.id}`,
      applyUrl: r.apply_url,
      title: r.position,
      company: r.company,
      location: r.location,
      salaryRaw,
      description: stripHtml(r.description ?? ''),
      publishedAt: r.date ? Date.parse(r.date) : undefined,
    });
  }
  return matches;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/?(p|br|div|li|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
