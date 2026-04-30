// Per-angle headline + summary. The engine picks by angle id.
// Tone rules: grounded, anti-buzzword, no em dashes, no fabricated metrics.

export const headlines: Record<string, string> = {
  'product-designer':
    'Product designer who ships. UX, system design, and design-in-code across long-running platforms and AI-native products.',
  'senior-product-designer':
    'Senior product designer with end-to-end ownership. UX, system design, and the implementation that makes design land.',
  'ux-engineer':
    'UX engineer at the seam between design and frontend. Comfortable in code, constraints, and the systems both have to live in.',
  'frontend-ux-engineer':
    'Frontend UX engineer. Design-aware implementation across long-running platforms, AI-native products, and the codebases both have to ship through.',
  'design-engineer':
    'Design engineer. Most of my work happens in code, against the components and tokens the product is built from.',
  'web-experience-manager':
    'Web experience leader. Multi-site platform UX, content systems, and the long arc of keeping a product surface healthy under traffic.',
  'design-systems-engineer':
    'Design systems engineer. Tokens, components, and the platform-level discipline that lets a single change land everywhere it should.',
  'ai-product-designer':
    'AI product designer. Build for systems where the model is one constrained stage in a structured pipeline, and prompt engineering is a core layer.',
  'ux-product-lead':
    'Product/UX lead. End-to-end ownership: the design, the implementation, the system underneath, and the calls that hold them together.',
};

export const summaries: Record<string, string> = {
  'product-designer':
    'Product designer with deep frontend literacy. Built ChatOBD2, an AI-native diagnostics product, end to end. Lead UX and frontend systems across MagTek’s multi-site platform. Comfortable making decisions where design and engineering meet.',

  'senior-product-designer':
    'Senior product designer with end-to-end ownership across product, marketing surfaces, and developer-facing experiences. Founded ChatOBD2, an AI-native diagnostics product. Lead the UX and frontend systems for MagTek’s multi-site platform. Make calls where design, engineering, and platform constraints overlap.',

  'ux-engineer':
    'UX engineer who works in the seam between design and frontend. Built ChatOBD2 end to end. Operate the UX layer across MagTek’s ASP.NET MVC platform. Earlier: built advisor portals at InvestCloud across major wealth institutions, implementing Figma handoffs at production fidelity.',

  'frontend-ux-engineer':
    'Frontend UX engineer with platform depth. Comfortable across React, TypeScript, React Native, Astro, ASP.NET MVC + Razor, and hand-authored CSS systems. Built and maintain frontend systems for ChatOBD2 (AI-native product) and MagTek (multi-site enterprise platform).',

  'design-engineer':
    'Design engineer working in the overlap. Built ChatOBD2 end to end with AI as a structured system layer in the build — branched execution across Claude, Cursor, and Claude Design rather than a chained pipeline. Maintain platform-level design systems at MagTek. Author CSS and components by hand against tokens that ship across many surfaces.',

  'web-experience-manager':
    'Web experience leader across MagTek’s multi-site enterprise platform. Own UX, content structure, and frontend systems across MagTek.com, Magensa, and related properties. Earlier: built advisor portals at InvestCloud across major wealth institutions.',

  'design-systems-engineer':
    'Design systems engineer. Built and maintain a Razor component library + token-driven CSS substrate across MagTek’s multi-site platform. Built ChatOBD2’s React Native design system from the ground up. Comfortable with platform constraints, incremental adoption, and zero-downtime migration.',

  'ai-product-designer':
    'Product designer for AI-native systems. Founded ChatOBD2, where the model is one constrained stage inside a six-layer structured pipeline, prompts live in the system rather than in components, and outputs are schema-bound. Designed and built the product, the marketing site, and the developer portal that keeps it maintainable.',

  'ux-product-lead':
    'Product and UX lead. End-to-end ownership across an AI-native product (ChatOBD2) and a multi-site enterprise platform (MagTek). Comfortable making the call, building the surface, and living with the consequences across many years of platform life.',
};

// Optional kicker line under headline, kept very short.
// Used in the Beautiful resume only; ATS strips it.
export const kickers: Record<string, string> = {
  'product-designer': 'Product UX · System design · Design-in-code',
  'senior-product-designer': 'Product · System design · End-to-end ownership',
  'ux-engineer': 'Frontend systems · UX implementation · AI as system layer',
  'frontend-ux-engineer': 'Frontend systems · Platform UX · AI as system layer',
  'design-engineer': 'Design-in-code · Tokens & components · AI as infrastructure',
  'web-experience-manager': 'Multi-site platform · Content systems · UX',
  'design-systems-engineer': 'Tokens · Components · Platform discipline',
  'ai-product-designer': 'AI-native product UX · System translation · Design-in-code',
  'ux-product-lead': 'Product · UX · Implementation · Ownership',
};
