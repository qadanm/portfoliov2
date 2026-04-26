// Per-angle recruiter messaging. All copy below is grounded in the actual
// portfolio. Edit before sending — these are sharp drafts, not finished outreach.

export interface RecruiterPack {
  shortIntro: string; // 1–2 sentences for cold reply
  longIntro: string;  // 4–5 sentences for follow-up email
  tellMeAboutYourself: string; // ~60 second spoken answer
  whyImAFit: string[]; // 3 bullets, role-aware
  aiExplanation: string; // explain Claude Design / AI use without overclaiming
  salaryFraming: string; // tone, not numbers — pick a band per opportunity
}

export const recruiterPacks: Record<string, RecruiterPack> = {
  'product-designer': {
    shortIntro:
      'Product designer who ships. Most recently founded ChatOBD2, an AI-native diagnostics product, designed and built end to end. Day job: UX lead across MagTek’s multi-site platform.',
    longIntro:
      'I’m a product designer with deep frontend literacy. Most of my work lives at the seam where design decisions meet platform constraints. I founded ChatOBD2, an AI-native diagnostics product where the design problem was translation: turning vehicle data into something a person can act on. I lead the UX and frontend systems work across MagTek’s multi-site platform, and earlier built advisor-facing portals at InvestCloud across institutions like Chase, Cetera, and Northwestern Mutual. Open to senior product design roles where the work has weight.',
    tellMeAboutYourself:
      'I’m a product designer who came up through the implementation side, which means I think about UX and frontend constraints in the same head. Most recently I founded ChatOBD2, an AI-native automotive diagnostics product. I designed it end to end: the chat surface, the verdict-first scan results, the AI pipeline behind it. The design problem there is translation, not visualization. My day job is leading UX and frontend systems across MagTek’s multi-site enterprise platform, where the work is mostly about evolving a long-running system without breaking what already runs. Earlier I was at InvestCloud building advisor portals across major wealth institutions. The thread across all of it is the same: design that has to survive the system it lives in.',
    whyImAFit: [
      'Senior-level product thinking: visible decisions, named tradeoffs, ownership of consequences.',
      'Frontend literacy means handoff hygiene that actually works — I think in components, tokens, and breakpoints natively.',
      'AI-native product experience without the buzzword tax: I’ve shipped a product where AI sits constrained in the middle of a deterministic pipeline.',
    ],
    aiExplanation:
      'Claude Design is part of how I explore visually now. Claude Code carries the chosen direction into implementation. Both sit inside a longer practice: Figma for precision, Cursor for build, hand-authored CSS for the systems that ship. AI is one tool in the loop, used where it actually helps.',
    salaryFraming:
      'I’m looking at senior product design roles in the $180–240k base range, depending on scope and equity. Open to discussing.',
  },

  'senior-product-designer': {
    shortIntro:
      'Senior product designer with end-to-end ownership. Founded ChatOBD2, an AI-native diagnostics product. Lead UX and frontend systems for MagTek’s multi-site platform.',
    longIntro:
      'Senior product designer who works across product, marketing surface, and developer-facing experience. I founded ChatOBD2, where AI sits constrained inside a six-layer deterministic pipeline. I lead UX and frontend systems for MagTek’s multi-site enterprise platform, where most of the work is evolving a long-running system in production. Earlier I shipped advisor portals at InvestCloud across institutions like Chase, Cetera, and Northwestern Mutual. The pattern across all of it: design that ships, decisions that get owned, systems that stay healthy.',
    tellMeAboutYourself:
      'I’m a senior product designer with end-to-end ownership in my recent work. I founded ChatOBD2, an AI-native diagnostics product. I designed and built the product surface, the marketing site, and the developer portal that keeps the codebase maintainable. The design problem was translation: turning vehicle data into a single answer the driver can act on, with confidence visible as part of the answer. My current platform work is at MagTek, where I lead UX and frontend systems across the multi-site portfolio. The work there is about evolving a long-running ASP.NET platform in production without breaking what runs. Earlier I was at InvestCloud building advisor-facing portals at production fidelity across major wealth institutions. The thread is the same: design that survives the system it lives in.',
    whyImAFit: [
      'End-to-end ownership: I’ve designed, built, and maintained surfaces from product to marketing to dev portal.',
      'Cross-functional fluency: I move between product, design, engineering, and platform conversations natively.',
      'Real shipped surfaces, not concepts: ChatOBD2 in market, MagTek in production, InvestCloud across institutions.',
    ],
    aiExplanation:
      'Claude Design is part of my front-end design loop. Figma for precision, Cursor and Claude Code for implementation, WebSim for fast browser experiments. AI sits where it earns a seat — exploration, system-aware iteration, dev-portal maintenance — not as a feature pasted onto everything.',
    salaryFraming:
      'Senior product design with founder-level ownership. I’d expect $200–260k base for the right scope, depending on equity and team size.',
  },

  'ux-engineer': {
    shortIntro:
      'UX engineer in the seam between design and frontend. Built ChatOBD2 end to end. Lead UX and frontend systems for MagTek’s multi-site platform.',
    longIntro:
      'I’m a UX engineer who lives at the design/frontend boundary. Most of my work is closing the gap between Figma intent (or Claude Design exploration) and what the system can actually carry. I built ChatOBD2 end to end, lead the UX layer across MagTek’s ASP.NET MVC platform, and earlier shipped advisor portals at InvestCloud across institutions like Chase, Cetera, and Northwestern Mutual. Comfortable in TypeScript, React, React Native, Astro, Razor, hand-authored CSS, and the constraints that come with all of them.',
    tellMeAboutYourself:
      'I’m a UX engineer. The reason I describe myself that way is that I think most of the interesting work happens in the seam between design and frontend, not on either side of it. Recently I founded ChatOBD2, where I designed and built the product end to end including the AI pipeline behind it. My day job is leading the UX and frontend systems work for MagTek’s multi-site enterprise platform, which is a long-running ASP.NET system that has to keep evolving in production. Earlier I was at InvestCloud building advisor portals across major wealth institutions, which was mostly translating Figma at fidelity into a multi-tenant CMS. The common thread is design that has to survive the system it lives in.',
    whyImAFit: [
      'Stack literacy across React, TypeScript, React Native, Astro, ASP.NET MVC + Razor, hand-CSS systems.',
      'Design literacy: I read intent, not just specs, and I close the gaps a handoff doesn’t see.',
      'Comfortable in the constraints of long-running platforms — most of my work has lived inside them.',
    ],
    aiExplanation:
      'I use Claude Code for implementation work and Claude Design for exploration. Cursor for the rest of the build. The thread is design-in-code: the design lives in the components and tokens the product is built from, and AI sits in the loop where it earns a seat.',
    salaryFraming:
      'UX engineer with cross-stack depth. $180–230k base range depending on level and scope.',
  },

  'frontend-ux-engineer': {
    shortIntro:
      'Frontend UX engineer with platform depth. Most recently shipped ChatOBD2 (Expo + RN, BLE, Supabase). Lead frontend systems across MagTek’s multi-site platform.',
    longIntro:
      'Frontend UX engineer comfortable across React, TypeScript, React Native (Expo), Next.js, Astro, ASP.NET MVC + Razor, and hand-authored CSS systems. Built ChatOBD2 end to end including BLE adapter integration and a constrained AI pipeline. Lead frontend systems across MagTek’s multi-site enterprise platform. Earlier shipped advisor portals at InvestCloud across institutions like Chase, Cetera, and Northwestern Mutual.',
    tellMeAboutYourself:
      'I’m a frontend UX engineer with platform depth. I’ve shipped on long-running ASP.NET platforms (MagTek), modern React Native and Next.js stacks (ChatOBD2 + its marketing site), and the more constrained world of multi-tenant CMS frameworks (InvestCloud, across major wealth institutions). The thread is the same in all of them: thinking in components, tokens, and breakpoints, and not letting handoff fidelity be the place where the work breaks down. Most recently I founded ChatOBD2, an AI-native diagnostics product where I designed and built everything from BLE integration to the AI prompt pipeline.',
    whyImAFit: [
      'Production frontend work across React, TypeScript, React Native, Next.js, Astro, ASP.NET MVC.',
      'Strong design literacy: the implementation respects intent, not just specs.',
      'Comfortable with AI in the build loop (Cursor, Claude Code) without giving up the ownership of decisions.',
    ],
    aiExplanation:
      'Cursor and Claude Code are part of how I move through implementation work. Claude Design at the front of the loop for visual exploration. AI is used where it actually pays off — repetitive iteration, structured development, dev-portal maintenance — not for the parts that need a human call.',
    salaryFraming:
      'Senior frontend UX engineer band: $180–230k base depending on stack and scope.',
  },

  'design-engineer': {
    shortIntro:
      'Design engineer working in the overlap. Built ChatOBD2 end to end with Claude Design + Claude Code. Maintain platform-level design systems at MagTek.',
    longIntro:
      'I’m a design engineer. Most of my work happens in code, against the components and tokens the product is built from. I built ChatOBD2 end to end with Claude Design at the front of the loop and Claude Code carrying it into implementation. I maintain a Razor component library and token-driven CSS substrate across MagTek’s multi-site enterprise platform. Earlier I built advisor portals at InvestCloud, where the work was translating Figma at fidelity into a multi-tenant CMS.',
    tellMeAboutYourself:
      'I describe myself as a design engineer because I don’t think of design and build as separate stages. Most of my work happens in code, against the components and tokens the product is actually built from. Recently I founded ChatOBD2, where Claude Design lives at the front of the loop and Claude Code carries it into implementation. My day job is at MagTek where I maintain a platform-level Razor component library and a token-driven CSS substrate across many properties. Earlier I was at InvestCloud doing high-fidelity Figma implementation across major wealth institutions. The thread is the same: design that survives the build.',
    whyImAFit: [
      'Design-in-code as a real practice, not a buzzword: hand-authored CSS systems, token-driven substrate, component libraries.',
      'AI-augmented build loop without losing ownership: Claude Design + Claude Code + Cursor live in my day-to-day.',
      'Platform discipline: most of my work has shipped in long-running systems where incremental adoption matters.',
    ],
    aiExplanation:
      'Claude Design at the front of the loop for visual exploration against real system context. Claude Code carries the chosen direction into the codebase. Cursor for the rest of the build. Tokens and components are the source of truth, not Figma — design lives where the system does.',
    salaryFraming:
      'Design engineering at the senior band: $190–240k base depending on scope.',
  },

  'web-experience-manager': {
    shortIntro:
      'Web experience leader. Lead UX, frontend systems, and content structure across MagTek’s multi-site enterprise platform.',
    longIntro:
      'I lead web experience across MagTek’s multi-site enterprise platform — MagTek.com, Magensa, and a network of related properties built on a shared ASP.NET MVC substrate. The work is platform-level: rebuilding the homepage in a way that survives the marketing surfaces sized to it, restructuring the support portal around how users actually arrive, migrating the design system into tokens the rest of the platform can adopt incrementally. Earlier I shipped advisor portals at InvestCloud across major wealth institutions, which built my discipline around shared systems and per-tenant adaptation.',
    tellMeAboutYourself:
      'I lead web experience across MagTek’s multi-site enterprise platform. The job is keeping a long-running ASP.NET system healthy and evolving in production: MagTek.com, the Magensa subsidiary surface, the support portal, the hardware product pages, and the network of properties built on the same substrate. Most of the wins are unsexy in isolation — replacing a six-slide rotating carousel with a static hero, restructuring a support portal around how users actually arrive, moving spacing and color into tokens the rest of the platform can adopt on its own timeline — but they compound. Earlier I built advisor portals at InvestCloud across institutions like Chase, Cetera, and Northwestern Mutual, which is where I learned how to run a shared system across many implementations.',
    whyImAFit: [
      'Multi-site platform ownership: real shipped work across MagTek’s portfolio.',
      'Content + structure thinking, not just visual: support portal restructure, hardware product page pattern, navigation grammar.',
      'Comfortable owning the long arc: incremental adoption, sequenced migrations, no-downtime evolution.',
    ],
    aiExplanation:
      'AI runs through how the platform itself gets built and maintained. Cursor and Claude in the build workflow for repetitive iteration. Claude Design for visual exploration when a screen is easier to think through visually than in code. Human owns every decision that ships.',
    salaryFraming:
      'Web experience lead with multi-site platform scope: $180–230k base depending on team size.',
  },

  'design-systems-engineer': {
    shortIntro:
      'Design systems engineer. Built and maintain MagTek’s Razor component library + token substrate. Built ChatOBD2’s RN design system from scratch.',
    longIntro:
      'Design systems engineer with platform-level scope. At MagTek I maintain a Razor component library and a token-driven CSS substrate that the rest of the multi-site platform can adopt incrementally. At ChatOBD2 I built the React Native design system from the ground up, including a context-aware color system and a hardware-aware component layer. Earlier I shipped advisor portals at InvestCloud across major wealth institutions, where the discipline was per-tenant adaptation inside a shared component framework.',
    tellMeAboutYourself:
      'I’m a design systems engineer. The job, the way I think about it, is making it possible for a single change to land everywhere it should without breaking anything around it. At MagTek that means a Razor component library and a token substrate that incrementally replaces page-specific markup and stylesheets. At ChatOBD2 that means a token system and a component layer that the chat surface, scan results, marketing site, and developer portal all share. The discipline is the same in both: incremental adoption, real consumers from day one, no big-bang rewrites.',
    whyImAFit: [
      'Real shipped design systems on long-running platforms, not greenfield decks.',
      'Cross-stack: Razor + Bootstrap + hand-CSS at MagTek, RN + Tailwind at ChatOBD2, Figma + multi-tenant CMS at InvestCloud.',
      'Discipline around incremental adoption and platform constraints — the systems I’ve shipped are the ones still in production.',
    ],
    aiExplanation:
      'Claude Design as the front of the design loop. Claude Code maintaining developer-facing docs and system-diagram libraries. Cursor for the build. AI lives where it earns a seat — system-aware exploration, doc maintenance, repetitive iteration — not as a layer pasted onto the system itself.',
    salaryFraming:
      'Design systems at the senior band: $190–240k base depending on platform scope.',
  },

  'ai-product-designer': {
    shortIntro:
      'AI product designer. Founded ChatOBD2, where AI sits constrained inside a six-layer deterministic pipeline. End-to-end design and build.',
    longIntro:
      'I design AI-native products where the AI is constrained, not driving. Most recently founded ChatOBD2, an automotive diagnostics product where vehicle data flows through six deterministic reasoning layers before the model writes a character. The design problem is translation: turning data into a single answer a driver can act on, with confidence visible as part of the answer. I designed and built the product, the marketing surface, and the developer portal end to end. Earlier I lead UX and frontend systems work across MagTek’s multi-site platform.',
    tellMeAboutYourself:
      'I design AI-native products. The framing I use is that the design problem is translation, not generation. ChatOBD2, which I founded, is the clearest example: the system reads vehicle data, runs it through six deterministic reasoning layers to assemble context, and then the model gets a heavily structured prompt with a 38,000 token budget where each section has a priority. The model’s output is a single verdict card. The interface stops asking the driver to interpret data and starts telling them what to do next. AI is in the middle of the pipeline, constrained by structure on either side. That’s the kind of work I want to keep doing.',
    whyImAFit: [
      'Real shipped AI-native product, not a Figma concept.',
      'Product UX thinking specifically about model-in-the-loop systems: constrained outputs, confidence as part of the answer, prompts as system not as components.',
      'Cross-functional reach: design, build, AI pipeline, marketing surface, developer portal — all owned end to end.',
    ],
    aiExplanation:
      'I treat AI like any other tool with real surface area. Structured inputs, constrained outputs, deliberate iteration. The model drafts and handles the parts that compound; I keep the architecture, the decisions, and the review. That posture extends to how I use Claude Design and Claude Code in the build loop too.',
    salaryFraming:
      'AI-native product design with founder-level ownership: $200–260k base depending on scope.',
  },

  'ux-product-lead': {
    shortIntro:
      'Product/UX lead with end-to-end ownership. Founded ChatOBD2. Lead UX and frontend systems across MagTek’s multi-site platform.',
    longIntro:
      'I lead UX and product across an AI-native product (ChatOBD2) and a multi-site enterprise platform (MagTek). The pattern is end-to-end: design, build, ship, evolve in production. ChatOBD2 is mine — I founded it, designed it, built it, and maintain its developer surface. MagTek is the long-running ASP.NET platform I lead UX and frontend systems for. Earlier I shipped advisor portals at InvestCloud across major wealth institutions. Comfortable making the call, building the surface, and living with the consequences.',
    tellMeAboutYourself:
      'I lead UX and product work end to end. Recently I founded ChatOBD2, an AI-native diagnostics product. I designed it, built it, shipped it, and maintain its developer portal. My platform work is at MagTek, where I lead UX and frontend systems across MagTek.com, Magensa, and the network of related properties. Earlier I was at InvestCloud building advisor portals across institutions like Chase, Cetera, and Northwestern Mutual. The pattern across all of it: I make the call, build the surface, and live with the consequences. That’s the kind of role I’m looking for next.',
    whyImAFit: [
      'End-to-end ownership across an AI-native product and a multi-site enterprise platform.',
      'Comfortable making and owning calls — visible decisions and named tradeoffs across the recent work.',
      'Cross-functional fluency: design, frontend systems, platform engineering, AI integration.',
    ],
    aiExplanation:
      'AI runs through how I work. Claude Design at the front of the design loop, Claude Code carrying decisions into implementation, Cursor for the rest of the build. AI is used where it earns a seat. Human owns every decision that ships.',
    salaryFraming:
      'Lead-level role with founder-level ownership: $210–270k base depending on team size and equity.',
  },
};
