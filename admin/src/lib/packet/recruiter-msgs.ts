// Recruiter DM + follow-up message drafts. Mirrors existing letters.ts
// templates but pre-fills with the packet's job + vault context.

import { generateMessage } from '../letters';
import type { Job, ProfileVault } from '../storage';

export interface RecruiterMsgContext {
  job: Job;
  vault: ProfileVault;
  angleId: string;
  recruiterFirstName?: string;
}

export function draftRecruiterDm(ctx: RecruiterMsgContext): string {
  return generateMessage('recruiter-dm', {
    angleId: ctx.angleId,
    company: ctx.job.company ?? '',
    role: ctx.job.role ?? '',
    recruiterFirstName: ctx.recruiterFirstName,
    jobUrl: ctx.job.url,
  }, 'direct');
}

export function draftFollowUp(ctx: RecruiterMsgContext): string {
  return generateMessage('follow-up-applied', {
    angleId: ctx.angleId,
    company: ctx.job.company ?? '',
    role: ctx.job.role ?? '',
    recruiterFirstName: ctx.recruiterFirstName,
  }, 'direct');
}
