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
        text: 'Designed and built an AI-native diagnostics product end to end: chat-first UX, verdict-first scan results, and a six-layer deterministic reasoning pipeline that constrains the model on either side.',
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
        text: 'Pulled all AI prompts into a single module keyed by verdict tier and code context. One change updates the whole product; analytics taxonomy stays coherent.',
        serves: ['engineering', 'ai', 'design'],
        weight: 5,
      },
      {
        text: 'Built a developer portal as a first-class product surface: architecture diagrams, annotated project structure, system-diagrams library, design system docs. Maintained continuously by Claude Code as the codebase moves.',
        serves: ['engineering', 'ai', 'leadership'],
        weight: 4,
      },
      {
        text: 'Stack: Expo 55, React Native 0.83, TypeScript, Supabase, Zustand, BLE adapter integration, RevenueCat. Marketing site in Next.js + Tailwind.',
        serves: ['engineering'],
        weight: 3,
      },
      {
        text: 'Designed the marketing surface alongside the product: hero, longitudinal-intelligence, pricing tiers, and a developer documentation site, all built end to end with Claude Design and Claude Code.',
        serves: ['design', 'product', 'ai'],
        weight: 4,
      },
      {
        text: 'Composed the AI system prompt dynamically from prioritized modules within a 38,000-token budget. P0 sections always make the cut; P5 sections only land if budget remains. Same logic that constrains the model also makes it inspectable.',
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
        text: 'Operate across MagTek.com and a network of related properties built on a long-running ASP.NET MVC platform. Improvements have to land without disrupting production traffic.',
        serves: ['engineering', 'leadership'],
        weight: 4,
      },
      {
        text: 'Built a shared Razor component library that moves the platform off page-specific markup. Modular, strongly typed, faster to iterate, more consistent on the surface.',
        serves: ['engineering', 'design'],
        weight: 5,
      },
      {
        text: 'Rebuilt the homepage. Replaced a six-slide rotating carousel that nobody finished with a static hero on a single message. Sequenced the migration so dependent surfaces, analytics taxonomy, and SEO didn’t drift during transition.',
        serves: ['product', 'design', 'leadership'],
        weight: 5,
      },
      {
        text: 'Restructured the support portal around how users actually arrive (specific error, product, or question), not the org chart. Standardized layout patterns so every article looks, scrolls, and behaves the same way.',
        serves: ['product', 'design'],
        weight: 4,
      },
      {
        text: 'Migrated spacing, color, and type into tokens the rest of the platform could adopt incrementally on its own timeline. No big-bang rewrite, no breakage.',
        serves: ['design', 'engineering'],
        weight: 5,
      },
      {
        text: 'Hardware product pages built on a single buyer-facing template across card readers, OEM components, check scanners, and issuance hardware. Sticky horizontal sub-nav keeps the four categories one click apart.',
        serves: ['design', 'product'],
        weight: 4,
      },
      {
        text: 'Designed and shipped Magensa subsidiary surfaces: distinct brand identity inside the parent platform, scroll-aware sticky header, "Old Way / Magensa Way" comparison pattern.',
        serves: ['design', 'product'],
        weight: 3,
      },
      {
        text: 'Stack: ASP.NET MVC (.NET Framework), C#, Razor (CSHTML), Entity Framework, JavaScript, jQuery, Bootstrap, hand-authored CSS systems.',
        serves: ['engineering'],
        weight: 3,
      },
      {
        text: 'Integrated Cursor and Claude into the workflow for repetitive iteration and structured development. Human owns every decision that ships.',
        serves: ['ai', 'engineering'],
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
        text: 'Built advisor- and customer-facing portals on InvestCloud’s framework, deployed across Chase, Cetera, Northwestern Mutual, Voya, Silicon Valley Bank, and East West Bank. One platform underneath; per-institution branding, structure, and IA on top.',
        serves: ['engineering', 'design', 'leadership'],
        weight: 5,
      },
      {
        text: 'Implemented complex Figma handoffs faithfully in hand-written CSS, against a multi-tenant CMS that didn’t always have a primitive for what was drawn.',
        serves: ['design', 'engineering'],
        weight: 5,
      },
      {
        text: 'Built dense, data-heavy financial layouts that stayed readable across desktop, tablet, and mobile, often within design constraints authored mostly for one breakpoint.',
        serves: ['design', 'engineering'],
        weight: 4,
      },
      {
        text: 'Coordinated tightly with design, product, and QA so that "looks right in Figma" and "works in production" stayed connected across many institutional implementations.',
        serves: ['leadership', 'product'],
        weight: 4,
      },
      {
        text: 'Built design literacy: ~60% of the work was reproducing intent faithfully; ~40% was closing gaps the original handoff didn’t see. The second 40% is where it pays off.',
        serves: ['design', 'leadership'],
        weight: 4,
      },
    ],
  },
  {
    id: 'sawa',
    title: 'Sawa (Marketing Site)',
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
        text: 'Started in Cursor with hand-authored Tailwind. Brought Claude Design into the loop for visual exploration of new sections (live matches, city food guides, the swipe-and-match story) before they landed back in code.',
        serves: ['design', 'ai', 'engineering'],
        weight: 4,
      },
      {
        text: 'Tone alignment as the brief: carry the app’s calm, low-friction feel into the surface that introduces it. Conversion architecture used SMS install instead of app-store deep links to keep the path one number long.',
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
