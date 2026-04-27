// Greenhouse public boards adapter.
//
// API: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
// CORS-friendly. Returns the entire public board for a single company.
// To use it, the user adds a Greenhouse-source SourceConfig with
// `params.slug = 'company-slug'`. We pull the full board, then the
// downstream filter narrows by Moe's role keywords.
//
// Why per-company instead of a global feed: there is no global "all
// Greenhouse jobs" endpoint. The right pattern is to maintain a small
// curated list of companies whose boards are worth watching.

import type { SourceConfig } from '../types';
import type { RawSourceJob } from './types';

const ENDPOINT = 'https://boards-api.greenhouse.io/v1/boards';

interface GHJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string;        // HTML when ?content=true
  updated_at?: string;
  metadata?: Array<{ name?: string; value?: string | string[] }>;
}

interface GHResponse {
  jobs?: GHJob[];
  meta?: { total?: number };
}

export async function fetchGreenhouse(source: SourceConfig): Promise<RawSourceJob[]> {
  const slug = source.params?.slug;
  if (!slug) throw new Error('Greenhouse source missing required `params.slug`');

  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(slug)}/jobs?content=true`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Greenhouse ${slug} returned ${res.status}`);

  const body = (await res.json()) as GHResponse;
  const jobs = body.jobs ?? [];
  // Title-case the slug for the human label ("acme-co" → "Acme Co").
  const company = slug
    .split(/[-_]+/)
    .map(w => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');

  return jobs.map(j => ({
    sourceType: 'greenhouse' as const,
    sourceLabel: `Greenhouse · ${company}`,
    sourceJobId: String(j.id),
    sourceUrl: j.absolute_url,
    title: j.title,
    company,
    location: j.location?.name,
    salaryRaw: extractSalaryFromMetadata(j.metadata),
    description: stripHtml(j.content ?? ''),
    publishedAt: j.updated_at ? Date.parse(j.updated_at) : undefined,
  }));
}

function extractSalaryFromMetadata(metadata?: GHJob['metadata']): string | undefined {
  if (!metadata) return undefined;
  for (const m of metadata) {
    if (!m.name) continue;
    if (/salary|comp|pay range|range/i.test(m.name)) {
      if (typeof m.value === 'string') return m.value;
      if (Array.isArray(m.value)) return m.value.join(' – ');
    }
  }
  return undefined;
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
