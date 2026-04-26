// Smart job intake. Takes a URL and/or pasted JD text and returns a unified
// IntakeResult with everything the new-job page needs: extracted fields,
// analyzer output, opportunity score, and a populated draft Job ready to save.

import { analyzeJD, type AnalyzerResult } from './analyzer';
import { parseJobUrl, cleanJobUrl, type UrlParseResult } from './job-url-parser';
import { scoreOpportunity, type OpportunityScore } from './scoring';
import type { Job, JobStatus } from './storage';

export interface ExtractedFields {
  title?: string;
  company?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
}

export interface IntakeResult {
  url: UrlParseResult | null;
  cleanUrl?: string;
  analyzer: AnalyzerResult | null;
  extracted: ExtractedFields;
  score: OpportunityScore | null;
  // A job draft pre-populated with everything we know. Caller can edit then save.
  draft: Partial<Job>;
  // Suggested next steps, surfaced in the UI as quick-action chips.
  nextSteps: { label: string; href: string }[];
}

// ── JD field extraction (heuristic; degrades gracefully) ──────────────

function extractTitleFromJD(jd: string): string | undefined {
  const lines = jd.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return undefined;

  // 1. Look for explicit "Title:" / "Position:" / "Job title:" patterns.
  for (const line of lines.slice(0, 20)) {
    const m = line.match(/^(?:title|position|job title|role)\s*[:\-—]\s*(.{3,80})$/i);
    if (m) return m[1].trim();
  }

  // 2. Look for "We're hiring a ..." patterns.
  for (const line of lines.slice(0, 12)) {
    const m = line.match(/(?:we(?:'| a)re hiring (?:an? )?|seeking (?:an? )?|looking for (?:an? )?|now hiring (?:an? )?)([A-Z][a-zA-Z0-9\/\- ]{4,60})/i);
    if (m) return m[1].trim();
  }

  // 3. First short, title-cased non-empty line that contains a role-like keyword.
  const roleHints = /\b(designer|engineer|developer|manager|architect|lead|director|principal|product|ux|ui)\b/i;
  for (const line of lines.slice(0, 8)) {
    if (line.length >= 6 && line.length <= 80 && roleHints.test(line) && !/[.!?]$/.test(line)) {
      return line.replace(/[*#]+\s*/g, '').trim();
    }
  }
  return undefined;
}

function extractCompanyFromJD(jd: string): string | undefined {
  const lines = jd.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. "Company:" patterns
  for (const line of lines.slice(0, 25)) {
    const m = line.match(/^company\s*[:\-—]\s*(.{2,60})$/i);
    if (m) return m[1].trim();
  }

  // 2. "About {Company}" / "{Company} is hiring"
  for (const line of lines.slice(0, 25)) {
    const a = line.match(/^about\s+([A-Z][\w&.\- ]{2,40})$/);
    if (a) return a[1].trim();
    const b = line.match(/^([A-Z][\w&.\- ]{2,40})\s+is (?:hiring|looking|seeking|building)/);
    if (b) return b[1].trim();
  }

  // 3. "At {Company}, we ..." or "Join {Company}"
  for (const line of lines.slice(0, 25)) {
    const m = line.match(/^(?:at|join)\s+([A-Z][\w&.\- ]{2,40})[,!.\s]/);
    if (m) return m[1].trim();
  }
  return undefined;
}

function extractLocationFromJD(jd: string): string | undefined {
  // "Location:" lines first
  const lineMatch = jd.match(/^[ \t]*location\s*[:\-—]\s*(.{2,60})$/im);
  if (lineMatch) return lineMatch[1].trim();

  // Common labelled patterns
  const patternMatch = jd.match(/\b(remote(?: \(US\))?|hybrid(?: in [a-z\s,]{3,30})?|in[- ]office|on[- ]site)\b/i);
  if (patternMatch) {
    const v = patternMatch[1].toLowerCase();
    if (v.startsWith('remote')) return v.includes('us') ? 'Remote (US)' : 'Remote';
    if (v.startsWith('hybrid')) return 'Hybrid';
    return 'On-site';
  }

  // City + state
  const city = jd.match(/\b([A-Z][a-zA-Z]+(?:[\s\-][A-Z][a-zA-Z]+){0,2}),\s*([A-Z]{2})\b/);
  if (city) return `${city[1]}, ${city[2]}`;

  return undefined;
}

function extractSalaryFromJD(jd: string): { min?: number; max?: number } {
  // $XXXk - $YYYk  /  $XX,XXX - $YY,YYY  /  $XXXk
  const re = /\$\s?(\d{2,3})(?:[,.](\d{3}))?\s?([kKmM])?(?:\s*[\-–to]+\s*\$?\s?(\d{2,3})(?:[,.](\d{3}))?\s?([kKmM])?)?/g;
  let best: { min?: number; max?: number } = {};
  let bestSpan = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(jd)) !== null) {
    const num = (whole?: string, frac?: string, mult?: string) => {
      if (!whole) return undefined;
      const n = Number(`${whole}${frac ?? ''}`);
      const k = mult?.toLowerCase() === 'k' ? 1000 : mult?.toLowerCase() === 'm' ? 1_000_000 : (whole.length <= 3 ? 1000 : 1);
      return n * k;
    };
    const a = num(m[1], m[2], m[3]);
    const b = num(m[4], m[5], m[6]);
    if (!a) continue;
    // Filter out obvious non-salary mentions (e.g. revenue figures > $1M aren't salaries; small $ mentions like $10 aren't).
    if (a < 30_000 || a > 1_500_000) continue;
    if (b && (b < 30_000 || b > 2_000_000)) continue;
    const span = (b ?? a) - a;
    if (b && span > bestSpan) { best = { min: a, max: b }; bestSpan = span; }
    else if (!best.min && !b) best = { min: a, max: a };
  }
  return best;
}

export function extractFieldsFromJD(jd: string): ExtractedFields {
  const trimmed = jd.trim();
  if (trimmed.length < 30) return {};
  const sal = extractSalaryFromJD(trimmed);
  return {
    title: extractTitleFromJD(trimmed),
    company: extractCompanyFromJD(trimmed),
    location: extractLocationFromJD(trimmed),
    salaryMin: sal.min,
    salaryMax: sal.max,
  };
}

// ── Optional client-side fetch ────────────────────────────────────────
// Most boards block CORS. Try anyway — if it succeeds, great. If it fails,
// the UI prompts for paste. Never hangs.

export async function tryFetchJD(url: string, timeoutMs = 4000): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { mode: 'cors', signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Pull main-area text in priority order.
    const candidates = [
      doc.querySelector('main'),
      doc.querySelector('[role="main"]'),
      doc.querySelector('article'),
      doc.body,
    ];
    for (const el of candidates) {
      const text = (el?.textContent ?? '').trim();
      if (text.length > 200) return text;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Orchestrator ──────────────────────────────────────────────────────

export interface IntakeInput {
  urlText?: string;
  jdText?: string;
}

export function runIntake({ urlText, jdText }: IntakeInput): IntakeResult {
  const url = urlText?.trim() ? parseJobUrl(urlText) : null;
  const cleanUrl = url?.isUrl ? cleanJobUrl(url.raw) : undefined;
  const jd = (jdText ?? '').trim();
  const analyzer = jd.length >= 50 ? analyzeJD(jd) : null;

  const extracted = jd ? extractFieldsFromJD(jd) : {};

  // Prefer URL-derived company over JD extraction (more reliable for greenhouse/lever paths).
  const company = url?.companyHint ?? extracted.company;

  const score = scoreOpportunity({
    analyzer,
    url,
    detectedSalaryMin: extracted.salaryMin,
    detectedSalaryMax: extracted.salaryMax,
  });

  const draft: Partial<Job> = {
    company: company || '',
    role: extracted.title || '',
    url: cleanUrl,
    source: url?.boardLabel,
    location: extracted.location,
    salaryMin: extracted.salaryMin,
    salaryMax: extracted.salaryMax,
    status: 'Saved' as JobStatus,
    resumeAngle: score?.suggestedAngleId,
    fitScore: score?.total,
    priority: score?.priority,
    jdText: jd || undefined,
    nextStep: score?.recommendedAction,
    dateFound: Date.now(),
  };

  // Quick actions surfaced after save
  const angleId = score?.suggestedAngleId ?? 'ux-engineer';
  const ec = encodeURIComponent;
  const nextSteps = [
    { label: 'Open recommended resume', href: `/resume/${angleId}` },
    { label: 'Draft cover letter', href: `/letters?angle=${angleId}&company=${ec(company || '')}&role=${ec(extracted.title || '')}&kind=cover-letter` },
    { label: 'Draft recruiter DM', href: `/letters?angle=${angleId}&company=${ec(company || '')}&role=${ec(extracted.title || '')}&kind=recruiter-dm` },
    { label: 'Open recruiter pack', href: `/recruiter/${angleId}` },
    { label: 'Add recruiter contact', href: `/recruiters` },
  ];

  return { url, cleanUrl, analyzer, extracted, score, draft, nextSteps };
}
