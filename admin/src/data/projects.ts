import type { EmphasisKey } from './angles';

export interface Bullet {
  text: string;
  // Which emphasis this bullet serves best. Engine picks top N per project per angle.
  serves: EmphasisKey[];
  // 0 = generic, 5 = signature
  weight: number;
}

// 'work' entries render in the resume's Experience section (always first);
// 'independent' entries render in the Independent Products section after it.
export type ProjectKind = 'work' | 'independent';

// Per-angle rank within a section + bullet-budget tier. There is no 'omit':
// every entry appears on every angle by design — the angle only decides
// which app leads and how many bullets each entry gets.
export type RolePriority = 'lead' | 'support' | 'mention';

export interface Project {
  id: string;
  kind: ProjectKind;
  title: string;
  company?: string;
  role: string;
  period: string;
  location?: string;
  // Rank within the entry's section. 'lead' = fullest budget, 'mention' = smallest.
  // A missing angle key is treated as 'mention' by the engine.
  role_priority: Record<string, RolePriority>;
  // Optional per-project override of the engine's default bullet budgets.
  bullet_budget?: Partial<Record<RolePriority, number>>;
  // Pool of bullets — engine selects the best N per angle, N = bullet budget.
  bullets: Bullet[];
}

// ORDERING INVARIANT: work entries (kind: 'work') must stay in
// reverse-chronological order relative to each other — the engine renders
// the Experience section in data order. Independent entries are re-sorted
// per angle by role_priority, with data order as the tie-break.
// Note: Date ranges below are placeholders where unknown. Edit before sending.
export const projects: Project[] = [
  {
    id: 'chatobd2',
    kind: 'independent',
    title: 'ChatOBD2',
    role: 'Founder, Product Designer & Engineer',
    period: '2025 — Present',
    location: 'Independent',
    role_priority: {
      'product-designer': 'lead',
      'senior-product-designer': 'lead',
      'ux-engineer': 'lead',
      'frontend-ux-engineer': 'lead',
      'design-engineer': 'lead',
      'web-experience-manager': 'lead',
      'design-systems-engineer': 'support',
      'ai-product-designer': 'lead',
      'ux-product-lead': 'lead',
    },
    bullets: [
      {
        text: 'Designed and built an AI-native diagnostics product end to end: chat-first UX, verdict-first scan results, and a six-layer deterministic reasoning pipeline where the model is one constrained stage with structured inputs and schema-bound outputs.',
        serves: ['product', 'design', 'ai'],
        weight: 5,
      },
      {
        text: 'Made the verdict the unit of output. Safe-to-drive answer renders first, full-width and color-coded, ahead of every paragraph. Tradeoff: less narrative warmth, far faster comprehension.',
        serves: ['product', 'design'],
        weight: 5,
      },
      {
        text: 'Treated scan confidence as part of the answer. Surfaced as a fixed bar instead of hidden state — the kind of decision a less-confident product wouldn’t make.',
        serves: ['product', 'design', 'ai'],
        weight: 4,
      },
      {
        text: 'Pulled all model prompts into a single system module, versioned and keyed by verdict tier and code context. One change updates the whole product; analytics taxonomy stays coherent across it.',
        serves: ['engineering', 'ai', 'design'],
        weight: 5,
      },
      {
        text: 'Built a developer portal as a first-class product surface: architecture diagrams, annotated project structure, system-diagrams library, design-system docs. Maintained alongside the codebase, not bolted on as a wiki.',
        serves: ['engineering', 'ai', 'leadership'],
        weight: 4,
      },
      {
        text: 'Stack: Expo 55, React Native 0.83, TypeScript, Supabase, Zustand, BLE adapter integration, RevenueCat. Marketing site in Next.js + Tailwind.',
        serves: ['engineering'],
        weight: 3,
      },
      {
        text: 'Designed the marketing surface alongside the product: hero, longitudinal-intelligence, pricing tiers, and a developer documentation site — all built end to end against the same component and token system.',
        serves: ['design', 'product', 'ai'],
        weight: 4,
      },
      {
        text: 'Composed the system prompt dynamically per scan from a 38,000-token budget. P0 sections always make the cut; lower-priority sections only land if budget remains. Prompts live in the system, keyed by verdict tier and code context — not scattered across components.',
        serves: ['ai', 'engineering'],
        weight: 5,
      },
    ],
  },
  {
    id: 'vinly',
    kind: 'independent',
    title: 'VINly',
    role: 'Founder, Designer & Engineer',
    period: '2026',
    location: 'Independent',
    role_priority: {
      'product-designer': 'support',
      'senior-product-designer': 'support',
      'ux-engineer': 'mention',
      'frontend-ux-engineer': 'support',
      'design-engineer': 'mention',
      'web-experience-manager': 'mention',
      'design-systems-engineer': 'mention',
      'ai-product-designer': 'support',
      'ux-product-lead': 'support',
    },
    bullets: [
      {
        text: 'Designed and built VINly end to end: screenshot a used-car listing and get back a priced buyer’s report — verdict, opening offer, walk-away floor, year-one cost forecast, a model-specific inspection checklist, and a copyable message to the seller. The report is the product; every section answers a question the buyer was already going to ask.',
        serves: ['product', 'design', 'ai'],
        weight: 5,
      },
      {
        text: 'Made the model explain the number, never pick it. The opening offer, walk-away floor, and real annual mileage are computed by deterministic functions before any model runs — a model that hallucinates a price is worse than no app at all.',
        serves: ['ai', 'engineering', 'product'],
        weight: 5,
      },
      {
        text: 'Built a two-model pipeline: Anthropic Sonnet synthesizes the report grounded in NHTSA recall data and live web lookups, then DeepSeek reads it back as a critic and forces a re-run on any claim the evidence doesn’t support.',
        serves: ['ai', 'engineering'],
        weight: 5,
      },
      {
        text: 'Treated trust as a designed feature: every report carries a receipt — whether it was retried, which model wrote it, how many sources it cited. A buyer trusts a number they can see the basis for.',
        serves: ['design', 'product', 'ai'],
        weight: 4,
      },
      {
        text: 'Owned the security model: the keys that cost money (OpenAI, Anthropic, DeepSeek) live as Supabase Edge Function secrets and never ship in the app bundle. Moving OCR server-side closed a bundled-key hole an earlier version had.',
        serves: ['engineering'],
        weight: 4,
      },
      {
        text: 'Scoped the product by what it refuses to claim — not a vehicle-history service, not a mechanic — and said so out loud. The verdict it gives most often is inspect, not buy.',
        serves: ['product', 'design'],
        weight: 3,
      },
      {
        text: 'Kept the money math deterministic-first so it stays testable: the pricing and offer logic carries 133 tests, because arithmetic that’s wrong the same way every time can be pinned down.',
        serves: ['engineering', 'ai'],
        weight: 4,
      },
      {
        text: 'Stack: Expo / React Native, TypeScript, three Supabase Edge Functions (Deno), Anthropic Sonnet, DeepSeek, OpenAI vision, RevenueCat, Astro marketing site.',
        serves: ['engineering'],
        weight: 3,
      },
    ],
  },
  {
    id: 'carspotter',
    kind: 'independent',
    title: 'CarSpotter',
    role: 'Founder, Designer & Engineer',
    period: '2026',
    location: 'Independent',
    role_priority: {
      'product-designer': 'mention',
      'senior-product-designer': 'mention',
      'ux-engineer': 'support',
      'frontend-ux-engineer': 'mention',
      'design-engineer': 'support',
      'web-experience-manager': 'support',
      'design-systems-engineer': 'lead',
      'ai-product-designer': 'mention',
      'ux-product-lead': 'mention',
    },
    bullets: [
      {
        text: 'Designed, engineered, and shipped CarSpotter solo for iOS — a daily car-spotting game: five cropped details, four answers, ten seconds a clue, the same five for everyone. A Wordle-shaped daily for the people who can name a chassis code from a single taillight.',
        serves: ['product', 'design'],
        weight: 5,
      },
      {
        text: 'Built the rules of the game as a pure-TypeScript game-core package with no React anywhere near them, which makes them trivial to test. The engine carries 234 tests, concentrated on the parts that lose data when they’re wrong.',
        serves: ['engineering'],
        weight: 5,
      },
      {
        text: 'Rebuilt the media layer to be content-addressed: never persist an absolute path — every photo lives under the SHA-256 of its own bytes, the manifest holds stable keys, and the real URI is rebased at runtime, with atomic download-verify-move writes.',
        serves: ['engineering'],
        weight: 5,
      },
      {
        text: 'Diagnosed a data-loss-class bug — iOS regenerates its container UUID on every reinstall, so stored file:// reveal paths silently dangled — and fixed the class, not the instance: a recovery pipeline that re-derived 374 of 375 reveals, a bundler that fails loud, and referential-integrity gates guarding the studio, export, and build.',
        serves: ['engineering', 'product'],
        weight: 5,
      },
      {
        text: 'Shipped a shared design-tokens package that both the app and the marketing site compile from, so the brand can’t drift between the two.',
        serves: ['design', 'engineering'],
        weight: 4,
      },
      {
        text: 'Made sharing spoiler-free by construction — one tap turns a run into colored squares and a clock, no car names or photos — so the growth loop can’t ruin the round for the group chat.',
        serves: ['design', 'product'],
        weight: 3,
      },
      {
        text: 'Ran the whole thing from one Turborepo monorepo; even the App Store screenshots and the portfolio poster come out of a scripted, versioned ImageMagick pipeline next to the code.',
        serves: ['engineering', 'design'],
        weight: 3,
      },
      {
        text: 'Stack: Expo / React Native, TypeScript, Zustand, MMKV, Turborepo monorepo, Astro, ImageMagick pipeline.',
        serves: ['engineering'],
        weight: 3,
      },
    ],
  },
  {
    id: 'magtek',
    kind: 'work',
    title: 'MagTek Platform',
    company: 'MagTek',
    role: 'UX & Frontend Systems',
    period: '2022 — Present',
    role_priority: {
      'product-designer': 'support',
      'senior-product-designer': 'support',
      'ux-engineer': 'lead',
      'frontend-ux-engineer': 'lead',
      'design-engineer': 'support',
      'web-experience-manager': 'lead',
      'design-systems-engineer': 'lead',
      'ai-product-designer': 'support',
      'ux-product-lead': 'support',
    },
    bullets: [
      {
        text: 'Own UX and frontend architecture across MagTek’s multi-site platform — MagTek.com, Magensa, the hardware product line, the support portal, and the network of related properties built on the shared ASP.NET MVC substrate. ~85% of the public frontend, modernized end to end.',
        serves: ['design', 'engineering', 'leadership'],
        weight: 5,
      },
      {
        text: 'Built a shared component library on Razor partials — 100+ shared components covering primitives (button, card, badge, breadcrumb, sticky sub-nav), content blocks (hero, metric row, comparison table, feature grid, callout), and layout shells. Each partial declares a typed ViewModel, so calling it is type-checked and a missing required field is a build error.',
        serves: ['engineering', 'design'],
        weight: 5,
      },
      {
        text: 'Rebuilt the CSS foundation as a real design system: spacing, color, type, radius, shadow, motion pulled into tokens. Surfaces adopt the tokens incrementally, on their own timeline — no flag day, no rewrite, just compounding consistency as each property migrates.',
        serves: ['design', 'engineering'],
        weight: 5,
      },
      {
        text: 'Built navigation grammar that travels across properties never originally designed to share an identity — header behavior on scroll, breadcrumbs, sticky horizontal sub-navs, mobile drawers. Same primitives, applied with the same rules across MagTek and Magensa.',
        serves: ['design', 'engineering'],
        weight: 4,
      },
      {
        text: 'Sequenced platform-evolution work without breaking production: replacing one-off layouts with primitives, migrating consumers off legacy markup, and choreographing internal links, redirects, analytics, and crawl signals so downstream tools never saw a discontinuity.',
        serves: ['engineering', 'leadership'],
        weight: 4,
      },
      {
        text: 'Use AI as production infrastructure in the build, not a feature in the product. Claude and Cursor for code work, Figma for precision, Claude Design when visual reasoning is faster than markup. Codebase stays the source of truth across all of them.',
        serves: ['ai', 'engineering'],
        weight: 3,
      },
      {
        text: 'Stack: ASP.NET MVC (.NET Framework), C#, Razor (CSHTML), Entity Framework, JavaScript/jQuery, Bootstrap, hand-authored CSS systems, design tokens.',
        serves: ['engineering'],
        weight: 3,
      },
    ],
  },
  {
    id: 'investcloud',
    kind: 'work',
    title: 'Advisor Platforms',
    company: 'InvestCloud, Inc.',
    role: 'Front End Developer, UX',
    period: 'Aug 2020 – May 2021',
    location: 'West Hollywood, CA · Remote',
    // Real shipped employment — renders in the Experience section on every
    // angle. The support budget is bumped to 4 bullets via bullet_budget.
    bullet_budget: { support: 4 },
    role_priority: {
      'product-designer': 'mention',
      'senior-product-designer': 'mention',
      'ux-engineer': 'support',
      'frontend-ux-engineer': 'support',
      'design-engineer': 'support',
      'web-experience-manager': 'support',
      'design-systems-engineer': 'support',
      'ai-product-designer': 'mention',
      'ux-product-lead': 'mention',
    },
    bullets: [
      {
        text: 'Contributed to or led 0-to-production deploys across 50+ wealth-management and banking institutions on InvestCloud’s proprietary multi-tenant platform — Chase, Cetera, Northwestern Mutual, Voya, Silicon Valley Bank, East West Bank, and many more. One framework underneath; per-institution branding, structure, and IA on top.',
        serves: ['engineering', 'design', 'leadership'],
        weight: 5,
      },
      {
        text: 'Translated handoffs from Figma, Sketch, and InVision into production through InvestCloud’s proprietary stylesheet development tools and hand-written CSS, against a multi-tenant CMS that didn’t always have a primitive for what was drawn.',
        serves: ['design', 'engineering'],
        weight: 5,
      },
      {
        text: 'Built dense, data-heavy financial layouts that stayed readable across desktop, tablet, and mobile, typically against design specs authored for one breakpoint.',
        serves: ['design', 'engineering'],
        weight: 4,
      },
      {
        text: 'Configured and customized the platform’s components to fit each institution’s brand, IA, and product requirements while keeping the underlying framework stable across deployments.',
        serves: ['engineering', 'design', 'product'],
        weight: 4,
      },
      {
        text: 'Coordinated with design, product, project management, QA, and support so each institutional implementation shipped on schedule and behaved in production the way it did in the spec — at the pace and volume a 50+ institution deploy schedule required.',
        serves: ['leadership', 'product'],
        weight: 4,
      },
    ],
  },
];

export const projectById = (id: string): Project | undefined =>
  projects.find(p => p.id === id);
