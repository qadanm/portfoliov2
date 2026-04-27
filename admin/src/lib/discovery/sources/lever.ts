// Lever public postings adapter.
//
// API: https://api.lever.co/v0/postings/{slug}?mode=json
// CORS-friendly. Like Greenhouse, requires a per-company slug — there is
// no global feed.

import type { SourceConfig } from '../types';
import type { RawSourceJob } from './types';

const ENDPOINT = 'https://api.lever.co/v0/postings';

interface LeverPosting {
  id: string;
  text: string;                // job title
  hostedUrl: string;
  applyUrl?: string;
  categories?: {
    location?: string;
    commitment?: string;
    team?: string;
  };
  description?: string;
  descriptionPlain?: string;
  createdAt?: number;
  salaryDescription?: string;
  additional?: string;
  additionalPlain?: string;
}

export async function fetchLever(source: SourceConfig): Promise<RawSourceJob[]> {
  const slug = source.params?.slug;
  if (!slug) throw new Error('Lever source missing required `params.slug`');

  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(slug)}?mode=json`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Lever ${slug} returned ${res.status}`);

  const postings = (await res.json()) as LeverPosting[];
  const company = slug
    .split(/[-_]+/)
    .map(w => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');

  return postings.map(p => {
    const desc = [p.descriptionPlain, p.additionalPlain].filter(Boolean).join('\n\n');
    return {
      sourceType: 'lever' as const,
      sourceLabel: `Lever · ${company}`,
      sourceJobId: p.id,
      sourceUrl: p.hostedUrl,
      applyUrl: p.applyUrl,
      title: p.text,
      company,
      location: p.categories?.location,
      salaryRaw: p.salaryDescription,
      description: desc || undefined,
      publishedAt: p.createdAt,
    };
  });
}
