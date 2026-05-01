import type { EmphasisKey } from './angles';

export interface Skill {
  name: string;
  category: 'design' | 'frontend' | 'platform' | 'ai' | 'tools' | 'practice';
  serves: EmphasisKey[];
  weight: number; // 0–5
}

export const skills: Skill[] = [
  // Design
  { name: 'Product UX', category: 'design', serves: ['product', 'design'], weight: 5 },
  { name: 'Design systems', category: 'design', serves: ['design', 'engineering'], weight: 5 },
  { name: 'Information architecture', category: 'design', serves: ['product', 'design'], weight: 4 },
  { name: 'Interaction design', category: 'design', serves: ['design', 'product'], weight: 4 },
  { name: 'Visual design', category: 'design', serves: ['design'], weight: 4 },
  { name: 'Content & UX writing', category: 'design', serves: ['design', 'product'], weight: 3 },

  // Frontend
  { name: 'TypeScript', category: 'frontend', serves: ['engineering'], weight: 5 },
  { name: 'React', category: 'frontend', serves: ['engineering'], weight: 5 },
  { name: 'React Native (Expo)', category: 'frontend', serves: ['engineering'], weight: 4 },
  { name: 'Astro', category: 'frontend', serves: ['engineering'], weight: 4 },
  { name: 'Next.js', category: 'frontend', serves: ['engineering'], weight: 4 },
  { name: 'Tailwind', category: 'frontend', serves: ['engineering', 'design'], weight: 4 },
  { name: 'Hand-authored CSS systems', category: 'frontend', serves: ['engineering', 'design'], weight: 5 },
  { name: 'Accessibility (WCAG)', category: 'frontend', serves: ['engineering', 'design'], weight: 4 },

  // Platform
  { name: 'ASP.NET MVC + Razor', category: 'platform', serves: ['engineering'], weight: 4 },
  { name: 'Razor partials as typed components', category: 'platform', serves: ['engineering', 'design'], weight: 5 },
  { name: 'C#', category: 'platform', serves: ['engineering'], weight: 3 },
  { name: 'Multi-tenant frontends', category: 'platform', serves: ['engineering', 'leadership'], weight: 4 },
  { name: 'Long-running platform UX', category: 'platform', serves: ['engineering', 'product', 'leadership'], weight: 5 },
  { name: 'Supabase', category: 'platform', serves: ['engineering'], weight: 3 },

  // AI — described as concrete capabilities, not jargon
  { name: 'Prompt engineering (versioned, scoped, budgeted)', category: 'ai', serves: ['ai', 'engineering'], weight: 5 },
  { name: 'Structured AI pipelines (model held as one constrained stage)', category: 'ai', serves: ['ai', 'product', 'engineering'], weight: 5 },
  { name: 'Schema-bound model outputs', category: 'ai', serves: ['ai', 'engineering'], weight: 4 },
  { name: 'Requirement discovery via model interrogation', category: 'ai', serves: ['ai', 'product'], weight: 4 },
  { name: 'AI-assisted code workflows (Claude, Cursor)', category: 'ai', serves: ['ai', 'engineering'], weight: 5 },
  { name: 'Visual exploration with Claude Design', category: 'ai', serves: ['ai', 'design'], weight: 4 },

  // Tools
  { name: 'Figma', category: 'tools', serves: ['design'], weight: 4 },
  { name: 'Adobe XD', category: 'tools', serves: ['design'], weight: 2 },
  { name: 'WebSim', category: 'tools', serves: ['design', 'engineering'], weight: 2 },

  // Practice
  { name: 'Design-in-code', category: 'practice', serves: ['design', 'engineering'], weight: 5 },
  { name: 'Working under platform constraints', category: 'practice', serves: ['engineering', 'leadership'], weight: 4 },
  { name: 'Cross-functional handoff hygiene', category: 'practice', serves: ['leadership', 'design', 'engineering'], weight: 4 },
];
