// Normalize a RawSourceJob into a fully-scored DiscoveredJob. Runs the
// existing JD analyzer + scoreOpportunity from the analyzer/scoring
// modules so the discovery scoring is identical to the manual-intake
// scoring — one decision model, two entry points.

import type { DiscoveredJob, RemoteStatus } from './types';
import type { RawSourceJob } from './sources/types';
import { analyzeJD } from '../analyzer';
import { scoreOpportunity } from '../scoring';
import { parseJobUrl } from '../job-url-parser';

/** Stable id derived from the source. Survives re-runs so dedupe works. */
export function discoveryId(raw: RawSourceJob): string {
  if (raw.sourceJobId) return `${raw.sourceType}:${raw.sourceJobId}`;
  return `${raw.sourceType}:${normalizeKey(raw.company + '|' + raw.title + '|' + raw.sourceUrl)}`;
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .trim()
    .slice(0, 80);
}

function detectRemoteStatus(raw: RawSourceJob): RemoteStatus {
  const haystack = `${raw.location ?? ''} ${raw.description ?? ''} ${raw.title ?? ''}`.toLowerCase();
  if (/(fully remote|100% remote|remote-first|remote only|worldwide|anywhere|global)/.test(haystack)) return 'remote';
  if (/hybrid/.test(haystack)) return 'hybrid';
  if (/(on[- ]site|in[- ]office|in-?person|onsite)/.test(haystack)) return 'onsite';
  if (/remote/.test(haystack)) return 'remote';
  return 'unclear';
}

function parseSalary(raw: string | undefined): { min?: number; max?: number } {
  if (!raw) return {};
  const re = /\$?\s?(\d{2,3})(?:[,.](\d{3}))?\s?([kKmM])?(?:\s*[\-–to]+\s*\$?\s?(\d{2,3})(?:[,.](\d{3}))?\s?([kKmM])?)?/g;
  let best: { min?: number; max?: number } = {};
  let span = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const num = (whole?: string, frac?: string, mult?: string) => {
      if (!whole) return undefined;
      const n = Number(`${whole}${frac ?? ''}`);
      const k = mult?.toLowerCase() === 'k' ? 1000 : mult?.toLowerCase() === 'm' ? 1_000_000 : (whole.length <= 3 ? 1000 : 1);
      return n * k;
    };
    const a = num(m[1], m[2], m[3]);
    const b = num(m[4], m[5], m[6]);
    if (!a) continue;
    if (a < 30_000 || a > 1_500_000) continue;
    if (b && (b < 30_000 || b > 2_000_000)) continue;
    const s = (b ?? a) - a;
    if (b && s > span) { best = { min: a, max: b }; span = s; }
    else if (!best.min && !b) best = { min: a, max: a };
  }
  return best;
}

function buildExcerpt(description: string | undefined): string | undefined {
  if (!description) return undefined;
  const cleaned = description.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 200) return cleaned;
  // Cut at a word boundary near 200 chars.
  const cut = cleaned.slice(0, 200).replace(/\s\S*$/, '');
  return cut + '…';
}

function detectSeniority(title: string, description: string | undefined): DiscoveredJob['seniority'] {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  if (/principal|staff/.test(text)) return 'principal';
  if (/\blead\b|head of|director/.test(text)) return 'lead';
  if (/\bsenior|sr\.?\b/.test(text)) return 'senior';
  if (/junior|jr\.?|entry|associate|intern/.test(text)) return 'ic';
  return 'unclear';
}

/**
 * Build a synthetic JD blob from the raw fields so the analyzer has
 * something to chew on even when description is empty (HN comments, manual
 * pastes). Without this fallback, score would be useless on light sources.
 */
function synthesizeJD(raw: RawSourceJob): string {
  const parts: string[] = [];
  parts.push(`Title: ${raw.title}`);
  parts.push(`Company: ${raw.company}`);
  if (raw.location) parts.push(`Location: ${raw.location}`);
  if (raw.salaryRaw) parts.push(`Salary: ${raw.salaryRaw}`);
  if (raw.description) parts.push('', raw.description);
  return parts.join('\n');
}

export function normalize(raw: RawSourceJob): DiscoveredJob {
  const synthesized = synthesizeJD(raw);
  const analyzer = analyzeJD(synthesized);
  const url = parseJobUrl(raw.sourceUrl);
  const sal = parseSalary(raw.salaryRaw);

  const score = scoreOpportunity({
    analyzer,
    url,
    detectedSalaryMin: sal.min,
    detectedSalaryMax: sal.max,
  });

  const remoteStatus = detectRemoteStatus(raw);
  const seniority = detectSeniority(raw.title, raw.description);

  return {
    id: discoveryId(raw),
    source: raw.sourceType,
    sourceLabel: raw.sourceLabel,
    sourceJobId: raw.sourceJobId,
    sourceUrl: raw.sourceUrl,
    applyUrl: raw.applyUrl ?? raw.sourceUrl,
    company: raw.company.trim(),
    title: raw.title.trim(),
    location: raw.location,
    remoteStatus,
    salaryMin: sal.min,
    salaryMax: sal.max,
    salaryRaw: raw.salaryRaw,
    description: raw.description,
    excerpt: buildExcerpt(raw.description),
    roleFamily: score.suggestedAngleLabel,
    seniority,
    fitScore: score.total,
    priorityScore: score.priority,
    confidence: score.confidence,
    recommendedAngle: score.suggestedAngleId,
    recommendedAngleLabel: score.suggestedAngleLabel,
    matchedStrengths: score.topStrengths,
    missingSignals: score.gaps,
    redFlags: analyzer?.riskFlags ?? [],
    discoveredAt: raw.publishedAt ?? Date.now(),
    status: 'new',
  };
}
