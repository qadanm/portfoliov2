import { defineCollection, z } from 'astro:content';

const work = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(['Product System', 'Design System', 'Agentic Workflow', 'UX Engineering', 'AI-Native', 'Platform', 'Research']),
    year: z.string(),
    role: z.string(),
    tags: z.array(z.string()),
    featured: z.boolean().default(false),
    order: z.number().default(99),
    draft: z.boolean().default(false),
    cover: z.string().optional(),
    outcome: z.string().optional(),
    client: z.string().optional(),
  }),
});

const writing = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    readingTime: z.number().optional(),
  }),
});

const lab = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(['Active', 'Shipped', 'Archived', 'Concept']),
    tags: z.array(z.string()).default([]),
    date: z.coerce.date(),
    order: z.number().default(99),
  }),
});

export const collections = { work, writing, lab };
