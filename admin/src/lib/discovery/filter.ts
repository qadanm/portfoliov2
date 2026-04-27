// Apply user preferences to a list of normalized DiscoveredJobs and return
// {kept, dropped} so the UI can show "filtered N out" without re-running.

import type { DiscoveredJob, DiscoveryPreferences } from './types';

export interface FilterResult {
  kept: DiscoveredJob[];
  dropped: { job: DiscoveredJob; reason: string }[];
}

export function applyFilters(jobs: DiscoveredJob[], prefs: DiscoveryPreferences): FilterResult {
  const kept: DiscoveredJob[] = [];
  const dropped: FilterResult['dropped'] = [];

  for (const job of jobs) {
    const reason = rejectReason(job, prefs);
    if (reason) dropped.push({ job, reason });
    else kept.push(job);
  }
  return { kept, dropped };
}

function rejectReason(job: DiscoveredJob, prefs: DiscoveryPreferences): string | null {
  // Score gate first — cheapest, catches most.
  if (job.fitScore < prefs.minScore) return `score ${job.fitScore} < ${prefs.minScore}`;

  // Remote gate — the strongest preference.
  if (prefs.remoteOnly && job.remoteStatus === 'onsite') return 'onsite-only';

  // Salary gate — only enforce when we have a number to compare. Missing
  // salary is flagged downstream, not rejected here.
  if (prefs.minSalary != null && job.salaryMax != null && job.salaryMax < prefs.minSalary) {
    return `salary $${Math.round(job.salaryMax / 1000)}k < $${Math.round(prefs.minSalary / 1000)}k`;
  }

  // Keyword exclusion — substring match on the lowercased title.
  const titleLower = job.title.toLowerCase();
  for (const kw of prefs.excludeKeywords) {
    if (kw && titleLower.includes(kw.toLowerCase())) return `excluded keyword "${kw}"`;
  }

  return null;
}
