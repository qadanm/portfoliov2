// Shared adapter contract. Each source returns RawSourceJob[]; the
// normalize step turns those into DiscoveredJob[] after enrichment.

import type { DiscoverySourceType } from '../types';

export interface RawSourceJob {
  sourceType: DiscoverySourceType;
  sourceLabel: string;
  sourceJobId?: string;
  sourceUrl: string;
  applyUrl?: string;
  title: string;
  company: string;
  location?: string;
  salaryRaw?: string;
  /** Plain-text JD or summary the analyzer can score. */
  description?: string;
  publishedAt?: number;
}
