import { defineCollection, z } from 'astro:content';

const build = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    short: z.string(),
    // Optional long-form hero copy. `short` stays the one-line summary that
    // cards, the work index and next-project links all read.
    headline: z.string().optional(),
    summary: z.string().optional(),
    // Home-card line, when it differs from the work-index line.
    cardDescription: z.string().optional(),
    // Per-surface copy for surfaces that cannot read `short` verbatim:
    // the About timeline entry, the Approach example card, and the
    // "next case study" card on the previous project's page.
    secondaryCopy: z.object({
      about: z.string().optional(),
      approach: z.string().optional(),
      related: z.string().optional(),
    }).optional(),
    category: z.enum(['Independent product', 'Open source', 'Platform work']),
    keyFocus: z.array(z.string()),
    placeholder: z.object({
      from: z.string(),
      to: z.string(),
      label: z.string(),
      sublabel: z.string().optional(),
      angle: z.number().default(135),
      labelTone: z.enum(['light', 'dark']).default('light'),
    }),
    featured: z.boolean().default(false),
    inProgress: z.boolean().default(false),
    order: z.number().default(99),
    draft: z.boolean().default(false),
    engagement: z.enum(['independent', 'work']).default('independent'),
    company: z.string().optional(),
    period: z.string().optional(),
    role: z.string().optional(),
    roleShort: z.string().optional(),
    scope: z.string().optional(),
    status: z.string().optional(),
    // Live-product links: when present, the case study renders an App Store
    // badge + marketing-site link in the header and a closing download CTA.
    appStoreUrl: z.string().url().optional(),
    siteUrl: z.string().url().optional(),
    siteLabel: z.string().optional(),
    npmUrl: z.string().url().optional(),
    repoUrl: z.string().url().optional(),
    facts: z.array(z.object({
      label: z.string(),
      value: z.string(),
    })).optional(),
    stack: z.array(z.string()).optional(),
    coverImage: z.string().optional(),
    coverAlt: z.string().optional(),
    coverCaption: z.string().optional(),
    coverWidth: z.number().optional(),
    coverHeight: z.number().optional(),
    // Portrait companion for mobile art direction — a separate composition,
    // never a centre crop of the desktop cover.
    coverMobileImage: z.string().optional(),
    coverMobileAlt: z.string().optional(),
    // Per-project SEO overrides. Defaults stay title/short + /og/<slug>.jpg.
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    ogImage: z.string().optional(),
    ogAlt: z.string().optional(),
  }),
});

export const collections = { build };
