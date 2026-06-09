// Per-angle recruiter messaging. All copy below is grounded in the actual
// portfolio. Edit before sending — these are sharp drafts, not finished outreach.
//
// Tone rules:
// - No fabricated tenure ("decade", "eight-plus years", etc.)
// - No vocabulary tics ("system layer", "execution layer", "branched not chained",
//   "the loop") repeated as filler. One concrete framing per pack, max.
// - Lead with what was actually shipped.

export interface RecruiterPack {
  shortIntro: string; // 1–2 sentences for cold reply
  longIntro: string;  // 4–5 sentences for follow-up email
  tellMeAboutYourself: string; // ~60 second spoken answer
  whyImAFit: string[]; // 3 bullets, role-aware
  aiExplanation: string; // explain how AI fits in without overclaiming
  salaryFraming: string; // tone, not numbers — pick a band per opportunity
}

export const recruiterPacks: Record<string, RecruiterPack> = {
  'product-designer': {
    shortIntro:
      'Product designer who ships. Recently designed and shipped two independent iOS products end to end — ChatOBD2, an AI-native diagnostics app, and VINly, an AI used-car buyer report. Day job: UX lead across MagTek’s multi-site platform.',
    longIntro:
      'I’m a product designer with deep frontend literacy. Most of my work lives at the seam where design decisions meet platform constraints. I’ve designed and shipped a run of independent iOS products — ChatOBD2, an AI-native diagnostics app, and VINly, which turns a used-car listing into a verdict and an opening offer. In both, the design problem was translation: turning messy data into a single thing a person can act on. I lead the UX and frontend systems work across MagTek’s multi-site platform, and earlier contributed to or led 0-to-production deploys across 50+ wealth-management institutions at InvestCloud — Chase, Cetera, Northwestern Mutual, and many others. Open to senior product design roles where the work has weight.',
    tellMeAboutYourself:
      'I’m a product designer who came up through the implementation side, which means I think about UX and frontend constraints in the same head. Most recently I’ve been designing and building my own iOS products end to end: ChatOBD2, an AI-native diagnostics app, and VINly, which reads a used-car listing and returns a priced buyer’s report. The design problem in both is translation, not visualization — taking data the user can’t parse and handing back a decision. My day job is leading UX and frontend systems across MagTek’s multi-site enterprise platform, where the work is mostly about evolving a long-running system without breaking what already runs. Earlier I was at InvestCloud, where I contributed to or led 0-to-production deploys for advisor and customer portals across 50+ wealth-management and banking institutions. The thread across all of it is the same: design that has to survive the system it lives in.',
    whyImAFit: [
      'Senior-level product thinking: visible decisions, named tradeoffs, ownership of consequences.',
      'Frontend literacy means handoff hygiene that actually works — I think in components, tokens, and breakpoints natively.',
      'AI-native product experience without the buzzword tax: I’ve shipped products where the model is one constrained stage inside a structured pipeline, not the whole pitch.',
    ],
    aiExplanation:
      'I treat AI as production infrastructure, not a feature you flip on. In the build: Claude and Cursor handle code work, Figma stays for precision, Claude Design enters when visual reasoning is faster than markup. In the products I ship: prompts are versioned and live in the system rather than scattered across components, and the model is held as one constrained stage in a structured pipeline — in VINly, deterministic math even sets the price the model is never allowed to invent.',
    salaryFraming:
      'I’m looking at senior product design roles in the $180–240k base range, depending on scope and equity. Open to discussing.',
  },

  'senior-product-designer': {
    shortIntro:
      'Senior product designer with end-to-end ownership. Founded and shipped independent iOS products — ChatOBD2, an AI-native diagnostics app, and VINly, an AI used-car buyer report. Lead UX and frontend systems for MagTek’s multi-site platform.',
    longIntro:
      'Senior product designer who works across product, marketing surface, and developer-facing experience. I’ve founded and shipped independent iOS products end to end: ChatOBD2, where the model is one constrained stage inside a six-layer pipeline, and VINly, an AI buyer report where deterministic math sets the price and a second model audits the first. I lead UX and frontend systems for MagTek’s multi-site enterprise platform. Earlier at InvestCloud I contributed to or led 0-to-production deploys for advisor and customer portals across 50+ wealth-management and banking institutions, including Chase, Cetera, and Northwestern Mutual. The pattern across all of it: design that ships, decisions that get owned, systems that stay healthy.',
    tellMeAboutYourself:
      'I’m a senior product designer with end-to-end ownership in my recent work. I’ve been founding and shipping my own iOS products: ChatOBD2, an AI-native diagnostics app, and VINly, which turns a used-car listing into a priced buyer’s report. In both I designed and built the product surface, the marketing site, and the backend pipeline behind it. The design problem is translation: turning data into a single answer the user can act on, with the system’s confidence visible as part of the answer. My current platform work is at MagTek, where I lead UX and frontend systems across the multi-site portfolio. The work there is about evolving a long-running ASP.NET platform in production without breaking what runs. Earlier I was at InvestCloud, where I contributed to or led 0-to-production deploys for portals across 50+ wealth and banking institutions. The thread is the same: design that survives the system it lives in.',
    whyImAFit: [
      'End-to-end ownership: I’ve designed, built, and maintained surfaces from product to marketing to backend across several shipped apps.',
      'Cross-functional fluency: I move between product, design, engineering, and platform conversations natively.',
      'Real shipped surfaces, not concepts: ChatOBD2 and VINly on the App Store track, MagTek in production, InvestCloud across 50+ institutions.',
    ],
    aiExplanation:
      'I treat AI as production infrastructure. In ChatOBD2, the model is one constrained stage inside a six-layer reasoning pipeline; the system prompt is composed per scan from a 38,000-token budget; outputs are schema-bound. In VINly, deterministic functions compute the price before any model runs and a second model audits the first’s claims. In the build itself, I use Claude and Cursor for code work, Figma for precision, Claude Design when a visual frame moves faster than markup. The point is repeatability, not novelty.',
    salaryFraming:
      'Senior product design with founder-level ownership. I’d expect $200–260k base for the right scope, depending on equity and team size.',
  },

  'ux-engineer': {
    shortIntro:
      'UX engineer in the seam between design and frontend. Built and shipped independent iOS products end to end — ChatOBD2 and CarSpotter. Lead UX and frontend systems for MagTek’s multi-site platform.',
    longIntro:
      'I’m a UX engineer who lives at the design/frontend boundary. Most of my work is closing the gap between design intent and what the system can actually carry. I’ve built and shipped independent iOS products end to end — ChatOBD2, an AI-native diagnostics app, and CarSpotter, a daily game whose engine carries 234 tests and whose media layer is content-addressed so a reinstall can’t orphan a file. I lead the UX layer across MagTek’s ASP.NET MVC platform, and earlier contributed to or led 0-to-production deploys across 50+ wealth and banking institutions at InvestCloud — including Chase, Cetera, and Northwestern Mutual. Comfortable in TypeScript, React, React Native, Astro, Razor, hand-authored CSS, and the constraints that come with all of them.',
    tellMeAboutYourself:
      'I’m a UX engineer. The reason I describe myself that way is that I think most of the interesting work happens in the seam between design and frontend, not on either side of it. Recently I’ve been building and shipping my own iOS products: ChatOBD2, where I designed and built the product end to end including the AI pipeline behind it, and CarSpotter, a daily game built on a serious spine — a pure-TypeScript game core with 234 tests and a content-addressed media pipeline I rebuilt after a data-loss bug nearly shipped. My day job is leading the UX and frontend systems work for MagTek’s multi-site enterprise platform — a long-running ASP.NET system that has to keep evolving in production. Earlier I was at InvestCloud, where I contributed to or led 0-to-production portal deploys across 50+ wealth and banking institutions. The common thread is design that has to survive the system it lives in.',
    whyImAFit: [
      'Stack literacy across React, TypeScript, React Native, Astro, ASP.NET MVC + Razor, hand-CSS systems.',
      'Design literacy: I read intent, not just specs, and I close the gaps a handoff doesn’t see.',
      'Engineering rigor where it counts: the parts of my apps that lose data when they’re wrong carry the most tests.',
    ],
    aiExplanation:
      'AI runs through my work as production infrastructure, not a feature. Claude and Cursor are the default for code. Figma stays for precision and design-system maintenance. Claude Design enters only when a visual frame is faster than the markup. The codebase is the source of truth across all of them.',
    salaryFraming:
      'UX engineer with cross-stack depth. $180–230k base range depending on level and scope.',
  },

  'frontend-ux-engineer': {
    shortIntro:
      'Frontend UX engineer with platform depth. Shipped two React Native apps end to end — ChatOBD2 (Expo + RN, BLE, Supabase) and VINly (Expo + RN, Supabase Edge Functions, multi-model AI). Lead frontend systems across MagTek’s multi-site platform.',
    longIntro:
      'Frontend UX engineer comfortable across React, TypeScript, React Native (Expo), Next.js, Astro, ASP.NET MVC + Razor, and hand-authored CSS systems. Built and shipped two React Native apps end to end: ChatOBD2, including BLE adapter integration and a constrained AI pipeline, and VINly, including three Supabase Edge Functions (Deno) and a two-model report pipeline with the API keys held server-side. Lead frontend systems across MagTek’s multi-site enterprise platform. Earlier contributed to or led 0-to-production portal deploys across 50+ wealth and banking institutions at InvestCloud, including Chase, Cetera, and Northwestern Mutual.',
    tellMeAboutYourself:
      'I’m a frontend UX engineer with platform depth. I’ve shipped on long-running ASP.NET platforms (MagTek), modern React Native stacks (ChatOBD2 and VINly, both Expo + RN with Supabase behind them), and the constrained world of multi-tenant CMS frameworks (InvestCloud, where I contributed to or led 0-to-production deploys across 50+ institutions). The thread is the same in all of them: thinking in components, tokens, and breakpoints, and not letting handoff fidelity be the place where the work breaks down. Most recently I’ve been building my own iOS products end to end — from BLE integration and the AI prompt pipeline in ChatOBD2 to the Edge Functions and deterministic pricing in VINly.',
    whyImAFit: [
      'Production frontend work across React, TypeScript, React Native, Next.js, Astro, ASP.NET MVC.',
      'Full-stack reach when the product needs it: Supabase Edge Functions, server-side AI calls, secrets kept out of the bundle.',
      'Comfortable with AI in the build loop (Cursor, Claude) without giving up the ownership of decisions.',
    ],
    aiExplanation:
      'AI is production infrastructure in the build, not a feature in the product. Claude and Cursor handle code work; Figma and Claude Design come in for visual problems where they help. In the products I ship, prompts live in the system rather than scattered across components, and the model is held as one constrained stage in a structured pipeline.',
    salaryFraming:
      'Senior frontend UX engineer band: $180–230k base depending on stack and scope.',
  },

  'design-engineer': {
    shortIntro:
      'Design engineer working in the overlap. Built ChatOBD2 and CarSpotter end to end, the latter on a shared design-tokens package the app and marketing site both compile from. Maintain the Razor component library and design-token substrate at MagTek.',
    longIntro:
      'I’m a design engineer. Most of my work happens in code, against the components and tokens the product is built from. I built ChatOBD2 end to end, and shipped CarSpotter solo out of a Turborepo monorepo where a shared design-tokens package is the single source the app and the marketing site both compile from, so the brand can’t drift. I maintain a 100+ component Razor partial library and a token-driven CSS substrate across MagTek’s multi-site enterprise platform. Earlier at InvestCloud I contributed to or led 0-to-production portal deploys across 50+ wealth-management and banking institutions, where the work was translating Figma at fidelity into a multi-tenant CMS.',
    tellMeAboutYourself:
      'I describe myself as a design engineer because I don’t think of design and build as separate stages. Most of my work happens in code, against the components and tokens the product is actually built from. Recently I shipped two of my own iOS products: ChatOBD2 and CarSpotter, the latter built on a shared token package that both the app and its website compile from. My day job is at MagTek, where I maintain a Razor partial library — over 100 typed, reusable components — and a token-driven CSS substrate that incrementally replaces page-specific markup across many properties. Earlier I was at InvestCloud doing high-fidelity Figma implementation across 50+ wealth and banking institutions. The thread is the same: design that survives the build.',
    whyImAFit: [
      'Design-in-code as a real practice, not a buzzword: hand-authored CSS systems, token-driven substrate, typed component libraries.',
      'AI as production infrastructure in the build: Claude and Cursor for code, Figma for precision, Claude Design when a visual frame is faster than markup.',
      'Platform discipline: most of my work has shipped in long-running systems where incremental adoption matters.',
    ],
    aiExplanation:
      'AI is infrastructure inside the build, not a feature inside the product. Claude and Cursor are the default for code. Figma and Claude Design enter when visual reasoning is faster than markup. Tokens and components stay the source of truth across all of them.',
    salaryFraming:
      'Design engineering at the senior band: $190–240k base depending on scope.',
  },

  'web-experience-manager': {
    shortIntro:
      'Web experience leader. Lead UX, frontend systems, and content structure across MagTek’s multi-site enterprise platform.',
    longIntro:
      'I lead web experience across MagTek’s multi-site enterprise platform — MagTek.com, Magensa, the hardware product line, the support portal, and the network of related properties built on a shared ASP.NET MVC substrate. The work is platform-level: a 100+ component Razor partial library, a CSS foundation rebuilt as design tokens, navigation grammar that travels, sequenced migrations that don’t break production. Earlier at InvestCloud I contributed to or led 0-to-production portal deploys across 50+ wealth-management and banking institutions, which built my discipline around shared systems and per-tenant adaptation.',
    tellMeAboutYourself:
      'I lead web experience across MagTek’s multi-site enterprise platform. The job is keeping a long-running ASP.NET system healthy and evolving in production: MagTek.com, the Magensa subsidiary surface, the support portal, the hardware product pages, and the network of properties built on the same substrate. Most of the wins are unsexy in isolation — building 100+ shared Razor partial components, replacing one-off layouts with primitives, moving spacing and color into tokens the rest of the platform can adopt on its own timeline — but they compound. Earlier I was at InvestCloud, where I contributed to or led 0-to-production portal deploys across 50+ institutions, including Chase, Cetera, and Northwestern Mutual. That’s where I learned how to run a shared system across many implementations. On my own time I design and ship independent iOS products (ChatOBD2, VINly, CarSpotter), which keeps me close to the whole product surface, not just the platform layer.',
    whyImAFit: [
      'Multi-site platform ownership: real shipped work across MagTek’s portfolio.',
      'Content + structure thinking, not just visual: support portal restructure, hardware product page pattern, navigation grammar.',
      'Comfortable owning the long arc: incremental adoption, sequenced migrations, no-downtime evolution.',
    ],
    aiExplanation:
      'I use AI as production infrastructure in how the platform gets built and maintained, not as a feature inside the product. Claude and Cursor handle code work; Figma and Claude Design come in when visual reasoning is faster than markup. A human owns every decision that ships.',
    salaryFraming:
      'Web experience lead with multi-site platform scope: $180–230k base depending on team size.',
  },

  'design-systems-engineer': {
    shortIntro:
      'Design systems engineer. Built and maintain MagTek’s 100+ component Razor partial library and design-token substrate. Built ChatOBD2’s RN design system from scratch, and shipped CarSpotter on a shared design-tokens package the app and its marketing site both compile from.',
    longIntro:
      'Design systems engineer with platform-level scope. At MagTek I maintain a 100+ component Razor partial library and a token-driven CSS substrate that the rest of the multi-site platform adopts incrementally. Each partial declares a typed ViewModel, so calling it is type-checked and a missing required field is a build error, not a runtime surprise. At ChatOBD2 I built the React Native design system from the ground up, including a context-aware color system and a hardware-aware component layer. In CarSpotter, the design tokens live in a shared package that both the iOS app and the marketing site compile from, so the brand can’t drift between them. Earlier at InvestCloud I contributed to or led 0-to-production portal deploys across 50+ wealth-management and banking institutions, where the discipline was per-tenant adaptation inside a shared component framework.',
    tellMeAboutYourself:
      'I’m a design systems engineer. The job, the way I think about it, is making it possible for a single change to land everywhere it should without breaking anything around it. At MagTek that means a 100+ component Razor partial library — typed, modular, composable — plus a token substrate that incrementally replaces page-specific markup and stylesheets. At ChatOBD2 that means a token system and a component layer that the chat surface, scan results, marketing site, and developer portal all share. At CarSpotter it means a single tokens package the app and the website both compile from. The discipline is the same across all of them: incremental adoption, real consumers from day one, no big-bang rewrites.',
    whyImAFit: [
      'Real shipped design systems on long-running platforms, not greenfield decks. 100+ shared components currently in production at MagTek.',
      'Cross-stack: Razor + Bootstrap + hand-CSS at MagTek, RN design systems at ChatOBD2 and CarSpotter (the latter a shared tokens package across app and web), Figma + multi-tenant CMS at InvestCloud across 50+ institutions.',
      'Discipline around incremental adoption and platform constraints — the systems I’ve shipped are the ones still in production.',
    ],
    aiExplanation:
      'AI runs through the build as production infrastructure, not as a product feature. Claude and Cursor for code work, Figma for precision, Claude Design when visual reasoning is faster than markup. Tokens and component contracts stay the source of truth across all of them.',
    salaryFraming:
      'Design systems at the senior band: $190–240k base depending on platform scope.',
  },

  'ai-product-designer': {
    shortIntro:
      'AI product designer. Shipped ChatOBD2, where the model is one constrained stage inside a six-layer pipeline, and VINly, where deterministic math sets the price the model is never allowed to pick and a second model audits the first. Treat AI as infrastructure, in the product and in the build.',
    longIntro:
      'I design AI-native products where the model is constrained, not driving. I’ve shipped two: ChatOBD2, an automotive diagnostics product where vehicle data flows through six deterministic reasoning layers before the model is invoked and prompts are assembled by priority inside a 38,000-token budget; and VINly, an AI used-car buyer report where the opening offer and walk-away floor are computed by deterministic functions before any model runs, a synthesis model writes the report grounded in NHTSA data, and a second model reads it back as a critic. In both, the design problem is translation, and the model explains rather than decides. I designed and built each product, its marketing surface, and its backend end to end. My day job: lead UX and frontend systems across MagTek’s multi-site platform.',
    tellMeAboutYourself:
      'I design AI-native products. The framing I use is that the design problem is translation, not generation. ChatOBD2 is the clearest example: the system reads vehicle data, runs it through six deterministic reasoning layers to assemble context, then invokes the model with a heavily structured prompt assembled by priority inside a 38,000-token budget, and returns a single verdict card with a constrained schema. VINly takes the same posture further: the price the buyer sees is computed by plain deterministic functions, not the model — a model that hallucinates a number is worse than no app at all — and a second model audits the first’s claims against its sources. The model is one stage inside a structured pipeline, never the system. I bring the same posture to the build that ships these products: prompts live in the system rather than scattered across components, and the model gets a structured spec, not a chat.',
    whyImAFit: [
      'Two real shipped AI-native products, not Figma concepts: ChatOBD2 and VINly.',
      'Product UX thinking for model-in-the-loop systems: constrained outputs, confidence as part of the answer, prompts as system rather than scattered components, schema-driven verdicts.',
      'Range across AI architectures: a six-layer reasoning pipeline in ChatOBD2, deterministic-math guards and a synthesis-plus-critic loop in VINly.',
      'Cross-functional reach: design, build, AI pipeline, marketing surface, backend — all owned end to end.',
    ],
    aiExplanation:
      'I treat AI as infrastructure both inside the product and in the build that ships it. Inside the product: the model is one constrained stage in a structured pipeline, prompts live in the system keyed by verdict tier and code context, outputs are schema-bound, and where money is involved (VINly) deterministic functions set the number while a second model audits the first. Inside the build: Claude and Cursor for code, Figma for precision, Claude Design when a visual frame helps. Repeatability over novelty.',
    salaryFraming:
      'AI-native product design with founder-level ownership: $200–260k base depending on scope.',
  },

  'ux-product-lead': {
    shortIntro:
      'Product/UX lead with end-to-end ownership. Founded and shipped independent iOS products (ChatOBD2, VINly). Lead UX and frontend systems across MagTek’s multi-site platform.',
    longIntro:
      'I lead UX and product across a portfolio of independent AI-native products (ChatOBD2, VINly) and a multi-site enterprise platform (MagTek). The pattern is end-to-end: design, build, ship, evolve in production. The apps are mine — I founded them, designed them, built them, and own their backends. MagTek is the long-running ASP.NET platform I lead UX and frontend systems for. Earlier at InvestCloud I contributed to or led 0-to-production portal deploys across 50+ wealth-management and banking institutions. Comfortable making the call, building the surface, and living with the consequences.',
    tellMeAboutYourself:
      'I lead UX and product work end to end. Recently I’ve been founding and shipping my own AI-native iOS products: ChatOBD2, a diagnostics app, and VINly, an AI used-car buyer report. I designed them, built them, shipped them, and own the pipelines behind them. My platform work is at MagTek, where I lead UX and frontend systems across MagTek.com, Magensa, and the network of related properties. Earlier I was at InvestCloud, where I contributed to or led 0-to-production portal deploys across 50+ institutions including Chase, Cetera, and Northwestern Mutual. The pattern across all of it: I make the call, build the surface, and live with the consequences. That’s the kind of role I’m looking for next.',
    whyImAFit: [
      'End-to-end ownership across multiple shipped AI-native products and a multi-site enterprise platform.',
      'Comfortable making and owning calls — visible decisions and named tradeoffs across the recent work.',
      'Cross-functional fluency: design, frontend systems, platform engineering, AI integration.',
    ],
    aiExplanation:
      'AI runs through how I work as production infrastructure, not a feature. Claude and Cursor for code work, Figma for precision, Claude Design when visual reasoning is faster than markup. Same posture across product, build, and platform work.',
    salaryFraming:
      'Lead-level role with founder-level ownership: $210–270k base depending on team size and equity.',
  },
};
