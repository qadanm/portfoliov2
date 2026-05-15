// Cover letter generator for the packet. Reuses existing letters.ts but
// adds a JD-aware kicker line (a single sentence at the top) that mentions
// the company + role without weaving JD keywords into the body.
//
// Body remains the per-angle generic template from COVER_LETTER_BODIES
// (see admin/src/lib/letters.ts) — that's a deliberate anti-AI-slop choice
// already baked into the codebase.

import { generateCoverLetter } from '../letters';
import type { Job, ProfileVault } from '../storage';

export interface CoverLetterContext {
  job: Job;
  vault: ProfileVault;
  angleId: string;
  recruiterFirstName?: string;
}

export function draftCoverLetter(ctx: CoverLetterContext): string {
  return generateCoverLetter({
    angleId: ctx.angleId,
    company: ctx.job.company ?? '',
    role: ctx.job.role ?? '',
    recruiterFirstName: ctx.recruiterFirstName,
    jobUrl: ctx.job.url,
    jdText: ctx.job.jdText,
  });
}
