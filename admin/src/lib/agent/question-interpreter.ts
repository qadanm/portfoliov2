// When the agent encounters an unknown form question, this helper asks the
// DeepSeek proxy to interpret it and produce a draft answer.
//
// Safety rules:
//   - Never auto-answer legal / demographic / EEOC questions; return
//     `{ needsHuman: true, reason: 'restricted' }` immediately.
//   - The agent receives the draft + a confidence-style note; the user
//     must explicitly accept the answer before it goes into the form.
//   - Heuristic fallback when the LLM proxy is disabled / errors out.

import { tryDraft } from '../packet/llm';
import type { ApplicationPacket, Job, ProfileVault } from '../storage';
import { resumeToText, buildResume } from '../engine';

const RESTRICTED_PATTERNS: RegExp[] = [
  /\b(race|ethnicity|hispanic|latin[ao])\b/i,
  /\b(gender|gender\s*identity|pronoun)\b/i,
  /\b(sexual\s*orientation)\b/i,
  /\b(disability|disabled)\b/i,
  /\b(veteran|military|service\s*member)\b/i,
  /\b(date\s*of\s*birth|dob|birth\s*date|\bage\b)\b/i,
  /\b(citizenship|national\s*origin)\b/i,
  /\b(criminal|conviction|felony|misdemeanor|background\s*check)\b/i,
  /\b(drug\s*test|substance)\b/i,
  /\b(religion|religious|marital\s*status)\b/i,
];

const WORK_AUTH_PATTERNS: RegExp[] = [
  /\b(work\s*auth(orization)?|authorized\s*to\s*work)\b/i,
  /\b(sponsorship|visa|h-1b|opt|ead)\b/i,
];

const SALARY_PATTERNS: RegExp[] = [
  /\b(salary|compensation|expected\s*pay|target\s*pay|comp\s*expectation)\b/i,
];

export interface QuestionInterpretation {
  draft: string;
  needsHuman: boolean;
  reason?: 'restricted' | 'work-auth' | 'salary' | 'unknown' | 'ok';
  llmUsed: boolean;
  rawResponseNotes?: string;
}

export async function interpretQuestion(
  questionText: string,
  packet: ApplicationPacket,
  job: Job,
  vault: ProfileVault,
  options: { useLlm: boolean } = { useLlm: true },
): Promise<QuestionInterpretation> {
  const q = (questionText || '').trim();
  if (!q) {
    return { draft: '', needsHuman: true, reason: 'unknown', llmUsed: false };
  }

  // Restricted: never auto-answer
  if (RESTRICTED_PATTERNS.some(p => p.test(q))) {
    return {
      draft: '[HUMAN_REVIEW_REQUIRED] — demographic / legal question.',
      needsHuman: true,
      reason: 'restricted',
      llmUsed: false,
    };
  }

  // Work-auth: only auto-answer if vault opted in
  if (WORK_AUTH_PATTERNS.some(p => p.test(q))) {
    if (vault.workAuthAutofillAllowed && (vault.workAuthAnswer || vault.sponsorshipAnswer)) {
      return {
        draft: vault.workAuthAnswer || vault.sponsorshipAnswer || '',
        needsHuman: false,
        reason: 'work-auth',
        llmUsed: false,
      };
    }
    return {
      draft: '[Configure work-auth in vault, or answer manually.]',
      needsHuman: true,
      reason: 'work-auth',
      llmUsed: false,
    };
  }

  // Salary: prefer packet's salary line
  if (SALARY_PATTERNS.some(p => p.test(q))) {
    return {
      draft: packet.salaryGuidance || '[Set salary range in vault.]',
      needsHuman: !packet.salaryGuidance.length,
      reason: 'salary',
      llmUsed: false,
    };
  }

  // Common questions — answer from packet
  const lower = q.toLowerCase();
  if (/why.*role|interest.*role|why.*position/.test(lower)) {
    return { draft: packet.whyRoleAnswer || '', needsHuman: false, reason: 'ok', llmUsed: false };
  }
  if (/why.*company|why.*us\b|interest.*company/.test(lower)) {
    return { draft: packet.whyCompanyAnswer || '', needsHuman: false, reason: 'ok', llmUsed: false };
  }
  if (/tell.*about.*yourself|brief.*intro|bio/.test(lower)) {
    return { draft: packet.tellMeAboutYourself || '', needsHuman: false, reason: 'ok', llmUsed: false };
  }
  if (/relevant.*experience|how.*background|qualifications/.test(lower)) {
    return { draft: packet.tellMeAboutYourself || '', needsHuman: false, reason: 'ok', llmUsed: false };
  }

  // Anything else — try DeepSeek if allowed
  if (!options.useLlm) {
    return { draft: '', needsHuman: true, reason: 'unknown', llmUsed: false };
  }

  const resume = buildResume(packet.resumeAngleId);
  const resumeCtx = resume ? resumeToText(resume) : '';
  const baseline = `[Review this question manually: "${q}"]`;
  const resp = await tryDraft({
    task: 'field-question',
    baseline,
    jdText: job.jdText,
    resumeContext: resumeCtx,
    packetId: packet.id,
    jobId: job.id,
    questionText: q,
    contextWhitelist: [job.company ?? '', job.role ?? ''].filter(Boolean),
  });
  if (resp.disabled || resp.rejectedByScrubber) {
    return {
      draft: baseline,
      needsHuman: true,
      reason: 'unknown',
      llmUsed: false,
      rawResponseNotes: resp.reason,
    };
  }
  // Server output may include [HUMAN_REVIEW_REQUIRED]
  if (/\[HUMAN_REVIEW_REQUIRED\]/.test(resp.draft)) {
    return { draft: resp.draft, needsHuman: true, reason: 'restricted', llmUsed: true };
  }
  return { draft: resp.draft, needsHuman: false, reason: 'ok', llmUsed: true };
}
