import type { EmphasisKey } from './angles';

export interface Bullet {
  text: string;
  // Which emphasis this bullet serves best. Engine picks top N per project per angle.
  serves: EmphasisKey[];
  // 0 = generic, 5 = signature
  weight: number;
}

export interface Project {
  id: string;
  title: string;
  company?: string;
  role: string;
  period: string;
  location?: string;
  // Per-angle role priority. 'lead' = primary case. 'support' = secondary. 'mention' = one-liner. 'omit' = drop entirely.
  role_priority: Record<string, 'lead' | 'support' | 'mention' | 'omit'>;
  // Pool of bullets — engine selects the best 3–5 per angle.
  bullets: Bullet[];
}

// Note: Date ranges below are placeholders where unknown. Edit before sending.
export const projects: Project[] = [
  {
    id: 'chatobd2',
    title: 'ChatOBD2',
    role: 'Founder, Product Designer & Engineer',
    period: '2025 — Present',
    location: 'Independent',
    role_priority: {
      'product-designer': 'lead',
      'senior-product-designer': 'lead',
      'ux-engineer': 'support',
      'frontend-ux-engineer': 'support',
      'design-engineer': 'lead',
      'web-experience-manager': 'mention',
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
    id: 'magtek',
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
      'ai-product-designer': 'mention',
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
    title: 'Advisor Platforms',
    company: 'InvestCloud, Inc.',
    role: 'Front End Developer, UX',
    period: 'Aug 2020 – May 2021',
    location: 'West Hollywood, CA · Remote',
    // InvestCloud is a real shipped role and must appear on EVERY angle. Use
    // 'mention' (2 bullets) at minimum. Engine selectProjects will not omit it.
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
  {
    id: 'sawa',
    title: 'Sawa Marketing Site',
    role: 'Designer & Frontend Engineer',
    period: '2024',
    location: 'Independent',
    role_priority: {
      'product-designer': 'support',
      'senior-product-designer': 'mention',
      'ux-engineer': 'mention',
      'frontend-ux-engineer': 'mention',
      'design-engineer': 'support',
      'web-experience-manager': 'support',
      'design-systems-engineer': 'mention',
      'ai-product-designer': 'support',
      'ux-product-lead': 'mention',
    },
    bullets: [
      {
        text: 'Designed and built the marketing site for Sawa, a group-decision dining app. Scope was the marketing surface, not the app itself.',
        serves: ['design', 'product'],
        weight: 4,
      },
      {
        text: 'Two surfaces did the convincing: a live matches feed (real squads, real restaurants, real time) and a curated City Food Guides section sourced from Reddit threads with attribution kept intact. Content as proof, not promises.',
        serves: ['design', 'product'],
        weight: 4,
      },
      {
        text: 'Tone alignment as the brief: carry the app’s calm, low-friction feel into the marketing surface that introduces it. The install path is one number long — SMS in, app link out, no account creation before the user has seen the value.',
        serves: ['product', 'design'],
        weight: 4,
      },
      {
        text: 'Stack: Next.js, Tailwind, content-driven city guides, hand-built layouts.',
        serves: ['engineering'],
        weight: 2,
      },
    ],
  },
];

export const projectById = (id: string): Project | undefined =>
  projects.find(p => p.id === id);
