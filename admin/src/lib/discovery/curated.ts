// Curated public boards. Each entry's slug has been chosen because the
// company is publicly known to host its careers page on the named ATS at
// the time of writing — not because we've live-verified each URL. If a
// slug ever drifts, the source will surface its lastError after the next
// run and Moe can disable or remove it without touching code.
//
// Every curated source ships disabled. The Discovery panel surfaces the
// list under "Curated boards"; the user opts in by toggling on. This
// avoids the worst pattern (overloading the queue on first run with
// hundreds of irrelevant company-wide listings).
//
// Companies whose ATS is unknown, behind their own bespoke flow, or
// (Workday/Ashby/SmartRecruiters) blocked by CORS are NOT seeded — manual
// paste handles those. We do not fake an active source.

export type CuratedBoardType = 'greenhouse' | 'lever';

export interface CuratedBoard {
  type: CuratedBoardType;
  /** Slug used in the public board endpoint. */
  slug: string;
  companyName: string;
  boardUrl: string;
  /** One-line note shown next to the source toggle. */
  notes?: string;
}

export const CURATED_BOARDS: CuratedBoard[] = [
  // ── Greenhouse ─────────────────────────────────────────────────────
  {
    type: 'greenhouse',
    slug: 'anthropic',
    companyName: 'Anthropic',
    boardUrl: 'https://job-boards.greenhouse.io/anthropic',
    notes: 'AI · LLM safety · product/design',
  },
  {
    type: 'greenhouse',
    slug: 'stripe',
    companyName: 'Stripe',
    boardUrl: 'https://job-boards.greenhouse.io/stripe',
    notes: 'Fintech · platform · design systems',
  },
  {
    type: 'greenhouse',
    slug: 'notion',
    companyName: 'Notion',
    boardUrl: 'https://boards.greenhouse.io/notion',
    notes: 'Productivity · product design',
  },
  {
    type: 'greenhouse',
    slug: 'vercel',
    companyName: 'Vercel',
    boardUrl: 'https://boards.greenhouse.io/vercel',
    notes: 'Frontend platform · developer tools',
  },
  {
    type: 'greenhouse',
    slug: 'linear',
    companyName: 'Linear',
    boardUrl: 'https://boards.greenhouse.io/linear',
    notes: 'Product-led SaaS · design quality',
  },
  {
    type: 'greenhouse',
    slug: 'mercury',
    companyName: 'Mercury',
    boardUrl: 'https://boards.greenhouse.io/mercury',
    notes: 'Banking · fintech · product design',
  },
  {
    type: 'greenhouse',
    slug: 'ramp',
    companyName: 'Ramp',
    boardUrl: 'https://boards.greenhouse.io/ramp',
    notes: 'Fintech · finance ops · design systems',
  },
  {
    type: 'greenhouse',
    slug: 'brex',
    companyName: 'Brex',
    boardUrl: 'https://boards.greenhouse.io/brex',
    notes: 'Fintech · spend management',
  },
  {
    type: 'greenhouse',
    slug: 'plaid',
    companyName: 'Plaid',
    boardUrl: 'https://boards.greenhouse.io/plaid',
    notes: 'Fintech · API platform · developer UX',
  },
  {
    type: 'greenhouse',
    slug: 'retool',
    companyName: 'Retool',
    boardUrl: 'https://boards.greenhouse.io/retool',
    notes: 'Internal tools · low-code · developer tools',
  },
  {
    type: 'greenhouse',
    slug: 'coinbase',
    companyName: 'Coinbase',
    boardUrl: 'https://boards.greenhouse.io/coinbase',
    notes: 'Crypto · fintech · product design',
  },
  {
    type: 'greenhouse',
    slug: 'datadog',
    companyName: 'Datadog',
    boardUrl: 'https://boards.greenhouse.io/datadog',
    notes: 'Observability · enterprise · UX',
  },
  {
    type: 'greenhouse',
    slug: 'rippling',
    companyName: 'Rippling',
    boardUrl: 'https://boards.greenhouse.io/rippling',
    notes: 'HRIS · platform UX',
  },
  {
    type: 'greenhouse',
    slug: 'lattice',
    companyName: 'Lattice',
    boardUrl: 'https://boards.greenhouse.io/lattice',
    notes: 'People management · SaaS',
  },
  {
    type: 'greenhouse',
    slug: 'figma',
    companyName: 'Figma',
    boardUrl: 'https://boards.greenhouse.io/figma',
    notes: 'Design tools · product/design (verify if Workday)',
  },

  // ── Lever ──────────────────────────────────────────────────────────
  {
    type: 'lever',
    slug: 'netflix',
    companyName: 'Netflix',
    boardUrl: 'https://jobs.lever.co/netflix',
    notes: 'Media · product design · platform UX',
  },
  {
    type: 'lever',
    slug: 'lyft',
    companyName: 'Lyft',
    boardUrl: 'https://jobs.lever.co/lyft',
    notes: 'Transportation · product design',
  },
];
