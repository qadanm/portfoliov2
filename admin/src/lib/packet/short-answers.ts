// Short-answer generators for the standard ATS questions.
// All heuristic; LLM refinement is optional via llm.ts.
//
// Boundaries:
//   - Never auto-answer work auth, sponsorship, demographics.
//   - Salary uses job range or vault target; never invents a number.
//   - Drafts always end with a "[Edit before sending]" hint when a template
//     placeholder is unfilled.

import type { Job, ProfileVault } from '../storage';
import { angleById } from '@/data/angles';
import { analyzeJD } from '../analyzer';

export interface ShortAnswerContext {
  job: Job;
  vault: ProfileVault;
  angleId: string;
}

export interface ShortAnswerDrafts {
  whyRole: string;
  whyCompany: string;
  tellMeAboutYourself: string;
  salary: string;
}

function topJdThemes(jdText: string | undefined): string[] {
  if (!jdText || jdText.length < 80) return [];
  const a = analyzeJD(jdText);
  if (!a) return [];
  return a.matchedStrengths.slice(0, 3);
}

function angleArchetypePhrase(angleId: string): string {
  const a = angleById(angleId);
  if (!a) return 'a product designer with deep frontend literacy';
  switch (a.archetype) {
    case 'designer': return `a product designer who ships`;
    case 'engineer': return `a frontend engineer with design fluency`;
    case 'hybrid': return `a design engineer working in the seam between design and frontend`;
    case 'lead': return `a design lead with end-to-end ownership`;
  }
}

export function draftWhyRole(ctx: ShortAnswerContext): string {
  const company = (ctx.job.company ?? 'your team').trim();
  const role = (ctx.job.role ?? 'the role').trim();
  const themes = topJdThemes(ctx.job.jdText);

  // Vault template wins if user set one
  if (ctx.vault.whyThisRoleTemplate && ctx.vault.whyThisRoleTemplate.trim().length > 20) {
    return ctx.vault.whyThisRoleTemplate
      .replace(/\{role\}/g, role)
      .replace(/\{company\}/g, company)
      .replace(/\{themes\}/g, themes.length ? themes.join(', ') : 'the work described');
  }

  const archetype = angleArchetypePhrase(ctx.angleId);
  const themeLine = themes.length > 0
    ? `The themes that match my own work are ${themes.slice(0, 3).join(', ')}, which is where I've spent most of my last few years.`
    : `The shape of the work matches where I spend most of my time.`;

  return [
    `I want this ${role} role because it sits in the same place my career has been settling: ${archetype}.`,
    themeLine,
    `If a conversation makes sense, I'd welcome it.`,
  ].join(' ');
}

export function draftWhyCompany(ctx: ShortAnswerContext): string {
  const company = (ctx.job.company ?? 'your team').trim();

  // Vault template wins
  if (ctx.vault.whyThisCompanyTemplate && ctx.vault.whyThisCompanyTemplate.trim().length > 20) {
    return ctx.vault.whyThisCompanyTemplate
      .replace(/\{company\}/g, company);
  }

  // Honest template: the system can't know specific reasons without research,
  // so it leaves a [PLACEHOLDER] for the user to fill. This is a deliberate
  // anti-AI-slop choice — generic "I admire your innovative culture" prose
  // is exactly the tell recruiters reject.
  return [
    `What stands out about ${company} for me is [add one concrete observation here — a product call, a public engineering choice, a recent change, or the way the team writes].`,
    `If I'm being honest about why I'm applying: I'm looking for a place where the design and frontend craft is taken seriously and the team ships under real constraints. From what I've seen of ${company}, that fits.`,
  ].join(' ');
}

export function draftTellMeAboutYourself(ctx: ShortAnswerContext): string {
  if (ctx.vault.tellMeAboutYourself && ctx.vault.tellMeAboutYourself.trim().length > 30) {
    return ctx.vault.tellMeAboutYourself;
  }
  const archetype = angleArchetypePhrase(ctx.angleId);
  return [
    `I'm Moe — ${archetype}.`,
    `Two anchor projects right now: ChatOBD2, an AI-native diagnostics product I designed and built end to end; and MagTek's multi-site platform, where I own UX and frontend systems across the public surface.`,
    `Earlier, I built advisor portals at InvestCloud across 50+ wealth institutions.`,
    `The work I'm looking for next is the same shape: where design and frontend live in the same head, and the team ships under real constraints.`,
  ].join(' ');
}

export function draftSalary(ctx: ShortAnswerContext): string {
  const { job, vault } = ctx;
  // Prefer job's stated range if both bounds present
  if (job.salaryMin && job.salaryMax) {
    const min = Math.round(job.salaryMin / 1000);
    const max = Math.round(job.salaryMax / 1000);
    return `Open to discussing within the posted range ($${min}k–$${max}k) and aligning on final number after we discuss scope. Targeting the upper half based on background.`;
  }
  // Otherwise vault target
  if (vault.salaryMin && vault.salaryMax) {
    const min = Math.round(vault.salaryMin / 1000);
    const max = Math.round(vault.salaryMax / 1000);
    const neg = vault.salaryNegotiable ? ' (negotiable based on scope and full package)' : '';
    return `Targeting $${min}k–$${max}k base${neg}. Happy to discuss after we align on scope.`;
  }
  if (vault.salaryMin) {
    const min = Math.round(vault.salaryMin / 1000);
    return `Targeting $${min}k+ base. Happy to discuss after we align on scope.`;
  }
  return `[Research market range for ${job.role || 'this role'}${job.location ? ' in ' + job.location : ''} before responding. Don't anchor low — go in with a real number.]`;
}

export function draftShortAnswers(ctx: ShortAnswerContext): ShortAnswerDrafts {
  return {
    whyRole: draftWhyRole(ctx),
    whyCompany: draftWhyCompany(ctx),
    tellMeAboutYourself: draftTellMeAboutYourself(ctx),
    salary: draftSalary(ctx),
  };
}
