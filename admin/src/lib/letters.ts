// Letter / message generator. Templates that read like real writing.
// Variables: {{company}} {{role}} {{recruiterFirstName}} {{customLine}}
//
// COVER LETTER PHILOSOPHY: deterministic, evidence-named, theme-matched.
// The letter is assembled from authored building blocks in
// src/data/cover-evidence.ts: a per-angle positioning line, two concrete
// evidence lines naming real shipped work (MagTek, InvestCloud, ChatOBD2,
// VINly, CarSpotter), and either a JD-theme sentence or a craft closer.
// The JD influences WHICH authored lines are chosen and which matched
// strengths are named; it never injects raw JD prose into the letter, so
// the anti-slop guarantee holds: every sentence was written by a human and
// every claim is grounded in resume vocabulary. The LLM refine path
// remains an optional layer on top and is instructed to keep all claims.

import { recruiterPacks } from '@/data/recruiter';
import { angleById } from '@/data/angles';
import { identity } from '@/data/identity';
import { POSITIONING, EVIDENCE, CRAFT, type EvidenceLine } from '@/data/cover-evidence';
import { analyzeJD } from './analyzer';
import type { LetterKind } from './storage';

export type Tone = 'direct' | 'warm' | 'design' | 'technical' | 'senior';

export interface LetterContext {
  angleId: string;
  company: string;
  role: string;
  recruiterFirstName?: string;
  jobUrl?: string;
  customLine?: string; // accepted for API compatibility; ignored by cover letters
  jdText?: string;     // used to pick evidence lines + matched themes; never quoted verbatim
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
  technical: `I'd be glad to go deeper on any of this, whether it's the AI pipeline work, the platform-evolution work, or the design-system maintenance, at whatever depth is useful. Reach me at ${identity.email}.`,
  senior: `If a conversation makes sense, I'd welcome it. The work I want to do next is exactly the shape of what's described here. ${identity.email}.`,
};

// ── Evidence selection ────────────────────────────────────────────────
// Rank the angle's authored evidence lines (src/data/cover-evidence.ts) by
// overlap with the JD's matched strengths. Authored order breaks ties and
// is the no-JD default.

const MIN_JD_CHARS = 80;

// 'design system' / 'design systems' both live in the strengths vocabulary;
// never name both in the weave sentence.
function sameTheme(a: string, b: string): boolean {
  return a === b || a === `${b}s` || b === `${a}s`;
}

function pickEvidence(angleId: string, jdText?: string): { lines: EvidenceLine[]; matchedThemes: string[] } {
  const pool = EVIDENCE[angleId] ?? EVIDENCE['product-designer'] ?? [];
  const jd = (jdText ?? '').trim();
  if (jd.length < MIN_JD_CHARS) {
    return { lines: pool.slice(0, 2), matchedThemes: [] };
  }
  const analysis = analyzeJD(jd);
  const matched = new Set(analysis?.matchedStrengths ?? []);
  if (matched.size === 0) {
    return { lines: pool.slice(0, 2), matchedThemes: [] };
  }
  const ranked = pool
    .map((line, idx) => ({
      line,
      idx,
      overlap: line.themes.filter(t => matched.has(t)).length,
    }))
    .sort((a, b) => b.overlap - a.overlap || a.idx - b.idx)
    .slice(0, 2);
  // Present the two chosen lines in authored order so the paragraph reads
  // the way it was written.
  ranked.sort((a, b) => a.idx - b.idx);

  const matchedThemes: string[] = [];
  for (const r of ranked) {
    for (const t of r.line.themes) {
      if (!matched.has(t)) continue;
      if (matchedThemes.some(existing => sameTheme(existing, t))) continue;
      matchedThemes.push(t);
    }
  }
  return { lines: ranked.map(r => r.line), matchedThemes };
}

// ── Cover letter ──────────────────────────────────────────────────────

// Assembled, not generated. Paragraphs:
//  1. Greeting naming the role + company (recruiter name when given).
//  2. Per-angle positioning line.
//  3. Two authored evidence lines, chosen by JD-theme overlap.
//  4. A JD-theme sentence (matched-strength vocabulary only, never raw JD
//     prose) when the JD surfaced two or more themes; otherwise the
//     angle's craft line.
//  5. Closer.
//  6. Sign-off — MUST stay the final paragraph: the letter page styles the
//     first paragraph as the greeting and the last as the sign-off.
//
// Tone parameter is accepted for API compatibility with generateMessage()
// but does not vary the structure.
export function generateCoverLetter(ctx: LetterContext, _tone?: Tone): string {
  const angle = angleById(ctx.angleId);
  if (!angle) return '';

  const greetingName = ctx.recruiterFirstName?.trim() || 'there';
  const role = ctx.role?.trim() || 'role';
  const company = ctx.company?.trim() || 'your team';

  const opener =
    `Hi ${greetingName}, I'm writing about the ${role} role at ${company}.`;

  const positioning = POSITIONING[ctx.angleId] ?? POSITIONING['product-designer'];

  const { lines, matchedThemes } = pickEvidence(ctx.angleId, ctx.jdText);
  const evidence = lines.map(l => l.text).join(' ');

  const weaveOrCraft = matchedThemes.length >= 2
    ? `The posting's emphasis on ${matchedThemes[0]} and ${matchedThemes[1]} maps to where my last few years have gone.`
    : (CRAFT[ctx.angleId] ?? CRAFT['product-designer']);

  const closer =
    `If any of this is the shape of who you're looking for, I'd welcome the conversation. The fastest way to reach me is ${identity.email}.`;

  const paragraphs = [
    opener,
    positioning,
    evidence,
    weaveOrCraft,
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
