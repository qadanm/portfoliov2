// Remotive source adapter. Public CORS-friendly JSON API.
// API docs: https://remotive.com/api/remote-jobs
// Categories used: 'design' (covers Product/UX) and 'software-dev'
// (catches Frontend/UX-Engineer/Design-Engineer roles).
//
// Response shape (trimmed to fields we use):
//   {
//     "jobs": [
//       {
//         "id": 1234,
//         "url": "https://remotive.com/remote-jobs/...",
//         "title": "Senior Product Designer",
//         "company_name": "Acme",
//         "category": "Design",
//         "candidate_required_location": "Worldwide",
//         "salary": "$120,000 - $160,000",
//         "publication_date": "2025-04-01T...",
//         "description": "<p>HTML description</p>"
//       }
//     ]
//   }

import type { SourceConfig } from '../types';
import type { RawSourceJob } from './types';

const ENDPOINT = 'https://remotive.com/api/remote-jobs';

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  candidate_required_location?: string;
  salary?: string;
  publication_date?: string;
  description?: string;
}

interface RemotiveResponse {
  jobs?: RemotiveJob[];
}

export async function fetchRemotive(source: SourceConfig): Promise<RawSourceJob[]> {
  const category = source.params?.category ?? 'design';
  const url = `${ENDPOINT}?category=${encodeURIComponent(category)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Remotive ${category} returned ${res.status}`);

  const body = (await res.json()) as RemotiveResponse;
  const jobs = body.jobs ?? [];

  return jobs.map(j => ({
    sourceType: 'remotive' as const,
    sourceLabel: `Remotive · ${j.category}`,
    sourceJobId: String(j.id),
    sourceUrl: j.url,
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location,
    salaryRaw: j.salary || undefined,
    description: stripHtml(j.description ?? ''),
    publishedAt: parseDate(j.publication_date),
  }));
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

function parseDate(d?: string): number | undefined {
  if (!d) return undefined;
  const t = Date.parse(d);
  return Number.isNaN(t) ? undefined : t;
}
