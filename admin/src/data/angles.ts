// The 9 role angles. The id is the URL slug.
// `emphasis` controls how the engine ranks bullets, projects, and skills.
//   - product: product thinking, decisions, outcomes
//   - design: visual design, systems, polish
//   - engineering: stack, architecture, constraints
//   - ai: AI integration, system translation
//   - leadership: scope, ownership, cross-functional

export type EmphasisKey = 'product' | 'design' | 'engineering' | 'ai' | 'leadership';

export interface Angle {
  id: string;
  label: string;
  shortLabel: string;
  emphasis: Record<EmphasisKey, number>; // 0–5
  // The headline pattern hint. The actual text lives in content.ts.
  archetype: 'designer' | 'engineer' | 'hybrid' | 'lead';
}

export const angles: Angle[] = [
  {
    id: 'product-designer',
    label: 'Product Designer',
    shortLabel: 'Product Designer',
    emphasis: { product: 5, design: 4, engineering: 2, ai: 3, leadership: 2 },
    archetype: 'designer',
  },
  {
    id: 'senior-product-designer',
    label: 'Senior Product Designer',
    shortLabel: 'Sr. Product Designer',
    emphasis: { product: 5, design: 4, engineering: 2, ai: 3, leadership: 4 },
    archetype: 'designer',
  },
  {
    id: 'ux-engineer',
    label: 'UX Engineer',
    shortLabel: 'UX Engineer',
    emphasis: { product: 3, design: 4, engineering: 5, ai: 3, leadership: 2 },
    archetype: 'hybrid',
  },
  {
    id: 'frontend-ux-engineer',
    label: 'Frontend UX Engineer',
    shortLabel: 'Frontend UX Eng',
    emphasis: { product: 2, design: 3, engineering: 5, ai: 3, leadership: 2 },
    archetype: 'engineer',
  },
  {
    id: 'design-engineer',
    label: 'Design Engineer',
    shortLabel: 'Design Engineer',
    emphasis: { product: 3, design: 5, engineering: 5, ai: 4, leadership: 2 },
    archetype: 'hybrid',
  },
  {
    id: 'web-experience-manager',
    label: 'Web Experience Manager',
    shortLabel: 'Web Experience Mgr',
    emphasis: { product: 4, design: 3, engineering: 3, ai: 2, leadership: 5 },
    archetype: 'lead',
  },
  {
    id: 'design-systems-engineer',
    label: 'Design Systems Engineer',
    shortLabel: 'Design Systems Eng',
    emphasis: { product: 2, design: 5, engineering: 5, ai: 3, leadership: 3 },
    archetype: 'hybrid',
  },
  {
    id: 'ai-product-designer',
    label: 'AI Product Designer',
    shortLabel: 'AI Product Designer',
    emphasis: { product: 5, design: 4, engineering: 3, ai: 5, leadership: 2 },
    archetype: 'designer',
  },
  {
    id: 'ux-product-lead',
    label: 'UX / Product Lead',
    shortLabel: 'UX / Product Lead',
    emphasis: { product: 5, design: 4, engineering: 3, ai: 3, leadership: 5 },
    archetype: 'lead',
  },
];

export const angleById = (id: string): Angle | undefined =>
  angles.find(a => a.id === id);
