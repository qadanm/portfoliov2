// Letter / message generator. Templates that read like real writing.
// Variables: {{company}} {{role}} {{recruiterFirstName}} {{customLine}}
//
// COVER LETTER PHILOSOPHY (read me before "improving" the cover-letter
// path again): the only personalization is the opener — recruiter name
// (if any), role title, company name. The rest of the body is the
// per-angle generic block defined in COVER_LETTER_BODIES below. No JD
// keyword weaving, no "what stood out from the posting" reach, no
// auto-generated relevance prose. That stuff reads as AI slop and
// usually misrepresents the role anyway. Edit the per-angle bodies in
// place if you want different content; don't reintroduce dynamic
// substitution into the body.

import { recruiterPacks } from '@/data/recruiter';
import { angleById } from '@/data/angles';
import { identity } from '@/data/identity';
import type { LetterKind } from './storage';

export type Tone = 'direct' | 'warm' | 'design' | 'technical' | 'senior';

export interface LetterContext {
  angleId: string;
  company: string;
  role: string;
  recruiterFirstName?: string;
  jobUrl?: string;
  customLine?: string; // accepted for API compatibility; ignored by cover letters
  jdText?: string;     // accepted for API compatibility; ignored by cover letters
}

// ── Tone presets ──────────────────────────────────────────────────────
// Note: cover letters are scrubbed of em / en dashes downstream by
// stripDashes(). Keep new copy here free of `—` and `–` so the original
// intent is preserved without needing the post-processor to guess.

const OPENERS: Record<Tone, (ctx: LetterContext) => string> = {
  direct: ({ company, role }) =>
    `I'm writing about the ${role} role at ${company}.`,
  warm: ({ company, role }) =>
    `Thanks for the chance to share a few words about the ${role} role at ${company}.`,
  design: ({ company, role }) =>
    `I came across the ${role} opening at ${company} and wanted to flag it as something I'd want to do.`,
  technical: ({ company, role }) =>
    `I'm writing about the ${role} role at ${company}. A few notes on why the fit is real, not just résumé-keyword adjacent.`,
  senior: ({ company, role }) =>
    `I'm writing about the ${role} opening at ${company}. Brief context on what I'd bring and what I'd want to dig into.`,
};

const CLOSERS: Record<Tone, string> = {
  direct: `If any of this lines up with what the team is looking for, I'd welcome the conversation. Easiest reach: ${identity.email}.`,
  warm: `Thanks for taking a look. I'd love to talk if there's anything here worth exploring further. ${identity.email} is the fastest way to reach me.`,
  design: `Happy to walk through the work in whatever depth is useful: case studies, system diagrams, or the parts I'd actually do differently next time. ${identity.email} is the easiest way to set that up.`,
  technical: `I'd be glad to go deeper on any of this, whether it's the AI system layer, the platform-evolution work, or the design-system maintenance, at whatever depth is useful. Reach me at ${identity.email}.`,
  senior: `If a conversation makes sense, I'd welcome it. The work I want to do next is exactly the shape of what's described here. ${identity.email}.`,
};

// ── Per-angle generic cover-letter bodies ────────────────────────────
//
// One body per angle. Edit these in place to tune your voice. They are
// the ENTIRE personality of the cover letter — the only dynamic content
// is the opening paragraph (greeting + role + company) and a generic
// closer. Body text never references the company or JD.

const COVER_LETTER_BODIES: Record<string, string> = {
  'product-designer':
    `I'm a product designer with eight-plus years of experience shipping software end-to-end — from research and information architecture through visual design, prototyping, and the production front-end. The work has spanned consumer mobile, complex B2B dashboards, and AI-native product surfaces, and the through-line is the same in every case: build the version that actually ships, then keep tightening it.\n\nWhat sets me apart is that I don't hand off. I work in Figma when the surface is still being defined and in TypeScript when it's time to make it real, which collapses the loop between intent and shipped product. Engineers and PMs end up moving faster because there's a single person carrying the design decision through to the live experience.\n\nA few things I care about: tight visual hierarchy, accessible defaults, motion that earns its keep, and a willingness to delete UI rather than dress it up.`,

  'senior-product-designer':
    `I'm a senior product designer with eight-plus years of experience leading design on ambitious product surfaces — AI tools, consumer mobile, dense data UIs, and platform work. I take a feature from a fuzzy prompt to a shipped, measured experience and I do that with very little hand-holding.\n\nMost of the work I'm proud of is the kind that requires real judgment: which problem is actually worth solving, which competing priorities to honor, when to invest in a system versus shipping a one-off. I write design specs that engineers can build from and prototypes that stakeholders can poke at. When the team needs a strategist I show up that way; when it needs a craftsperson I show up that way.\n\nI work hands-on across Figma and the production codebase, which means I can advocate for design decisions in the same vocabulary the engineering org uses. That tends to be where senior design hires either earn their keep or get bottlenecked, and I've leaned toward the former.`,

  'ux-engineer':
    `I'm a UX engineer — a designer who writes production code and an engineer who actually thinks about UX. Eight-plus years across React, TypeScript, design systems, animation, and accessibility. The role I'm best at is the one that sits between design and engineering and unblocks both.\n\nIn practice that's looked like: building the design-system primitives that the rest of the front-end is composed from, prototyping interactions in real code so design reviews are productive, owning the front-end of complex flows where the design intent is fragile, and quietly fixing the long tail of accessibility regressions that nobody's tracking.\n\nI care about the things that compound: typed APIs, motion that doesn't fight the platform, performance budgets that are actually defended, and components that produce predictable visual outcomes when an arbitrary engineer reaches for them.`,

  'frontend-ux-engineer':
    `I'm a frontend engineer with deep design fluency. I ship React + TypeScript front-ends to production, but I make design decisions in code along the way — type sizes, motion curves, layout density, color contrast — instead of treating those as someone else's spec to implement.\n\nMost of my last few years have been on AI-native and data-heavy product surfaces: real-time interfaces, streaming UIs, dashboards built on top of complex backend semantics. The pattern I bring to model-in-the-loop work: prompts as a system layer rather than scattered components, schema-bound outputs, the model held as one constrained stage in a structured pipeline. I work fluently in modern React (server components, suspense, hooks), CSS that scales (custom properties, container queries, real cascade discipline), and the tooling layer (Vite, Turbo, the build pipeline of the moment).\n\nI'm easy to work with on a team because I do the unfashionable parts of front-end well: bug bashes, accessibility audits, perf regressions, the long tail of Safari weirdness.`,

  'design-engineer':
    `I'm a design engineer — I design and ship the production surface in the same loop. Eight-plus years of experience with the design + front-end stack: Figma, React, TypeScript, design systems, motion, real CSS, accessibility.\n\nMy strongest work happens on small teams where the boundary between design and engineering has to be permeable to move fast. I can take a vague problem statement to a shipped, polished experience without a relay race of artifacts and reviews. I ship the prototype, then the production code, then the system primitives the rest of the team uses to keep shipping it.\n\nAI runs through the build for me as a structured system layer rather than a feature: spec interrogation, prompt engineering, branched execution across Claude Code, Cursor, and Claude Design picked per task. The codebase stays the source of truth across all three.\n\nI care about the craft layer most product teams under-invest in: typography, spacing, motion timing, focus states, hover affordances, the keyboard model. The compounding payoff there is real, but it requires someone who can both notice and fix the issue.`,

  'web-experience-manager':
    `I'm a product designer + UX engineer with eight-plus years of experience leading the web surface end-to-end — strategy, design, the production front-end, the systems behind it, and the people doing the work. I've owned the marketing site, the product surface, and the design-system layer at the same time, and I have a strong point of view about how those should reinforce each other.\n\nI'm comfortable as the bridge between marketing, product, and engineering: translating the brand into a design system that the product team can actually use, defining a publishing model the marketing team can move fast in, and keeping the engineering org confident that the front-end is maintainable.\n\nWhat I bring to a Web Experience role specifically is the rare combination of taste, technical judgment, and the willingness to operate across surfaces that most candidates only handle one of.`,

  'design-systems-engineer':
    `I'm a designer-engineer hybrid with deep design-system experience — I've built and maintained component libraries that span marketing surfaces, product surfaces, and internal tools, and I'm comfortable as both the designer of the system and the engineer who ships it.\n\nMy approach: tokens before components, accessibility as a non-negotiable default, real coverage tests that catch regressions in the things that actually break (focus order, color contrast, screen-reader output), and documentation that engineers reach for when they're trying to ship — not after.\n\nI work across React, TypeScript, modern CSS (custom properties, container queries, cascade layers), Figma variables, and the tooling layer (Storybook, Chromatic, the build pipeline). The piece I care about most is the part most systems get wrong: the gap between the documented component and what an arbitrary engineer ships when they reach for it under deadline.`,

  'ai-product-designer':
    `I'm a product designer with deep specialization in AI-native product surfaces — chat interfaces, agent loops, generative tools, and the messy interaction model around model output that traditional product design hasn't really worked out yet. I've shipped these surfaces to production and I have strong opinions about the design patterns that actually work versus the ones that look novel in a screenshot.\n\nThe job in AI product design is mostly the unsexy work: holding the model as one constrained stage inside a structured pipeline, designing for failure modes, surfacing model uncertainty without creating anxiety, and giving the user enough control to recover when the model is wrong. Prompts live in the system rather than in components; outputs are schema-bound; analytics taxonomies stay coherent because the prompt layer is single-sourced. I do that work with requirement discovery via the model itself, prototyping in real code, and a strong bias toward shipping small and observing.\n\nI'm hands-on across Figma and the production front-end, which is more or less mandatory for AI surfaces — the interaction model can't be fully spec'd in a static design tool. Prompt engineering is part of the same hands-on practice, not a separate concern.`,

  'ux-product-lead':
    `I'm a product/UX leader with eight-plus years of experience driving design end-to-end on ambitious product surfaces. I've led design through 0-to-1 launches and the messier work of evolving an existing product without breaking what users already trust.\n\nMy style as a lead: clear bets on the shape of the next quarter's work, a tight feedback loop with the engineering org, design reviews that produce decisions instead of opinions, and a deliberate investment in the people doing the day-to-day craft. I'm equally comfortable in a strategy review, a stakeholder presentation, and a hands-on Figma file.\n\nWhere I add the most value is on small-to-mid-sized teams where the lead has to operate across product strategy, design, and front-end engineering without losing fluency in any of them. That's the shape of role I look for.`,
};

function bodyForAngle(angleId: string): string {
  return COVER_LETTER_BODIES[angleId] ?? COVER_LETTER_BODIES['product-designer'];
}

// ── Cover letter ──────────────────────────────────────────────────────

// Three-paragraph cover letter:
//  1. Greeting (Hi [recruiter or 'there'],) + opener naming role + company.
//     This is the ONLY personalized text.
//  2. Generic angle body from COVER_LETTER_BODIES — no JD weaving.
//  3. Generic closer + sign-off.
//
// Tone parameter is accepted for API compatibility with generateMessage()
// but does not vary the body — the body is a fixed per-angle template by
// design.
export function generateCoverLetter(ctx: LetterContext, _tone?: Tone): string {
  const angle = angleById(ctx.angleId);
  if (!angle) return '';

  const greetingName = ctx.recruiterFirstName?.trim() || 'there';
  const role = ctx.role?.trim() || 'role';
  const company = ctx.company?.trim() || 'your team';

  const opener =
    `Hi ${greetingName}, I'm writing to express my interest in the ${role} role at ${company}.`;

  const body = bodyForAngle(ctx.angleId);

  const closer =
    `If any of this is the shape of who you're looking for, I'd welcome the conversation. The fastest way to reach me is ${identity.email}.`;

  const paragraphs = [
    opener,
    body,
    closer,
    `Best,\n${identity.name}`,
  ];

  return stripDashes(paragraphs.join('\n\n'));
}

// The recruiter-pack source data uses em / en dashes liberally. Cover
// letters should not. Strip them and rewrite to plain punctuation that
// reads naturally. Hyphens in compound words (e.g. "design-system",
// "platform-evolution") are preserved.
function stripDashes(text: string): string {
  return text
    // " — " and " – " (with surrounding spaces) → ", "
    .replace(/\s+[—–]\s+/g, ', ')
    // ":\s*—\s*" → ": "
    .replace(/:\s*[—–]\s*/g, ': ')
    // bare em/en dash with no space → ", "
    .replace(/[—–]/g, ', ')
    // collapse the rare "., " that might appear → "."
    .replace(/,\s*\./g, '.')
    // collapse double commas
    .replace(/,\s*,/g, ',')
    // fix double-space artifacts
    .replace(/[ \t]{2,}/g, ' ');
}

// ── Recruiter / messaging templates ───────────────────────────────────

export function generateMessage(kind: LetterKind, ctx: LetterContext, tone: Tone): string {
  const pack = recruiterPacks[ctx.angleId];
  const recruiter = ctx.recruiterFirstName ?? 'there';
  const opener = OPENERS[tone](ctx);

  switch (kind) {
    case 'cover-letter':
      return generateCoverLetter(ctx, tone);

    case 'recruiter-dm':
      return [
        `Hi ${recruiter} — saw the ${ctx.role} role at ${ctx.company}.`,
        '',
        pack?.shortIntro ?? '',
        '',
        ctx.customLine ?? '',
        '',
        'If this sounds like a fit, happy to send over a tailored resume.',
        '',
        '— Moe',
      ].filter(Boolean).join('\n');

    case 'connect-note':
      // LinkedIn connection notes are capped at 200 chars.
      return `Hi ${recruiter} — I'm a ${pack?.shortIntro?.split('.')[0] ?? 'product designer / UX engineer'}. Saw your ${ctx.company} role for ${ctx.role} and would love to connect.`.slice(0, 280);

    case 'follow-up-applied':
      return [
        `Hi ${recruiter},`,
        '',
        `Quick follow-up on the ${ctx.role} application at ${ctx.company}. Wanted to make sure it landed and answer anything that would help move things forward on your end.`,
        '',
        ctx.customLine ?? '',
        '',
        'Thanks,',
        'Moe',
      ].filter(Boolean).join('\n');

    case 'follow-up-interview':
      return [
        `Hi ${recruiter},`,
        '',
        `Thanks again for the conversation about ${ctx.role}. Wanted to follow up — happy to provide anything else that would be useful (additional work, references, deeper write-ups on specific projects).`,
        '',
        ctx.customLine ?? '',
        '',
        'Best,',
        'Moe',
      ].filter(Boolean).join('\n');

    case 'thank-you':
      return [
        `Hi ${recruiter},`,
        '',
        `Thanks for the time today. Enjoyed the conversation about ${ctx.role} and the work the team is doing.`,
        '',
        ctx.customLine ?? `One thing that stood out: I left thinking about the design system question more — happy to dig deeper if useful.`,
        '',
        'Looking forward to next steps.',
        '',
        'Best,',
        'Moe',
      ].filter(Boolean).join('\n');

    case 'negotiation':
      return [
        `Hi ${recruiter},`,
        '',
        `Thanks for the offer for ${ctx.role}. I'm excited about the team and the work.`,
        '',
        `Before I sign, I'd like to discuss the comp package. Based on the scope of the role and my background${ctx.customLine ? ` (${ctx.customLine})` : ''}, I'd like to align on a base of [TARGET]. Happy to walk through how I got there.`,
        '',
        `Open to a quick call if easier than email.`,
        '',
        'Thanks,',
        'Moe',
      ].filter(Boolean).join('\n');

    case 'rejection-followup':
      return [
        `Hi ${recruiter},`,
        '',
        `Thanks for the update on ${ctx.role}, and for the time the team invested in the process. Would appreciate any specific feedback that could help on future loops — totally understand if that's not possible.`,
        '',
        `If anything similar opens up at ${ctx.company} down the line, would welcome a heads-up.`,
        '',
        'Best,',
        'Moe',
      ].filter(Boolean).join('\n');

    case 'check-in':
      return [
        `Hi ${recruiter},`,
        '',
        `Checking in on the ${ctx.role} process at ${ctx.company}. No pressure on timing — just wanted to keep the line open and see if there's anything I can clarify on my end.`,
        '',
        'Thanks,',
        'Moe',
      ].filter(Boolean).join('\n');

    default:
      return opener;
  }
}

export const LETTER_KIND_LABELS: Record<LetterKind, string> = {
  'cover-letter': 'Cover letter',
  'recruiter-dm': 'Recruiter DM',
  'connect-note': 'LinkedIn connect note (200ch)',
  'follow-up-applied': 'Follow-up after applying',
  'follow-up-interview': 'Follow-up after interview',
  'thank-you': 'Thank-you note',
  'negotiation': 'Negotiation response',
  'rejection-followup': 'After-rejection follow-up',
  'check-in': 'Check-in / nudge',
};

export const TONE_LABELS: Record<Tone, string> = {
  direct: 'Direct',
  warm: 'Warm professional',
  design: 'Design-focused',
  technical: 'Technical',
  senior: 'Senior / executive',
};
