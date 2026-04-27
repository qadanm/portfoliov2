// Ashby public job-board adapter.
//
// API: https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true
// CORS-friendly. Returns the entire public board for a single company.
// Like Greenhouse / Lever, requires a per-company slug — there is no
// global feed.
//
// Why this matters: a lot of AI-native companies (Cursor / Anysphere,
// Perplexity, Inflection, Suno, Mistral) host on Ashby. Without this
// adapter those boards are effectively invisible to the discovery engine.

import type { SourceConfig } from '../types';
import type { RawSourceJob } from './types';

const ENDPOINT = 'https://api.ashbyhq.com/posting-api/job-board';

interface AshbyPosting {
  id: string;
  title: string;
  jobUrl: string;
  applyUrl?: string;
  location?: string;
  locationName?: string;
  isRemote?: boolean;
  publishedDate?: string;
  descriptionPlain?: string;
  description?: string;
  compensation?: {
    summaryComponents?: Array<{
      summary?: string;
      compensationType?: string;
      currencyCode?: string;
      minValue?: number;
      maxValue?: number;
      interval?: string;
    }>;
  };
}

interface AshbyResponse {
  jobs?: AshbyPosting[];
}

export async function fetchAshby(source: SourceConfig): Promise<RawSourceJob[]> {
  const slug = source.params?.slug;
  if (!slug) throw new Error('Ashby source missing required `params.slug`');

  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(slug)}?includeCompensation=true`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Ashby ${slug} returned ${res.status}`);

  const body = (await res.json()) as AshbyResponse;
  const postings = body.jobs ?? [];
  const company = slug
    .split(/[-_]+/)
    .map(w => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');

  return postings.map(p => ({
    sourceType: 'ashby' as const,
    sourceLabel: `Ashby · ${company}`,
    sourceJobId: p.id,
    sourceUrl: p.jobUrl,
    applyUrl: p.applyUrl ?? p.jobUrl,
    title: p.title,
    company,
    location: p.locationName ?? p.location ?? (p.isRemote ? 'Remote' : undefined),
    salaryRaw: extractSalary(p),
    description: p.descriptionPlain ?? stripHtml(p.description ?? ''),
    publishedAt: p.publishedDate ? Date.parse(p.publishedDate) : undefined,
  }));
}

function extractSalary(p: AshbyPosting): string | undefined {
  const comps = p.compensation?.summaryComponents ?? [];
  for (const c of comps) {
    if (c.summary) return c.summary;
    if (c.minValue && c.maxValue) {
      const cur = c.currencyCode ?? 'USD';
      const prefix = cur === 'USD' ? '$' : `${cur} `;
      // Annualize obvious salary bands.
      const min = Math.round(c.minValue / 1000);
      const max = Math.round(c.maxValue / 1000);
      const interval = c.interval && c.interval !== 'YEARLY' ? ` ${c.interval.toLowerCase()}` : '';
      return `${prefix}${min}k–${prefix}${max}k${interval}`;
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
