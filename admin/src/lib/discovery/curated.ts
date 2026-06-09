// Curated public boards. Every entry below was live-verified against the
// public ATS API on 2026-06-09 (greenhouse: boards-api.greenhouse.io,
// lever: api.lever.co, ashby: api.ashbyhq.com) and returned >0 postings.
// Boards that 404'd or returned empty were removed; companies that moved
// ATS (Notion/Linear/Ramp/Plaid/Cursor → Ashby, Mistral → Lever,
// Lyft/Inflection → Greenhouse) were migrated to their live host. If a
// slug ever drifts again, the source will surface its lastError after the
// next run and Moe can disable or remove it without touching code.
//
// Every curated source ships disabled. The Discovery panel surfaces the
// list under "Curated boards"; the user opts in by toggling on. This
// avoids the worst pattern (overloading the queue on first run with
// hundreds of irrelevant company-wide listings).
//
// Companies whose ATS is unknown, behind their own bespoke flow, or
// (Workday/SmartRecruiters) blocked by CORS are NOT seeded — manual
// paste handles those. We do not fake an active source. Dropped as dead
// with no live alternative on a supported host: Retool, Rippling,
// Hugging Face, Replicate, Netflix (bespoke ATS).

export type CuratedBoardType = 'greenhouse' | 'lever' | 'ashby';

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
    slug: 'vercel',
    companyName: 'Vercel',
    boardUrl: 'https://boards.greenhouse.io/vercel',
    notes: 'Frontend platform · developer tools',
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
    slug: 'brex',
    companyName: 'Brex',
    boardUrl: 'https://boards.greenhouse.io/brex',
    notes: 'Fintech · spend management',
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
    notes: 'Design tools · product/design',
  },
  {
    type: 'greenhouse',
    slug: 'lyft',
    companyName: 'Lyft',
    boardUrl: 'https://job-boards.greenhouse.io/lyft',
    notes: 'Transportation · product design',
  },
  {
    type: 'greenhouse',
    slug: 'inflectionai',
    companyName: 'Inflection AI',
    boardUrl: 'https://job-boards.greenhouse.io/inflectionai',
    notes: 'AI · enterprise AI · product design',
  },

  // ── Lever ──────────────────────────────────────────────────────────
  {
    type: 'lever',
    slug: 'mistral',
    companyName: 'Mistral AI',
    boardUrl: 'https://jobs.lever.co/mistral',
    notes: 'AI · open-weight LLMs · product/frontend',
  },

  // ── Ashby (lots of AI-native companies host here) ─────────────────
  {
    type: 'ashby',
    slug: 'notion',
    companyName: 'Notion',
    boardUrl: 'https://jobs.ashbyhq.com/notion',
    notes: 'Productivity · product design',
  },
  {
    type: 'ashby',
    slug: 'linear',
    companyName: 'Linear',
    boardUrl: 'https://jobs.ashbyhq.com/linear',
    notes: 'Product-led SaaS · design quality',
  },
  {
    type: 'ashby',
    slug: 'cursor',
    companyName: 'Cursor (Anysphere)',
    boardUrl: 'https://jobs.ashbyhq.com/cursor',
    notes: 'AI-native code editor · design + frontend',
  },
  {
    type: 'ashby',
    slug: 'ramp',
    companyName: 'Ramp',
    boardUrl: 'https://jobs.ashbyhq.com/ramp',
    notes: 'Fintech · finance ops · design systems',
  },
  {
    type: 'ashby',
    slug: 'plaid',
    companyName: 'Plaid',
    boardUrl: 'https://jobs.ashbyhq.com/plaid',
    notes: 'Fintech · API platform · developer UX',
  },
  {
    type: 'ashby',
    slug: 'perplexity',
    companyName: 'Perplexity',
    boardUrl: 'https://jobs.ashbyhq.com/perplexity',
    notes: 'AI search · product design · frontend',
  },
  {
    type: 'ashby',
    slug: 'suno',
    companyName: 'Suno',
    boardUrl: 'https://jobs.ashbyhq.com/suno',
    notes: 'AI · music generation · product design',
  },
];
