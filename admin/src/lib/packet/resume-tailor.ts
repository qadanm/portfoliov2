// Resume tailoring for a specific JD: select + reorder bullets, never rewrite.
// Inputs: angleId + JD keyword list.
// Outputs: PacketSelection (project order, bullet IDs per project, skill group order).
//
// Bullet IDs are derived from `${projectId}::${bulletIndex}` to keep them
// stable across reordering. The Project type doesn't carry a bullet id, so
// we synthesize one here.

import type { PacketSelection } from '../storage';
import { angleById, type Angle, type EmphasisKey } from '@/data/angles';
import { projects, type Project, type Bullet } from '@/data/projects';
import { skills, type Skill } from '@/data/skills';

export function bulletKey(projectId: string, bulletIndex: number): string {
  return `${projectId}::${bulletIndex}`;
}

function parseBulletKey(key: string): { projectId: string; bulletIndex: number } | null {
  const m = key.match(/^([^:]+)::(\d+)$/);
  if (!m) return null;
  return { projectId: m[1], bulletIndex: Number(m[2]) };
}

export function findBullet(projectId: string, bulletIndex: number): Bullet | null {
  const p = projects.find(x => x.id === projectId);
  if (!p) return null;
  return p.bullets[bulletIndex] ?? null;
}

export function findBulletByKey(key: string): Bullet | null {
  const parsed = parseBulletKey(key);
  if (!parsed) return null;
  return findBullet(parsed.projectId, parsed.bulletIndex);
}

function scoreBullet(b: Bullet, angle: Angle, jdLower: string): number {
  let emphasis = 0;
  for (const k of b.serves) emphasis += angle.emphasis[k as EmphasisKey] ?? 0;
  let base = emphasis * b.weight;
  // JD keyword boost
  if (jdLower) {
    const blower = b.text.toLowerCase();
    // Cheap n-gram match — count occurrences of any 4+ char word from JD
    const jdWords = jdLower.match(/\b[a-z][a-z0-9.+\-]{3,}\b/g) ?? [];
    const uniqueWords = new Set(jdWords);
    let hits = 0;
    for (const w of uniqueWords) {
      if (blower.includes(w)) hits++;
    }
    base += hits * 2;
  }
  return base;
}

function scoreSkill(s: Skill, angle: Angle, jdLower: string): number {
  let emphasis = 0;
  for (const k of s.serves) emphasis += angle.emphasis[k] ?? 0;
  let base = emphasis * s.weight;
  if (jdLower && jdLower.includes(s.name.toLowerCase())) base += 4;
  return base;
}

function priorityCap(p: Project, angleId: string): number {
  const pri = p.role_priority[angleId];
  if (pri === 'lead') return 6;
  if (pri === 'support') return 4;
  if (pri === 'mention') return 2;
  return 0;
}

function priorityRank(p: Project, angleId: string): number {
  const pri = p.role_priority[angleId];
  if (pri === 'lead') return 0;
  if (pri === 'support') return 1;
  if (pri === 'mention') return 2;
  return 99;
}

export interface TailorContext {
  angleId: string;
  jdText?: string;
}

export function tailorResume(ctx: TailorContext): PacketSelection {
  const angle = angleById(ctx.angleId);
  if (!angle) {
    return { projectIds: [], bulletIdsByProject: {}, skillGroupOrder: [] };
  }
  const jdLower = (ctx.jdText ?? '').toLowerCase();

  // Project ordering
  const includedProjects = projects
    .filter(p => p.role_priority[angle.id] !== 'omit')
    .slice()
    .sort((a, b) => priorityRank(a, angle.id) - priorityRank(b, angle.id));

  const bulletIdsByProject: Record<string, string[]> = {};
  for (const p of includedProjects) {
    const cap = priorityCap(p, angle.id);
    const ranked = p.bullets
      .map((b, idx) => ({ b, idx, score: scoreBullet(b, angle, jdLower) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, cap)
      .map(x => bulletKey(p.id, x.idx));
    bulletIdsByProject[p.id] = ranked;
  }

  // Skill group ordering
  const grouped: Record<Skill['category'], Skill[]> = {
    design: [],
    frontend: [],
    platform: [],
    ai: [],
    tools: [],
    practice: [],
  };
  for (const s of skills) grouped[s.category].push(s);

  const categoryScores: { cat: Skill['category']; total: number }[] = [];
  for (const cat of Object.keys(grouped) as Skill['category'][]) {
    const total = grouped[cat].reduce((acc, s) => acc + scoreSkill(s, angle, jdLower), 0);
    if (total > 0) categoryScores.push({ cat, total });
  }
  categoryScores.sort((a, b) => b.total - a.total);

  return {
    projectIds: includedProjects.map(p => p.id),
    bulletIdsByProject,
    skillGroupOrder: categoryScores.map(c => c.cat),
  };
}

// Serialize a selection back to plain text (for copy / preview). Bullets
// always come from the source-of-truth project data; this function never
// modifies them.
export function selectionToText(selection: PacketSelection, kicker: string, angleId: string): string {
  const angle = angleById(angleId);
  const lines: string[] = [];
  if (kicker && kicker.trim()) {
    lines.push(kicker.trim());
    lines.push('');
  }
  for (const projectId of selection.projectIds) {
    const p = projects.find(x => x.id === projectId);
    if (!p) continue;
    const bulletKeys = selection.bulletIdsByProject[projectId] ?? [];
    if (bulletKeys.length === 0) continue;
    const company = p.company ? ` · ${p.company}` : '';
    lines.push(`${p.title}${company}`);
    lines.push(`${p.role} · ${p.period}${p.location ? ' · ' + p.location : ''}`);
    for (const bk of bulletKeys) {
      const b = findBulletByKey(bk);
      if (b) lines.push(`  - ${b.text}`);
    }
    lines.push('');
  }
  if (angle) lines.push(`(Tailored for: ${angle.label})`);
  return lines.join('\n');
}
