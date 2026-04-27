// Manual paste source. Handles email-alert dumps from job boards
// (LinkedIn alerts, Built In digests, etc.) by extracting URL + title +
// company patterns from free-form text.
//
// This is the universal fallback for sources that block CORS or aren't
// worth a dedicated adapter. The user pastes once; the parser does best-
// effort field extraction; the scoring pipeline takes it from there.

import type { RawSourceJob } from './types';
import { parseJobUrl, cleanJobUrl } from '../../job-url-parser';

/**
 * Pull every URL out of pasted text, then walk a small window before each
 * URL to harvest the most likely role title (preceding non-empty line) and
 * company (line before that, or extracted from the URL host).
 *
 * Tolerates LinkedIn-style "{Title}\n{Company}\n{Location}\n{URL}" blocks
 * as well as Built-In-style "{Title} at {Company}" headers.
 */
export function parsePastedAlerts(text: string): RawSourceJob[] {
  const out: RawSourceJob[] = [];
  const seen = new Set<string>();

  // Collect URLs with their position in the text so we can walk backwards.
  const urlRe = /https?:\/\/[^\s<>")\]]+/g;
  const matches: Array<{ url: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(text)) !== null) {
    matches.push({ url: m[0], index: m.index });
  }

  for (const { url, index } of matches) {
    const cleaned = cleanJobUrl(url);
    if (seen.has(cleaned)) continue;

    const parsed = parseJobUrl(cleaned);
    // Skip if it's clearly not a job URL (no recognizable board AND no
    // career/jobs path).
    if (parsed.board === 'unknown' && !/\/(jobs?|careers?|positions?|hiring)\b/i.test(cleaned)) {
      continue;
    }
    seen.add(cleaned);

    // Walk backwards through the text to find the closest non-empty lines.
    const before = text.slice(Math.max(0, index - 400), index);
    const lines = before.split('\n').map(l => l.trim()).filter(Boolean);

    // Title is typically the line right before the URL (or the line
    // containing the URL if it's inline).
    let title = lines[lines.length - 1] || '';
    let company = '';
    let location = '';

    // Strip URL fragments out of the title if any leaked in.
    title = title.replace(/https?:\/\/\S+/g, '').trim();

    // Common pattern: "{Title} at {Company}" → split.
    const atSplit = title.match(/^(.{4,80}?)\s+at\s+([A-Z][\w&.\- ]{2,40})\s*$/i);
    if (atSplit) {
      title = atSplit[1].trim();
      company = atSplit[2].trim();
    }

    // If we still need company: previous non-empty line, or URL hint.
    if (!company) {
      const prev = lines[lines.length - 2] ?? '';
      const prevClean = prev.replace(/https?:\/\/\S+/g, '').trim();
      if (prevClean && /^[A-Z]/.test(prevClean) && prevClean.length <= 60) {
        company = prevClean;
      } else if (parsed.companyHint) {
        company = parsed.companyHint;
      }
    }

    // Location heuristic: line that looks like "Remote", "Hybrid", a city, etc.
    const locHints = /^(remote|hybrid|on[- ]?site|usa?|united states|new york|san francisco|los angeles|sf|nyc|la)\b/i;
    const locLine = lines.slice(-4).find(l => locHints.test(l));
    if (locLine) location = locLine;

    // Skip noisy candidates that yield no usable identity.
    if (!title || title.length < 4 || !company) continue;
    // Drop obvious non-titles.
    if (/^(view|apply|see|learn|read|click)\b/i.test(title)) continue;

    out.push({
      sourceType: 'manual-paste',
      sourceLabel: `Manual paste · ${parsed.boardLabel}`,
      sourceJobId: undefined,
      sourceUrl: cleaned,
      applyUrl: cleaned,
      title,
      company,
      location: location || undefined,
      description: undefined,
      publishedAt: Date.now(),
    });
  }

  return out;
}
