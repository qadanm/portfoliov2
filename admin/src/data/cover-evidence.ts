// Cover-letter evidence: per-angle positioning, proof lines, and craft
// closers. The letter generator picks the two evidence lines whose themes
// best overlap the JD's matched strengths (see letters.ts); with no JD it
// takes the first two in authored order.
//
// AUTHORING RULES (the letter pipeline depends on these):
//  - Every proper noun must already appear in projects.ts / skills.ts text.
//    The authenticity scanner flags CamelCase/digit tokens that aren't in
//    resume vocabulary. ChatOBD2, VINly, CarSpotter, MagTek, Magensa,
//    InvestCloud, NHTSA, Razor, TypeScript, Supabase, Figma, ASP.NET all pass.
//  - No em or en dashes (stripDashes flattens them); write plain commas
//    and colons so the intent survives.
//  - No AI red-flag phrases (see packet/authenticity.ts): no "leverage",
//    no "passionate", no "cutting-edge", no "I am thrilled".
//  - No fabricated metrics or tenure. The numbers below are real and come
//    from the project bullets: 100+ components, 50+ institutions,
//    38,000-token budget, 234 tests, 133 tests.
//  - `themes` entries must use the analyzer STRENGTHS vocabulary
//    (lowercase) or matching against the JD can never hit.

export interface EvidenceLine {
  projectId: 'chatobd2' | 'vinly' | 'carspotter' | 'magtek' | 'investcloud';
  text: string;
  themes: string[];
}

// ── Shared line library ────────────────────────────────────────────────
// Lines are authored once and composed per angle below, so a fact fix
// lands everywhere it is used.

const MAGTEK_SYSTEM: EvidenceLine = {
  projectId: 'magtek',
  text: `At MagTek I built and maintain a 100+ component Razor partial library with typed ViewModels, on a CSS foundation rebuilt as design tokens that the multi-site platform adopts incrementally, with no flag day.`,
  themes: ['design system', 'design systems', 'design tokens', 'component library', 'razor', 'css', 'multi-site', 'platform'],
};

const MAGTEK_PLATFORM: EvidenceLine = {
  projectId: 'magtek',
  text: `My day job is MagTek, where I own UX and frontend architecture across the multi-site platform: MagTek.com, Magensa, the hardware product line, and the support portal, all on a shared ASP.NET MVC substrate modernized end to end.`,
  themes: ['platform', 'platform ux', 'multi-site', 'asp.net', 'mvc', 'frontend', 'ux engineering'],
};

const MAGTEK_MIGRATION: EvidenceLine = {
  projectId: 'magtek',
  text: `At MagTek I sequence platform evolution without breaking production: replacing one-off layouts with shared primitives, migrating consumers off legacy markup, and keeping links, analytics, and crawl signals continuous while it happens.`,
  themes: ['platform', 'multi-site', 'frontend', 'css'],
};

const INVESTCLOUD_SCALE: EvidenceLine = {
  projectId: 'investcloud',
  text: `Earlier, at InvestCloud, I contributed to or led 0-to-production portal deploys across 50+ wealth and banking institutions, including Chase, Cetera, and Northwestern Mutual, translating Figma handoffs into a multi-tenant platform at production fidelity.`,
  themes: ['multi-tenant', 'figma', 'css', 'frontend', 'platform'],
};

const CHATOBD2_PIPELINE: EvidenceLine = {
  projectId: 'chatobd2',
  text: `In ChatOBD2, my AI-native diagnostics app, the model is one constrained stage in a six-layer pipeline: prompts are versioned in the system, composed per scan inside a 38,000-token budget, and outputs are schema-bound.`,
  themes: ['ai', 'llm', 'prompt', 'product design'],
};

const CHATOBD2_END2END: EvidenceLine = {
  projectId: 'chatobd2',
  text: `I founded and shipped ChatOBD2 end to end: the chat-first product surface, the verdict-first scan results, the marketing site, and the developer portal, all built against one component and token system.`,
  themes: ['product design', 'design system', 'react native', 'expo', 'design-in-code'],
};

const VINLY_GUARDS: EvidenceLine = {
  projectId: 'vinly',
  text: `VINly, my AI used-car buyer report, never lets the model pick the price: deterministic functions compute the offer and walk-away floor before any model runs, one model writes the report grounded in NHTSA data, and a second reads it back as a critic.`,
  themes: ['ai', 'llm', 'product design', 'supabase'],
};

const VINLY_FULLSTACK: EvidenceLine = {
  projectId: 'vinly',
  text: `VINly runs on three Supabase Edge Functions I built and shipped solo, with the paid model keys held server-side and the money math carrying 133 tests.`,
  themes: ['supabase', 'ai', 'react native', 'expo', 'typescript', 'frontend'],
};

const CARSPOTTER_TOKENS: EvidenceLine = {
  projectId: 'carspotter',
  text: `CarSpotter, my daily car-spotting game for iOS, ships from a shared design-tokens package that the app and its marketing site both compile from, so the brand cannot drift between them.`,
  themes: ['design tokens', 'design system', 'design systems', 'react native', 'astro', 'design-in-code'],
};

const CARSPOTTER_ENGINE: EvidenceLine = {
  projectId: 'carspotter',
  text: `CarSpotter runs on a pure-TypeScript game core carrying 234 tests and a content-addressed media pipeline, so a reinstall can never orphan a photo and the parts that lose data when wrong carry the most tests.`,
  themes: ['typescript', 'react native', 'expo', 'frontend'],
};

const CARSPOTTER_SHIPPED: EvidenceLine = {
  projectId: 'carspotter',
  text: `I designed, engineered, and shipped CarSpotter solo: a daily car-spotting game, five cropped details on a ten-second clock, with a spoiler-free share card built to be safe for the group chat.`,
  themes: ['product design', 'design-in-code', 'react native'],
};

const TRIO: EvidenceLine = {
  projectId: 'chatobd2',
  text: `On my own time I have designed and shipped three iOS products end to end: ChatOBD2, an AI-native diagnostics app; VINly, an AI used-car buyer report; and CarSpotter, a daily car-spotting game.`,
  themes: ['product design', 'react native', 'expo', 'frontend'],
};

// ── Per-angle openers ──────────────────────────────────────────────────

export const POSITIONING: Record<string, string> = {
  'product-designer':
    `I'm a product designer who ships: product UX, system design, and the implementation that makes it real, across my own iOS apps and a long-running enterprise platform.`,
  'senior-product-designer':
    `I'm a senior product designer with end-to-end ownership: the design, the build, and the calls in between, proven across shipped products of my own and platform work inside a team.`,
  'ux-engineer':
    `I'm a UX engineer who lives in the seam between design and frontend, comfortable in code, constraints, and the systems both have to survive.`,
  'frontend-ux-engineer':
    `I'm a frontend UX engineer with platform depth: React, TypeScript, React Native, Astro, and the hand-authored CSS systems underneath them.`,
  'design-engineer':
    `I'm a design engineer: most of my work happens in code, against the components and tokens the product is built from.`,
  'web-experience-manager':
    `I lead web experience across a multi-site enterprise platform: UX, content structure, frontend systems, and the long arc of keeping it healthy in production.`,
  'design-systems-engineer':
    `I'm a design systems engineer: tokens, typed components, and the platform discipline that lets one change land everywhere it should.`,
  'ai-product-designer':
    `I design AI-native products where the model is one constrained stage in a structured pipeline, not the product itself.`,
  'ux-product-lead':
    `I'm a product and UX lead with end-to-end ownership: I make the call, build the surface, and live with the consequences.`,
};

// ── Per-angle evidence pools ───────────────────────────────────────────
// Ordered: the first two lines are the no-JD defaults. Every pool spans
// all five entries (MagTek, InvestCloud, and the three apps).

export const EVIDENCE: Record<string, EvidenceLine[]> = {
  'product-designer': [CHATOBD2_END2END, VINLY_GUARDS, MAGTEK_PLATFORM, CARSPOTTER_SHIPPED, INVESTCLOUD_SCALE],
  'senior-product-designer': [CHATOBD2_END2END, MAGTEK_PLATFORM, VINLY_GUARDS, CARSPOTTER_SHIPPED, INVESTCLOUD_SCALE],
  'ux-engineer': [MAGTEK_SYSTEM, CHATOBD2_END2END, CARSPOTTER_ENGINE, VINLY_FULLSTACK, INVESTCLOUD_SCALE],
  'frontend-ux-engineer': [MAGTEK_SYSTEM, VINLY_FULLSTACK, CARSPOTTER_ENGINE, CHATOBD2_END2END, INVESTCLOUD_SCALE],
  'design-engineer': [CARSPOTTER_TOKENS, CHATOBD2_END2END, MAGTEK_SYSTEM, VINLY_FULLSTACK, INVESTCLOUD_SCALE],
  'web-experience-manager': [MAGTEK_PLATFORM, MAGTEK_MIGRATION, INVESTCLOUD_SCALE, CHATOBD2_END2END, CARSPOTTER_TOKENS],
  'design-systems-engineer': [MAGTEK_SYSTEM, CARSPOTTER_TOKENS, CHATOBD2_END2END, INVESTCLOUD_SCALE, VINLY_FULLSTACK],
  'ai-product-designer': [CHATOBD2_PIPELINE, VINLY_GUARDS, CARSPOTTER_ENGINE, MAGTEK_PLATFORM, INVESTCLOUD_SCALE],
  'ux-product-lead': [TRIO, MAGTEK_PLATFORM, VINLY_GUARDS, CHATOBD2_END2END, INVESTCLOUD_SCALE],
};

// ── Per-angle craft closers (used when the JD gives nothing to weave) ──

export const CRAFT: Record<string, string> = {
  'product-designer':
    `The things I care about: tight hierarchy, accessible defaults, motion that earns its keep, and deleting UI instead of dressing it up.`,
  'senior-product-designer':
    `What I optimize for: visible decisions, named tradeoffs, and surfaces that survive the system they live in.`,
  'ux-engineer':
    `I care about the parts that compound: typed contracts, accessibility as a default, and components that behave predictably when an arbitrary engineer reaches for them under deadline.`,
  'frontend-ux-engineer':
    `I do the unfashionable parts of frontend well: accessibility audits, performance regressions, and the long tail of browser weirdness.`,
  'design-engineer':
    `The craft layer most teams under-invest in is where I spend my time: typography, spacing, motion timing, focus states, and the keyboard model.`,
  'web-experience-manager':
    `Most of the wins are unglamorous on their own but compound: shared primitives, incremental token adoption, and migrations that never break production.`,
  'design-systems-engineer':
    `My approach: tokens before components, accessibility as a non-negotiable default, and documentation engineers actually reach for while shipping.`,
  'ai-product-designer':
    `The discipline I bring: constrained outputs, confidence surfaced as part of the answer, and prompts living in the system instead of scattered across components.`,
  'ux-product-lead':
    `My style: clear bets, design reviews that produce decisions, and fluency across product, design, and frontend without losing any of them.`,
};
