import { defineCollection, z } from 'astro:content';

const build = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    short: z.string(),
    category: z.enum(['Flagship', 'Platform', 'Product', 'Frontend']),
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
    order: z.number().default(99),
    draft: z.boolean().default(false),
    engagement: z.enum(['independent', 'work']).default('independent'),
    company: z.string().optional(),
    period: z.string().optional(),
    role: z.string().optional(),
    scope: z.string().optional(),
    status: z.string().optional(),
    outcomes: z.array(z.object({
      label: z.string(),
      value: z.string(),
    })).optional(),
    stack: z.array(z.string()).optional(),
    coverImage: z.string().optional(),
    coverAlt: z.string().optional(),
  }),
});

export const collections = { build };
