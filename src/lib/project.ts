export type ProjectCategory = 'Independent product' | 'Open source' | 'Platform work';

/** Stable CSS key for a project category. Labels may contain spaces. */
export function projectCategoryKey(category: string): 'independent' | 'open-source' | 'platform' {
  if (category === 'Open source') return 'open-source';
  if (category === 'Platform work') return 'platform';
  return 'independent';
}
