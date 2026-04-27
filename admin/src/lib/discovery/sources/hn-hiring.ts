// Hacker News "Who is hiring?" source.
//
// Strategy: monthly thread by user `whoishiring`. Each top-level comment is
// one job posting. Algolia (HN's official search API) is CORS-friendly and
// lets us pull the latest thread + filter comments by keyword.
//
//   1. /api/v1/search?query=Ask HN: Who is hiring?&tags=story,author_whoishiring
//      → newest "Who is hiring" story id
//   2. /api/v1/search?tags=comment,story_{id}&query={keyword}&hitsPerPage=200
//      → comments matching one of Moe's role keywords
//
// Each comment text is a fairly free-form JD. We extract the company,
// title, salary, and a URL using simple heuristics — the analyzer in the
// scoring step is what actually decides fit.

import type { SourceConfig } from '../types';
import type { RawSourceJob } from './types';

const ALGOLIA = 'https://hn.algolia.com/api/v1';

interface AlgoliaHit {
  objectID: string;
  story_id?: number;
  comment_text?: string;
  author?: string;
  created_at_i?: number;
  url?: string;
}

interface AlgoliaSearchResponse {
  hits?: AlgoliaHit[];
}

export async function fetchHNHiring(source: SourceConfig): Promise<RawSourceJob[]> {
  const keywordParam = source.params?.keywords ?? 'design,frontend,ux,product designer,design engineer,react';
  const keywords = keywordParam.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);

  // 1. Find the newest "Who is hiring?" thread.
  const storyRes = await fetch(
    `${ALGOLIA}/search?query=${encodeURIComponent('Ask HN: Who is hiring?')}&tags=story,author_whoishiring&hitsPerPage=1`,
    { headers: { Accept: 'application/json' } },
  );
  if (!storyRes.ok) throw new Error(`HN story search returned ${storyRes.status}`);
  const storyBody = (await storyRes.json()) as AlgoliaSearchResponse;
  const storyId = storyBody.hits?.[0]?.objectID;
  if (!storyId) throw new Error('No "Who is hiring?" thread found');

  // 2. Pull a generous batch of comments matching ANY of the keywords. We
  // OR-search across keywords by issuing one wide query and post-filtering
  // — Algolia's `query` is full-text, not boolean, so this is the cleanest
  // approach.
  const wideQuery = keywords.join(' ');
  const commentsRes = await fetch(
    `${ALGOLIA}/search?query=${encodeURIComponent(wideQuery)}&tags=comment,story_${storyId}&hitsPerPage=200`,
    { headers: { Accept: 'application/json' } },
  );
  if (!commentsRes.ok) throw new Error(`HN comment search returned ${commentsRes.status}`);
  const commentsBody = (await commentsRes.json()) as AlgoliaSearchResponse;
  const hits = commentsBody.hits ?? [];

  const jobs: RawSourceJob[] = [];
  for (const hit of hits) {
    const text = decodeHtml(hit.comment_text ?? '');
    if (!text) continue;
    // Filter: must contain at least one of the keywords.
    const lower = text.toLowerCase();
    if (!keywords.some(k => lower.includes(k))) continue;

    const meta = parseHNComment(text);
    if (!meta.title || !meta.company) continue;

    const url = meta.applyUrl ?? `https://news.ycombinator.com/item?id=${hit.objectID}`;
    jobs.push({
      sourceType: 'hn-hiring',
      sourceLabel: 'HN — Who is hiring',
      sourceJobId: hit.objectID,
      sourceUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      applyUrl: url,
      title: meta.title,
      company: meta.company,
      location: meta.location,
      salaryRaw: meta.salaryRaw,
      description: text,
      publishedAt: hit.created_at_i ? hit.created_at_i * 1000 : undefined,
    });
  }
  return jobs;
}

interface HNCommentMeta {
  company?: string;
  title?: string;
  location?: string;
  salaryRaw?: string;
  applyUrl?: string;
}

/**
 * "Who is hiring" posts loosely follow:
 *   {Company} | {Title} | {Location} | {Tags} | apply: ...
 * but every poster does it differently. We parse the first line for company
 * and pipe-separated metadata, then look for typical patterns elsewhere.
 */
function parseHNComment(text: string): HNCommentMeta {
  const meta: HNCommentMeta = {};
  const firstLine = text.split('\n').find(l => l.trim().length > 0)?.trim() ?? '';

  // Pipe-delimited header is the most common shape.
  if (firstLine.includes('|')) {
    const parts = firstLine.split('|').map(p => p.trim()).filter(Boolean);
    meta.company = parts[0];
    // Find the first part that looks like a job title.
    const titleHints = /designer|engineer|developer|architect|lead|director|manager|principal|product|ux|ui|design/i;
    const titlePart = parts.slice(1).find(p => titleHints.test(p));
    if (titlePart) meta.title = titlePart;
    const locHints = /remote|on[- ]site|hybrid|usa?|us\b|europe|emea|sf|nyc|san francisco|new york|onsite/i;
    const locPart = parts.find(p => locHints.test(p) && p !== titlePart);
    if (locPart) meta.location = locPart;
  } else {
    // No pipes — try "Company is hiring a Title" / "Company — Title".
    const dash = firstLine.match(/^([A-Z][\w&.\- ]{2,40})\s*[—–-]\s*(.{4,80})/);
    if (dash) {
      meta.company = dash[1].trim();
      meta.title = dash[2].trim();
    } else {
      const hiring = firstLine.match(/^([A-Z][\w&.\- ]{2,40})\s+is hiring (?:an?\s+)?(.{4,80})/i);
      if (hiring) {
        meta.company = hiring[1].trim();
        meta.title = hiring[2].trim();
      }
    }
  }

  // Salary clue anywhere in the text — first one wins.
  const sal = text.match(/\$\s?\d{2,3}[,.]?\d{0,3}\s?[kKMm]?\s*[\-–to]+\s*\$?\s?\d{2,3}[,.]?\d{0,3}\s?[kKMm]?/);
  if (sal) meta.salaryRaw = sal[0].trim();

  // First http(s) URL → apply link.
  const url = text.match(/https?:\/\/[^\s<>"]+/);
  if (url) meta.applyUrl = url[0];

  return meta;
}

function decodeHtml(html: string): string {
  return html
    .replace(/<a\s+href="([^"]+)"[^>]*>[^<]*<\/a>/gi, ' $1 ')
    .replace(/<\/?p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
