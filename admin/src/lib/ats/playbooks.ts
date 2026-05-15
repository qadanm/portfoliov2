// ATS playbook data. Static; documents how each platform behaves and what
// to expect during application. Drives the Apply Session checklist and the
// /playbooks reference page.
//
// Friction is 0–100 (higher = more painful). Estimated minutes are realistic
// per-application time for a tailored submission with all fields completed.

import type { AtsType } from '../storage';

export interface AtsPlaybook {
  ats: AtsType;
  label: string;
  friction: number;
  estimatedMinutes: number;
  // What to prepare BEFORE opening the listing
  prepare: string[];
  // Fields the extension/autofill assistant can safely fill
  safeAutofill: string[];
  // Fields that MUST be filled manually (legal, demographic, role-specific)
  mustBeManual: string[];
  // Questions you'll commonly see
  commonQuestions: string[];
  // Step-by-step workflow inside this ATS
  workflow: string[];
  // Tips / gotchas
  tips: string[];
  // Recommended strategy: "apply", "skip-if-low-fit", "require-high-quality"
  strategy: 'fast-apply' | 'tailor-required' | 'skip-if-low-fit';
}

export const PLAYBOOKS: Record<AtsType, AtsPlaybook> = {
  greenhouse: {
    ats: 'greenhouse',
    label: 'Greenhouse',
    friction: 35,
    estimatedMinutes: 6,
    prepare: [
      'Resume PDF (ATS-friendly)',
      'Cover letter (often optional, but include for tailored apps)',
      'Tailored 2–3 sentence "why this company"',
    ],
    safeAutofill: [
      'First name, last name',
      'Email, phone',
      'Location (city/state)',
      'LinkedIn URL',
      'Portfolio URL',
      'Resume upload',
    ],
    mustBeManual: [
      'Cover letter (read before submit)',
      'Custom company questions',
      'Demographic / EEOC questions (NEVER auto-answer)',
      'Work authorization yes/no',
      'Salary expectation',
    ],
    commonQuestions: [
      'Why are you interested in {Company}?',
      'How did you hear about us?',
      'Are you authorized to work in the US?',
      'Will you now or in the future require sponsorship?',
    ],
    workflow: [
      'Click "Apply for this job"',
      'Upload resume PDF (Greenhouse parses & fills first/last name + employment automatically)',
      'Verify parsed fields — Greenhouse often gets job titles wrong',
      'Paste tailored cover letter',
      'Answer "Why {Company}" with the tailored short answer',
      'Skip or carefully answer demographic questions',
      'Submit, then mark applied here',
    ],
    tips: [
      'Greenhouse parses well but you should still verify every parsed field',
      'Cover letter field is usually optional — fill it when fit is strong',
      'Some Greenhouse boards have 1-2 custom questions worth tailoring',
    ],
    strategy: 'tailor-required',
  },

  lever: {
    ats: 'lever',
    label: 'Lever',
    friction: 40,
    estimatedMinutes: 7,
    prepare: [
      'Resume PDF',
      'Cover letter',
      'Answer drafts for: why this role, why this company, salary',
    ],
    safeAutofill: [
      'Name, email, phone',
      'Location',
      'LinkedIn, portfolio, GitHub',
      'Resume upload',
    ],
    mustBeManual: [
      'Open-ended company questions (Lever uses more of these)',
      'Cover letter',
      'Work auth, sponsorship',
      'Salary expectation',
    ],
    commonQuestions: [
      'Tell us about a project you\'re proud of',
      'Why are you interested in this role at {Company}?',
      'What\'s your salary range?',
    ],
    workflow: [
      'Click "Apply for this job"',
      'Fill name + contact (Lever does NOT parse from resume reliably)',
      'Upload resume PDF',
      'Paste cover letter',
      'Answer 2–3 short essay prompts (tailor these — Lever prompts are usually substantive)',
      'Skip demographic questions or answer manually',
      'Submit',
    ],
    tips: [
      'Lever\'s open prompts are usually the most meaningful part of the application — invest here',
      'Even if you upload, Lever often asks you to re-type employment',
      'Save longer drafts in the vault\'s "reusable text" section for fast paste',
    ],
    strategy: 'tailor-required',
  },

  ashby: {
    ats: 'ashby',
    label: 'Ashby',
    friction: 20,
    estimatedMinutes: 4,
    prepare: [
      'Resume PDF',
      'Cover letter (often included)',
    ],
    safeAutofill: [
      'Name, email, phone',
      'Location',
      'LinkedIn, portfolio, GitHub',
      'Resume upload',
    ],
    mustBeManual: [
      'Cover letter',
      'Custom questions (Ashby gives them more space than Greenhouse)',
      'Demographic questions',
    ],
    commonQuestions: [
      'Why are you interested in {Company}?',
      'What\'s your favorite project from your portfolio?',
    ],
    workflow: [
      'Click "Apply"',
      'Single-page form: fill standard fields',
      'Upload resume',
      'Paste cover letter',
      'Answer 1–3 custom questions',
      'Submit',
    ],
    tips: [
      'Fastest ATS in the wild. Apply here aggressively when fit is strong.',
      'Ashby tends to be used by smaller, well-funded teams — quality matters more than volume here',
      'Single-page submit means you can\'t accidentally lose progress',
    ],
    strategy: 'fast-apply',
  },

  workday: {
    ats: 'workday',
    label: 'Workday',
    friction: 90,
    estimatedMinutes: 22,
    prepare: [
      'Resume PDF',
      'Cover letter',
      'Complete work history (last 10 years with dates, titles, locations, achievements)',
      'Education with dates, degree, GPA if asked',
      'Vault salary number',
      'Patience: this will take 20+ minutes',
    ],
    safeAutofill: [
      'Email (for account creation only)',
      'First/last name',
      'Phone',
      'LinkedIn',
    ],
    mustBeManual: [
      'Account creation (Workday requires a password)',
      'Every work history entry (Workday does NOT trust resume parsing)',
      'Education entries',
      'Custom company questions',
      'Demographic / EEOC',
      'Work auth, sponsorship',
      'Salary',
    ],
    commonQuestions: [
      'Detailed employment history with start/end dates',
      'Education with institution + degree',
      'Are you currently or formerly employed by {Company}?',
      'Have you applied to {Company} in the past 12 months?',
    ],
    workflow: [
      'Create Workday account (unique per tenant! Each Workday-hosted company has its own account)',
      'Verify email',
      'Upload resume (Workday parses but always re-enters)',
      'Fill ENTIRE work history manually — page by page',
      'Fill education manually',
      'Answer voluntary disclosures (skip the demographic ones)',
      'Custom questions',
      'Review summary page',
      'Submit',
    ],
    tips: [
      '⚠ Workday is the highest-friction ATS. Skip if fit < 60 and there are other paths.',
      'Each Workday-hosted company has its OWN account. There is no "Workday SSO" across tenants.',
      'Many Workday installs allow a profile-save action — use it. The next Workday role at the same tenant is much faster.',
      'Workday auto-saves between pages but always click "Save and Continue" explicitly.',
      'Demographic questions are voluntary and clearly labeled. Skip them.',
    ],
    strategy: 'skip-if-low-fit',
  },

  smartrecruiters: {
    ats: 'smartrecruiters',
    label: 'SmartRecruiters',
    friction: 45,
    estimatedMinutes: 8,
    prepare: [
      'Resume PDF',
      'Cover letter',
      'LinkedIn (SmartRecruiters offers a "use LinkedIn" import)',
    ],
    safeAutofill: [
      'Name, email, phone',
      'Location',
      'LinkedIn',
      'Resume upload',
    ],
    mustBeManual: [
      'Cover letter',
      'Open prompts',
      'Demographic / EEOC',
      'Salary',
    ],
    commonQuestions: [
      'Why are you interested?',
      'How did you find this role?',
    ],
    workflow: [
      'Click "I\'m interested"',
      'Optional: use LinkedIn import (review every parsed field)',
      'Upload resume',
      'Fill missing fields',
      'Paste cover letter',
      'Answer custom questions',
      'Submit',
    ],
    tips: [
      'SmartRecruiters sometimes redirects to a company-portal flow mid-submit. If that happens, save your drafts.',
      'LinkedIn import is convenient but verify the parsed work history line by line',
    ],
    strategy: 'tailor-required',
  },

  'linkedin-easy': {
    ats: 'linkedin-easy',
    label: 'LinkedIn Easy Apply',
    friction: 15,
    estimatedMinutes: 3,
    prepare: [
      'Up-to-date LinkedIn profile (this is the resume)',
      'Cover letter (some Easy Apply postings ask)',
    ],
    safeAutofill: [
      '(LinkedIn auto-fills from profile — verify before submit)',
    ],
    mustBeManual: [
      'Screening questions (work auth, years exp, etc.)',
      'Cover letter (if requested)',
      'Salary expectation (if requested)',
    ],
    commonQuestions: [
      'Years of experience with {SkillX}',
      'Work authorization yes/no',
      'Salary expectation',
      'Willing to commute to {Location}',
    ],
    workflow: [
      'Click "Easy Apply"',
      'Verify resume choice',
      'Answer 2–4 screening questions (these can be knockout — answer carefully)',
      'Optional cover letter',
      'Review',
      'Submit',
    ],
    tips: [
      '⚠ Easy Apply screening questions are often knockout filters. If you answer "0 years" for a required skill the app is auto-rejected.',
      'Some recruiters auto-reject Easy Apply because of the spray-and-pray reputation. Skip Easy Apply when company quality matters more than speed.',
      'Don\'t rely on Easy Apply for high-priority roles. Apply directly on the company site.',
    ],
    strategy: 'fast-apply',
  },

  generic: {
    ats: 'generic',
    label: 'Generic / company portal',
    friction: 60,
    estimatedMinutes: 10,
    prepare: [
      'Resume PDF',
      'Cover letter',
      'Be ready for any field shape',
    ],
    safeAutofill: [
      'Name, email, phone (where labels are clear)',
      'LinkedIn, portfolio, GitHub',
    ],
    mustBeManual: [
      'Most fields — generic portals don\'t use standard field names',
      'Cover letter',
      'Custom questions',
      'Anything legal or demographic',
    ],
    commonQuestions: [
      'Varies widely',
    ],
    workflow: [
      'Open listing',
      'Identify the form pattern',
      'Fill standard fields manually',
      'Upload resume',
      'Paste cover letter',
      'Answer custom questions',
      'Submit',
    ],
    tips: [
      'Generic forms are highly variable. Read the form carefully before filling.',
      'Watch for `mailto:` links — sometimes the "apply" path is "email careers@..."',
      'When the form is bad, take a screenshot of fields before submit in case you need to re-do',
    ],
    strategy: 'tailor-required',
  },
};

export function playbookFor(ats: AtsType): AtsPlaybook {
  return PLAYBOOKS[ats] ?? PLAYBOOKS.generic;
}
