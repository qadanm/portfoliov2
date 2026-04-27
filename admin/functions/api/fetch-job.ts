// Cloudflare Pages Function — server-side proxy for job-page fetches.
//
// Auth-walled boards (LinkedIn, Indeed, Workday, Ashby, …) block browser
// fetches via CORS and require a real client. This function runs at the edge,
// fetches the public guest endpoint or the page itself, extracts JSON-LD
// JobPosting / open-graph / common-pattern fields, and returns structured
// JSON the client can drop straight into its intake pipeline.
//
// Access auth still gates this function: it is reachable only behind the
// same Cloudflare Access policy as the rest of /admin.

// Minimal local type for Pages Functions so this file type-checks without
// pulling in @cloudflare/workers-types. Cloudflare's runtime injects the
// real signature; we only need the shape of `request`.
type PagesFunction = (ctx: { request: Request }) => Response | Promise<Response>;

interface FetchJobInput {
  url?: string;
}

export interface FetchedJob {
  ok: true;
  source: string;       // pretty board name
  url: string;          // the URL we resolved to
  title?: string;
  company?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  description?: string; // plain-text JD (cleaned)
  via: 'json-ld' | 'og' | 'pattern' | 'guest-api';
}

export interface FetchedJobError {
  ok: false;
  error: string;        // short error code
  message: string;      // human-readable
  hint?: string;        // suggested next step
  statusCode?: number;  // upstream status if applicable
}

type Result = FetchedJob | FetchedJobError;

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024; // 4 MB upper bound
const FETCH_TIMEOUT_MS = 9_000;

const UA =
  'Mozilla/5.0 (compatible; QadanAdminBot/1.0; +https://admin.qadan.co)';

// ── Entry ────────────────────────────────────────────────────────────────

export const onRequestPost: PagesFunction = async (ctx) => {
  let body: FetchJobInput = {};
  try {
    body = (await ctx.request.json()) as FetchJobInput;
  } catch {
    return json({ ok: false, error: 'bad-body', message: 'Body must be JSON.' }, 400);
  }

  const raw = (body.url ?? '').trim();
  if (!raw) {
    return json({ ok: false, error: 'no-url', message: 'Pass { url } in the body.' }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return json({ ok: false, error: 'bad-url', message: 'Not a valid URL.' }, 400);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return json({ ok: false, error: 'bad-protocol', message: 'Only http/https URLs are allowed.' }, 400);
  }

  const result = await fetchJob(parsed);
  const status = result.ok ? 200 : (result.statusCode && result.statusCode >= 400 && result.statusCode < 600 ? result.statusCode : 502);
  return json(result, status);
};

// ── Router by board ──────────────────────────────────────────────────────

async function fetchJob(url: URL): Promise<Result> {
  const host = url.hostname.toLowerCase();

  if (host.endsWith('linkedin.com')) {
    return fetchLinkedIn(url);
  }

  // Generic path for boards that *might* respond to a polite server fetch.
  // Greenhouse, Lever, Workable, Built In, company sites usually do.
  // Workday/Ashby/Indeed/Wellfound usually return shells; we still try and
  // report what we can.
  return fetchGeneric(url);
}

// ── LinkedIn (uses the public guest job-posting endpoint) ────────────────

async function fetchLinkedIn(url: URL): Promise<Result> {
  // Pull the numeric job id from any LinkedIn URL form we know about.
  const id = extractLinkedInJobId(url);
  if (!id) {
    return {
      ok: false,
      error: 'linkedin-no-id',
      message: 'Could not find a numeric job id in the LinkedIn URL.',
      hint: 'Open the job, copy the URL from the address bar, and paste it again.',
    };
  }

  // The /jobs-guest/ endpoint returns a public HTML fragment that does not
  // require authentication and embeds JSON-LD JobPosting markup.
  const guest = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`;

  const res = await safeFetch(guest, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) {
    return {
      ok: false,
      error: 'linkedin-upstream',
      message: `LinkedIn returned ${res.status}.`,
      hint: res.status === 404
        ? 'The posting may have been removed or expired.'
        : 'LinkedIn may be rate-limiting. Try again, or paste the JD manually.',
      statusCode: res.status,
    };
  }

  const html = res.text;
  const extracted = extractFromHtml(html);

  // The guest endpoint reliably has a title and company; if we got nothing
  // we likely hit a blocked / empty response.
  if (!extracted.title && !extracted.company) {
    return {
      ok: false,
      error: 'linkedin-empty',
      message: 'LinkedIn returned a page with no recognizable job fields.',
      hint: 'Open the URL in a browser and paste the JD manually.',
    };
  }

  return {
    ok: true,
    source: 'LinkedIn',
    url: `https://www.linkedin.com/jobs/view/${id}/`,
    title: extracted.title,
    company: extracted.company,
    location: extracted.location,
    salaryMin: extracted.salaryMin,
    salaryMax: extracted.salaryMax,
    description: extracted.description,
    via: extracted.via,
  };
}

function extractLinkedInJobId(url: URL): string | undefined {
  // /jobs/view/{id}/...
  let m = url.pathname.match(/\/jobs\/view\/(\d+)/);
  if (m) return m[1];
  // /jobs/collections/?currentJobId={id}
  const cj = url.searchParams.get('currentJobId');
  if (cj && /^\d+$/.test(cj)) return cj;
  // /jobs-guest/jobs/api/jobPosting/{id}
  m = url.pathname.match(/\/jobPosting\/(\d+)/);
  if (m) return m[1];
  return undefined;
}

// ── Generic boards (Greenhouse, Lever, Workable, careers sites) ──────────

async function fetchGeneric(url: URL): Promise<Result> {
  const res = await safeFetch(url.toString(), {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    return {
      ok: false,
      error: 'upstream-status',
      message: `Upstream returned ${res.status}.`,
      hint: 'Open the URL manually and paste the JD into the box.',
      statusCode: res.status,
    };
  }

  const extracted = extractFromHtml(res.text);
  const board = inferBoardLabel(url.hostname);

  if (!extracted.title && !extracted.company && !extracted.description) {
    return {
      ok: false,
      error: 'no-fields',
      message: `${board} returned a page we couldn’t parse.`,
      hint: 'The site likely renders client-side. Open the URL and paste the JD.',
    };
  }

  return {
    ok: true,
    source: board,
    url: url.toString(),
    title: extracted.title,
    company: extracted.company,
    location: extracted.location,
    salaryMin: extracted.salaryMin,
    salaryMax: extracted.salaryMax,
    description: extracted.description,
    via: extracted.via,
  };
}

function inferBoardLabel(host: string): string {
  if (host.endsWith('greenhouse.io')) return 'Greenhouse';
  if (host.endsWith('lever.co')) return 'Lever';
  if (host.endsWith('ashbyhq.com')) return 'Ashby';
  if (host.endsWith('myworkdayjobs.com') || host.endsWith('workdayjobs.com')) return 'Workday';
  if (host.endsWith('smartrecruiters.com')) return 'SmartRecruiters';
  if (host.endsWith('workable.com')) return 'Workable';
  if (host.endsWith('indeed.com')) return 'Indeed';
  if (host.endsWith('builtin.com')) return 'Built In';
  if (host === 'wellfound.com' || host === 'angel.co') return 'Wellfound';
  return 'Company site';
}

// ── HTML → fields ────────────────────────────────────────────────────────

interface Extracted {
  title?: string;
  company?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  description?: string;
  via: 'json-ld' | 'og' | 'pattern' | 'guest-api';
}

function extractFromHtml(html: string): Extracted {
  // 1. JSON-LD JobPosting is the most reliable signal — every major board emits it.
  const ld = extractJsonLdJobPosting(html);
  if (ld) return { ...ld, via: 'json-ld' };

  // 2. Open Graph + meta tags + first <h1>.
  const og = extractOpenGraph(html);
  if (og.title || og.description) return { ...og, via: 'og' };

  // 3. Pattern-based scraping for known LinkedIn / Lever class names.
  const pat = extractLinkedInPatterns(html);
  if (pat.title || pat.company) return { ...pat, via: 'pattern' };

  return { via: 'pattern' };
}

function extractJsonLdJobPosting(html: string): Omit<Extracted, 'via'> | null {
  // Find every <script type="application/ld+json">…</script> block.
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    // The script block may be a single object, an array, or an @graph wrapper.
    const candidates = collectGraphNodes(parsed);
    for (const node of candidates) {
      const t = node?.['@type'];
      const isJobPosting =
        (typeof t === 'string' && t === 'JobPosting') ||
        (Array.isArray(t) && t.includes('JobPosting'));
      if (!isJobPosting) continue;

      const sal = readSalary(node);
      return {
        title: cleanString(node.title),
        company: cleanString(node?.hiringOrganization?.name),
        location: readLocation(node),
        salaryMin: sal.min,
        salaryMax: sal.max,
        description: htmlToText(node.description),
      };
    }
  }
  return null;
}

function collectGraphNodes(input: any): any[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.flatMap(collectGraphNodes);
  if (input['@graph'] && Array.isArray(input['@graph'])) {
    return [input, ...input['@graph']];
  }
  return [input];
}

function readLocation(node: any): string | undefined {
  const j = node?.jobLocation;
  if (!j) return readApplicantLocation(node);
  const arr = Array.isArray(j) ? j : [j];
  for (const loc of arr) {
    const a = loc?.address;
    if (!a) continue;
    const city = sanitizePlaceholder(a.addressLocality);
    const region = sanitizePlaceholder(a.addressRegion);
    const country = sanitizePlaceholder(a.addressCountry);
    const parts = [city, region, country].filter(Boolean);
    if (parts.length) return parts.join(', ');
  }
  return readApplicantLocation(node);
}

// Many ATSes emit literal "UNAVAILABLE" / "N/A" / "TBD" placeholders in their
// address fields when the field is unset. Treat those as missing.
function sanitizePlaceholder(s: any): string | undefined {
  const v = cleanString(s);
  if (!v) return undefined;
  if (/^(unavailable|n\/?a|tbd|not specified|none)$/i.test(v)) return undefined;
  return v;
}

function readApplicantLocation(node: any): string | undefined {
  if (node?.jobLocationType === 'TELECOMMUTE') return 'Remote';
  const j = node?.applicantLocationRequirements;
  if (!j) return undefined;
  const arr = Array.isArray(j) ? j : [j];
  const names = arr.map((x: any) => cleanString(x?.name)).filter(Boolean);
  if (names.length) return `Remote (${names.join(', ')})`;
  return undefined;
}

function readSalary(node: any): { min?: number; max?: number } {
  const bs = node?.baseSalary;
  if (!bs) return {};
  const arr = Array.isArray(bs) ? bs : [bs];
  for (const entry of arr) {
    const v = entry?.value ?? entry;
    const min = readMoney(v?.minValue ?? v?.value);
    const max = readMoney(v?.maxValue ?? v?.value);
    if (min || max) {
      const unit = (v?.unitText ?? entry?.unitText ?? '').toString().toUpperCase();
      // Normalize annual figure: HOUR/DAY/WEEK/MONTH → year, conservative multipliers.
      const mul =
        unit === 'HOUR' ? 2080 :
        unit === 'DAY' ? 250 :
        unit === 'WEEK' ? 52 :
        unit === 'MONTH' ? 12 :
        1;
      return {
        min: min ? Math.round(min * mul) : undefined,
        max: max ? Math.round(max * mul) : undefined,
      };
    }
  }
  return {};
}

function readMoney(x: any): number | undefined {
  if (x == null) return undefined;
  const n = typeof x === 'number' ? x : Number(String(x).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function extractOpenGraph(html: string): Omit<Extracted, 'via'> {
  const get = (prop: string) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i'
    );
    const m = html.match(re);
    if (!m) return undefined;
    return decodeHtmlEntities(m[1]);
  };
  const title = get('og:title') ?? get('twitter:title');
  const description = get('og:description') ?? get('description');
  return {
    title: title ? cleanString(title) : undefined,
    description: description ? cleanString(description) : undefined,
  };
}

function extractLinkedInPatterns(html: string): Omit<Extracted, 'via'> {
  const out: Omit<Extracted, 'via'> = {};

  // <h2 class="top-card-layout__title">Title</h2>
  let m = html.match(/<h[12][^>]*top-card-layout__title[^>]*>([\s\S]*?)<\/h[12]>/i);
  if (m) out.title = cleanString(stripTags(m[1]));

  // Topcard org name link
  m = html.match(/<a[^>]*topcard__org-name-link[^>]*>([\s\S]*?)<\/a>/i);
  if (m) out.company = cleanString(stripTags(m[1]));
  else {
    m = html.match(/<span[^>]*topcard__flavor[^>]*>([\s\S]*?)<\/span>/i);
    if (m) out.company = cleanString(stripTags(m[1]));
  }

  // Bullet flavor (location lives in a sibling)
  m = html.match(/<span[^>]*topcard__flavor topcard__flavor--bullet[^>]*>([\s\S]*?)<\/span>/i);
  if (m) out.location = cleanString(stripTags(m[1]));

  // Description block (LinkedIn uses .show-more-less-html__markup)
  m = html.match(/<div[^>]*show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/i);
  if (m) out.description = htmlToText(m[1]);

  return out;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ');
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function cleanString(s: any): string | undefined {
  if (typeof s !== 'string') return undefined;
  const t = decodeHtmlEntities(s).replace(/\s+/g, ' ').trim();
  return t || undefined;
}

function htmlToText(s: any): string | undefined {
  if (typeof s !== 'string') return undefined;
  return decodeHtmlEntities(stripTags(s).replace(/\s+/g, ' ')).trim() || undefined;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

interface SafeFetchResult {
  ok: boolean;
  status: number;
  text: string;
}

async function safeFetch(url: string, init: RequestInit): Promise<SafeFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      return { ok: false, status: res.status, text: '' };
    }
    // Stream-bound the body so a runaway page can't OOM the worker.
    const reader = res.body?.getReader();
    if (!reader) {
      const t = await res.text();
      return { ok: true, status: res.status, text: t.slice(0, MAX_RESPONSE_BYTES) };
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) break;
      chunks.push(value);
    }
    const all = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      all.set(c, off);
      off += c.byteLength;
    }
    const text = new TextDecoder('utf-8', { fatal: false }).decode(all);
    return { ok: true, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: '' };
  } finally {
    clearTimeout(timer);
  }
}
