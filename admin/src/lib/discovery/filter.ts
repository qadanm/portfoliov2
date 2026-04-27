// Apply user preferences to a list of normalized DiscoveredJobs and return
// {kept, dropped} so the UI can show "filtered N out" without re-running.

import type { DiscoveredJob, DiscoveryPreferences } from './types';
import { REASONS, type Reason } from './reasons';

export interface FilterResult {
  kept: DiscoveredJob[];
  /** Each filtered job carries the reason(s) it was filtered. */
  dropped: { job: DiscoveredJob; reasons: Reason[] }[];
}

export function applyFilters(jobs: DiscoveredJob[], prefs: DiscoveryPreferences): FilterResult {
  const kept: DiscoveredJob[] = [];
  const dropped: FilterResult['dropped'] = [];

  for (const job of jobs) {
    const reasons = rejectReasons(job, prefs);
    if (reasons.length > 0) dropped.push({ job, reasons });
    else kept.push(job);
  }
  return { kept, dropped };
}

function rejectReasons(job: DiscoveredJob, prefs: DiscoveryPreferences): Reason[] {
  const reasons: Reason[] = [];

  if (job.fitScore < prefs.minScore) {
    reasons.push({ ...REASONS.SCORE_TOO_LOW, label: `Score ${job.fitScore} < ${prefs.minScore}` });
  }
  if (prefs.remoteOnly && job.remoteStatus === 'onsite') {
    reasons.push(REASONS.ONSITE_ONLY);
  }
  if (prefs.minSalary != null && job.salaryMax != null && job.salaryMax < prefs.minSalary) {
    reasons.push({
      ...REASONS.SALARY_TOO_LOW,
      label: `Salary $${Math.round(job.salaryMax / 1000)}k < $${Math.round(prefs.minSalary / 1000)}k`,
    });
  }

  const titleLower = job.title.toLowerCase();
  for (const kw of prefs.excludeKeywords) {
    if (kw && titleLower.includes(kw.toLowerCase())) {
      reasons.push({ ...REASONS.KEYWORD_EXCLUDED, label: `Excluded keyword "${kw}"` });
      break; // one keyword reason is enough
    }
  }

  if (prefs.excludeContract) {
    const haystack = `${job.title} ${job.description ?? ''}`.toLowerCase();
    if (/\b(contract(?: to hire)?|c2h|contractor|freelance|temporary)\b/.test(haystack)) {
      reasons.push(REASONS.CONTRACT_ONLY);
    }
  }
  if (prefs.excludeJunior && job.seniority === 'ic') {
    reasons.push(REASONS.JUNIOR_LEVEL);
  }

  return reasons;
}
