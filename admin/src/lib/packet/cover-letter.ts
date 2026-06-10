// Cover letter generator for the packet. Thin wrapper over letters.ts'
// generateCoverLetter, which assembles the letter from authored building
// blocks (src/data/cover-evidence.ts): a per-angle positioning line, two
// evidence lines naming real shipped work, and a JD-theme sentence built
// only from matched-strength vocabulary. The JD picks which authored
// lines run; it never injects raw JD prose — the anti-AI-slop guarantee
// is preserved.

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
