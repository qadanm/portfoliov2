// Detects what we can from a job URL alone.
// Most ATS pages BLOCK browser-side fetching (CORS), so this file does not
// pretend to scrape — it inspects the URL string and tells the caller what's
// likely extractable from it.

export type JobBoard =
  | 'linkedin' | 'greenhouse' | 'lever' | 'workday' | 'ashby'
  | 'smartrecruiters' | 'workable' | 'indeed' | 'builtin' | 'wellfound'
  | 'company-site' | 'unknown';

export interface UrlParseResult {
  raw: string;            // original URL string
  isUrl: boolean;
  board: JobBoard;
  boardLabel: string;     // pretty label
  companyHint?: string;   // best guess from URL path/subdomain
  jobIdHint?: string;     // ATS-internal id if present
  fetchLikelyToWork: boolean; // true if a CORS-friendly board (rare)
  notes: string[];        // human-readable explanations of what we found
}

const BOARD_LABELS: Record<JobBoard, string> = {
  linkedin: 'LinkedIn',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  workday: 'Workday',
  ashby: 'Ashby',
  smartrecruiters: 'SmartRecruiters',
  workable: 'Workable',
  indeed: 'Indeed',
  builtin: 'Built In',
  wellfound: 'Wellfound',
  'company-site': 'Company site',
  unknown: 'Unknown',
};

function titleize(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export function parseJobUrl(input: string): UrlParseResult {
  const raw = (input ?? '').trim();
  let url: URL;
  try { url = new URL(raw); }
  catch {
    return {
      raw, isUrl: false, board: 'unknown', boardLabel: 'Unknown',
      fetchLikelyToWork: false, notes: ['Not a valid URL.'],
    };
  }

  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  const notes: string[] = [];
  let board: JobBoard = 'unknown';
  let companyHint: string | undefined;
  let jobIdHint: string | undefined;
  let fetchLikelyToWork = false;

  // ── LinkedIn ────────────────────────────────────────────────────────
  if (host.endsWith('linkedin.com')) {
    board = 'linkedin';
    notes.push('LinkedIn requires authentication and blocks browser fetching. Paste the job description below.');
    const m = path.match(/\/jobs\/view\/(\d+)/);
    if (m) jobIdHint = m[1];
  }

  // ── Greenhouse ──────────────────────────────────────────────────────
  else if (host === 'boards.greenhouse.io' || host.endsWith('.greenhouse.io')) {
    board = 'greenhouse';
    // boards.greenhouse.io/{company}/jobs/{id}
    const m = path.match(/^\/(?:embed\/)?([^\/]+)(?:\/jobs\/(\d+))?/);
    if (m) {
      companyHint = titleize(m[1]);
      jobIdHint = m[2];
    }
    fetchLikelyToWork = true;
    notes.push('Greenhouse boards are sometimes browser-fetchable. Will try, but paste the JD if it fails.');
  }

  // ── Lever ───────────────────────────────────────────────────────────
  else if (host === 'jobs.lever.co' || host.endsWith('.lever.co')) {
    board = 'lever';
    const m = path.match(/^\/([^\/]+)(?:\/([^\/]+))?/);
    if (m) {
      companyHint = titleize(m[1]);
      jobIdHint = m[2];
    }
    fetchLikelyToWork = true;
    notes.push('Lever public pages are sometimes browser-fetchable.');
  }

  // ── Ashby ───────────────────────────────────────────────────────────
  else if (host === 'jobs.ashbyhq.com' || host.endsWith('.ashbyhq.com')) {
    board = 'ashby';
    const m = path.match(/^\/([^\/]+)(?:\/([^\/]+))?/);
    if (m) {
      companyHint = titleize(m[1]);
      jobIdHint = m[2];
    }
    notes.push('Ashby blocks browser fetches. Paste the job description.');
  }

  // ── Workday (myworkdayjobs.com) ────────────────────────────────────
  else if (host.endsWith('myworkdayjobs.com') || host.endsWith('workdayjobs.com')) {
    board = 'workday';
    // {tenant}.wdN.myworkdayjobs.com/{site}/job/{location}/{title}_{id}
    const sub = host.split('.')[0];
    if (sub && sub !== 'wd1' && sub !== 'wd5' && !/^wd\d+$/.test(sub)) {
      companyHint = titleize(sub);
    }
    notes.push('Workday URLs are auth-gated and block browser fetching. Paste the job description.');
  }

  // ── SmartRecruiters ─────────────────────────────────────────────────
  else if (host === 'jobs.smartrecruiters.com' || host.endsWith('smartrecruiters.com')) {
    board = 'smartrecruiters';
    const m = path.match(/^\/([^\/]+)(?:\/([^\/]+))?/);
    if (m) companyHint = titleize(m[1]);
    notes.push('SmartRecruiters blocks browser fetching in most cases.');
  }

  // ── Workable ────────────────────────────────────────────────────────
  else if (host.endsWith('workable.com')) {
    board = 'workable';
    const m = path.match(/^\/([^\/]+)/);
    if (m) companyHint = titleize(m[1]);
    notes.push('Workable blocks browser fetching for most boards.');
  }

  // ── Indeed ──────────────────────────────────────────────────────────
  else if (host.endsWith('indeed.com')) {
    board = 'indeed';
    notes.push('Indeed blocks browser fetching. Paste the job description.');
  }

  // ── Built In ────────────────────────────────────────────────────────
  else if (host.endsWith('builtin.com')) {
    board = 'builtin';
    notes.push('Built In may allow fetching but content is often dynamic. Paste the JD if needed.');
  }

  // ── Wellfound (formerly AngelList) ─────────────────────────────────
  else if (host === 'wellfound.com' || host === 'angel.co') {
    board = 'wellfound';
    notes.push('Wellfound blocks browser fetching. Paste the job description.');
  }

  // ── Company career site (heuristic) ────────────────────────────────
  else if (
    host.startsWith('careers.') ||
    host.startsWith('jobs.') ||
    /\/careers?\b/.test(path) ||
    /\/jobs?\b/.test(path)
  ) {
    board = 'company-site';
    // Try to derive company from registrable domain (last two parts).
    const parts = host.split('.');
    const company = parts.length >= 2 ? parts[parts.length - 2] : host;
    companyHint = titleize(company);
    notes.push('Direct company career site. Browser fetch sometimes works; otherwise paste the JD.');
  }

  return {
    raw,
    isUrl: true,
    board,
    boardLabel: BOARD_LABELS[board],
    companyHint,
    jobIdHint,
    fetchLikelyToWork,
    notes,
  };
}

// Strip the URL of tracking params for cleaner storage.
export function cleanJobUrl(input: string): string {
  try {
    const url = new URL(input);
    const drop = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gh_jid','trk','trackingId','refId','recommendedFlavor','currentJobId','position','pipeline'];
    for (const p of drop) url.searchParams.delete(p);
    // Workday LinkedIn-fed redirects sometimes have giant param chains; if path
    // is short and params are huge, prefer the bare path.
    return url.toString();
  } catch { return input; }
}
