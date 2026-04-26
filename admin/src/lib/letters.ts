// Letter / message generator. Pure templates. No AI calls.
// Variables: {{company}} {{role}} {{name}} {{recruiterFirstName}} {{whyFit1}} {{whyFit2}}

import { recruiterPacks } from '@/data/recruiter';
import { angleById } from '@/data/angles';
import type { LetterKind } from './storage';

export type Tone = 'direct' | 'warm' | 'design' | 'technical' | 'senior';

export interface LetterContext {
  angleId: string;
  company: string;
  role: string;
  recruiterFirstName?: string;
  jobUrl?: string;
  customLine?: string; // 1 sentence to weave in (e.g. role-specific hook)
}

// ── Tone presets ──────────────────────────────────────────────────────

const OPENERS: Record<Tone, (ctx: LetterContext) => string> = {
  direct: ({ company, role }) =>
    `Hi — I'm interested in the ${role} role at ${company}.`,
  warm: ({ company, role }) =>
    `Hi there — happy to be reaching out about the ${role} role at ${company}.`,
  design: ({ company, role }) =>
    `Hi — wanted to flag interest in the ${role} role at ${company}. Liked what I saw of the work.`,
  technical: ({ company, role }) =>
    `Hi — applying to ${role} at ${company}. Quick context on fit:`,
  senior: ({ company, role }) =>
    `Hi — reaching out about the ${role} opening at ${company}. Brief context on what I'd bring:`,
};

const CLOSERS: Record<Tone, string> = {
  direct: 'Happy to chat if useful. Resume linked above.',
  warm: 'Would love to learn more if it sounds like a fit. Thanks for taking a look.',
  design: 'Happy to walk through the work if useful — site is linked.',
  technical: 'Happy to dig into specifics on a call. Resume + portfolio linked.',
  senior: 'Open to a conversation if it makes sense. Best way to reach me is below.',
};

// ── Cover letter ──────────────────────────────────────────────────────

export function generateCoverLetter(ctx: LetterContext, tone: Tone): string {
  const angle = angleById(ctx.angleId);
  const pack = recruiterPacks[ctx.angleId];
  if (!angle || !pack) return '';

  const opener = OPENERS[tone](ctx);
  const fit = pack.whyImAFit.slice(0, 3).map(b => `• ${b}`).join('\n');
  const customLine = ctx.customLine ? `\n${ctx.customLine}\n` : '';
  const closer = CLOSERS[tone];

  return [
    opener,
    '',
    pack.shortIntro,
    '',
    'Why this might be a fit:',
    fit,
    customLine,
    closer,
    '',
    '— Moe',
  ].filter(Boolean).join('\n');
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
