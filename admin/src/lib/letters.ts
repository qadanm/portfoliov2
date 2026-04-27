// Letter / message generator. Templates that read like real writing.
// Variables: {{company}} {{role}} {{recruiterFirstName}} {{customLine}}

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
  customLine?: string; // 1 sentence to weave in (e.g. role-specific hook)
  jdText?: string;     // optional JD; lets the letter pull a single specific signal
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
  technical: `I'd be glad to go deeper on any of this, whether it's the AI pipeline, the platform-evolution work, or the design-system maintenance, at whatever depth is useful. Reach me at ${identity.email}.`,
  senior: `If a conversation makes sense, I'd welcome it. The work I want to do next is exactly the shape of what's described here. ${identity.email}.`,
};

// ── JD signal extraction (best-effort, never required) ───────────────

function extractJDSignal(jd: string | undefined, company: string): string | undefined {
  if (!jd) return undefined;
  const text = jd.replace(/\s+/g, ' ').trim();
  if (text.length < 80) return undefined;

  // Look for a "what you'll do / responsibilities" block first.
  const firstSentenceWith = (re: RegExp): string | undefined => {
    const m = text.match(re);
    if (!m) return undefined;
    const idx = text.indexOf(m[0]);
    const slice = text.slice(idx + m[0].length, idx + m[0].length + 280);
    const sentence = slice.split(/(?<=[.!?])\s+/)[0]?.trim();
    return sentence && sentence.length > 25 && sentence.length < 220 ? sentence : undefined;
  };
  const what =
    firstSentenceWith(/what you('|’)ll do[:\s]+/i) ??
    firstSentenceWith(/responsibilities[:\s]+/i) ??
    firstSentenceWith(/in this role[:\s,]+/i);
  if (what) return what.replace(/\s+/g, ' ').trim();

  // Otherwise, try to find a stand-out sentence that names the company or the
  // mission ("we're building …", "our team is …").
  const mission = text.match(/\b(we(?:'|’)re building [^.]{20,180}\.|our (?:team|mission|product) [^.]{15,180}\.|building [^.]{20,160}\.)/i);
  if (mission) return mission[0].trim();

  // Fall through with a generic anchor that still references the company so
  // the line doesn't read like a copy/paste.
  const wordsLike = text.match(/\b(design system|platform|product\s+experience|AI|machine learning|developer experience|component library|tooling|frontend infrastructure)\b/i);
  if (wordsLike) return `${company}'s focus on ${wordsLike[1].toLowerCase()} is exactly the kind of work I want to be in the middle of.`;
  return undefined;
}

// ── Cover letter ──────────────────────────────────────────────────────

// Builds a 4-paragraph prose letter:
//  1. Opener that names the role and company plainly
//  2. Substance paragraph from the angle's longIntro (real recent work)
//  3. Why-this-fit prose woven from the angle's whyImAFit bullets + a JD anchor
//  4. Custom hook (if provided) and a closer in the chosen tone
export function generateCoverLetter(ctx: LetterContext, tone: Tone): string {
  const angle = angleById(ctx.angleId);
  const pack = recruiterPacks[ctx.angleId];
  if (!angle || !pack) return '';

  const greeting = ctx.recruiterFirstName ? `Hi ${ctx.recruiterFirstName},` : 'Hi there,';
  const opener = OPENERS[tone](ctx);

  // Paragraph 2 — substance: lead with longIntro (already grounded prose),
  // and tighten the role label to the angle.
  const substance = pack.longIntro;

  // Paragraph 3 — why this fit. Convert the three bullets into a flowing
  // sentence with the company name as the anchor. The bullets in
  // recruiter.ts are written terse-fragment style — we soften the seams
  // here so they read as connected thought.
  const fit = composeFit(pack.whyImAFit, ctx.company);

  // Optional JD-specific anchor sentence — keeps the letter from sounding
  // generic when a JD is available.
  const jdSignal = extractJDSignal(ctx.jdText, ctx.company);
  const jdLine = jdSignal
    ? `What stood out from the posting: ${jdSignal} That's the kind of problem the recent work has been about.`
    : undefined;

  // Paragraph 4 — custom hook (user-typed) + closer.
  const hook = ctx.customLine?.trim();
  const closer = CLOSERS[tone];
  const closing = hook
    ? `${hook} ${closer}`
    : closer;

  const paragraphs: string[] = [
    greeting,
    opener,
    substance,
    fit,
  ];
  if (jdLine) paragraphs.push(jdLine);
  paragraphs.push(closing);
  paragraphs.push(`Best,\n${identity.name}`);

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

// Compose the three terse fit-fragments into a paragraph that names the
// company and reads as connected thought without forcing fake conjunctions
// (which mangled brand names like "ChatOBD2" → "chatOBD2"). Each bullet
// becomes its own sentence; the lead clause is what makes it feel custom.
function composeFit(bullets: string[], company: string): string {
  const cleaned = bullets.slice(0, 3).map(stripLeadingLabel).map(ensureSentence);
  const sentences = cleaned.filter(Boolean);
  if (sentences.length === 0) return '';
  const lead = `On fit specifically for ${company}:`;
  return [lead, ...sentences].join(' ');
}

// "Senior-level product thinking: visible decisions, …" → "Visible decisions, …"
function stripLeadingLabel(s: string): string {
  const m = s.match(/^[^:]{6,40}:\s+(.{8,})$/);
  return m ? m[1] : s;
}

function ensureSentence(s: string): string {
  const out = s.trim();
  if (!out) return '';
  // Capitalize the very first letter only if it's a lowercase ASCII letter.
  // Don't touch brand names (ChatOBD2 stays ChatOBD2; "iOS-first" stays).
  const first = out[0];
  const rest = out.slice(1);
  const capped = first >= 'a' && first <= 'z' ? first.toUpperCase() + rest : out;
  return /[.!?]$/.test(capped) ? capped : capped + '.';
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
