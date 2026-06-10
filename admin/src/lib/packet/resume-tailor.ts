// Resume tailoring for a specific JD: select + reorder bullets, never rewrite.
// Inputs: angleId + JD keyword list.
// Outputs: PacketSelection (project order, bullet IDs per project, skill group order).
//
// Bullet IDs are derived from `${projectId}::${bulletIndex}` to keep them
// stable across reordering. The Project type doesn't carry a bullet id, so
// we synthesize one here.

import type { PacketSelection } from '../storage';
import { angleById, type Angle, type EmphasisKey } from '@/data/angles';
import { projects, projectById, type Bullet } from '@/data/projects';
import { skills, type Skill } from '@/data/skills';
import { orderedProjectsForAngle, bulletBudget } from '../engine';
import { STOPWORDS, STRENGTHS } from '../analyzer';

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

// ── JD-aware bullet boost ──────────────────────────────────────────────
// The old boost counted every 4+ char JD word found via substring match,
// +2 each, uncapped — on a long JD it (easily 40+) swamped the curated
// emphasis score (max ~65) and stopwords like "team" matched everything.
// The new boost: token-set intersection, stopwords removed, technical and
// JD-rare terms weighted up, multi-word strength phrases counted, and the
// whole boost clamped so emphasis × weight stays dominant.

// JD boilerplate that says nothing about fit, on top of analyzer STOPWORDS.
const JD_BOILERPLATE = new Set([
  'experience', 'experiences', 'team', 'teams', 'work', 'working', 'works',
  'role', 'roles', 'years', 'skills', 'skill', 'strong', 'ability',
  'candidate', 'candidates', 'responsibilities', 'responsibility',
  'requirements', 'required', 'requirement', 'qualifications', 'qualified',
  'benefits', 'including', 'include', 'includes', 'looking', 'join',
  'help', 'great', 'good', 'well', 'plus', 'bonus', 'preferred', 'must',
  'will', 'within', 'across', 'using', 'use', 'used', 'every', 'least',
]);

// Terms that signal real technical/stack fit: analyzer strengths plus the
// resume's own skill names.
const TECH_TERMS = new Set<string>([
  ...Array.from(STRENGTHS),
  ...skills.map(s => s.name.toLowerCase()),
]);

const STRENGTH_PHRASES = Array.from(STRENGTHS).filter(s => s.includes(' '));

const MAX_JD_BOOST = 8;

interface JdContext {
  counts: Map<string, number>;
  phrases: string[];
}

function buildJdContext(jdLower: string): JdContext | null {
  if (!jdLower) return null;
  const counts = new Map<string, number>();
  for (const tok of jdLower.match(/[a-z][a-z0-9.+#-]{2,}/g) ?? []) {
    if (STOPWORDS.has(tok) || JD_BOILERPLATE.has(tok)) continue;
    counts.set(tok, (counts.get(tok) ?? 0) + 1);
  }
  const phrases = STRENGTH_PHRASES.filter(p => jdLower.includes(p));
  return { counts, phrases };
}

function scoreBullet(b: Bullet, angle: Angle, jd: JdContext | null): number {
  let emphasis = 0;
  for (const k of b.serves) emphasis += angle.emphasis[k as EmphasisKey] ?? 0;
  let base = emphasis * b.weight;
  if (jd) {
    const blower = b.text.toLowerCase();
    const bulletTokens = new Set(blower.match(/[a-z][a-z0-9.+#-]{2,}/g) ?? []);
    let boost = 0;
    for (const tok of bulletTokens) {
      const inJd = jd.counts.get(tok);
      if (!inJd) continue;
      boost += 1;
      if (TECH_TERMS.has(tok)) boost += 1;
      if (inJd <= 2) boost += 1; // rare in the JD = likely load-bearing
    }
    for (const phrase of jd.phrases) {
      if (blower.includes(phrase)) boost += 2;
    }
    base += Math.min(boost, MAX_JD_BOOST);
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
  const jd = buildJdContext(jdLower);

  // Section-aware ordering shared with the engine: work first (data order),
  // then independent apps ranked per angle.
  const ordered = orderedProjectsForAngle(angle);
  const includedProjects = [...ordered.work, ...ordered.independent];

  const bulletIdsByProject: Record<string, string[]> = {};
  for (const p of includedProjects) {
    const cap = bulletBudget(p, angle.id);
    const ranked = p.bullets
      .map((b, idx) => ({ b, idx, score: scoreBullet(b, angle, jd) }))
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
// modifies them. Entries are grouped into the same two sections the resume
// renders (EXPERIENCE / INDEPENDENT PRODUCTS) — grouping happens at render
// time by project kind, so selections persisted before the sectioning
// change still render correctly.
export function selectionToText(selection: PacketSelection, kicker: string, angleId: string): string {
  const angle = angleById(angleId);
  const lines: string[] = [];
  if (kicker && kicker.trim()) {
    lines.push(kicker.trim());
    lines.push('');
  }

  const renderEntry = (projectId: string) => {
    const p = projectById(projectId);
    if (!p) return;
    const bulletKeys = selection.bulletIdsByProject[projectId] ?? [];
    if (bulletKeys.length === 0) return;
    const company = p.company ? ` · ${p.company}` : '';
    lines.push(`${p.title}${company}`);
    lines.push(`${p.role} · ${p.period}${p.location ? ' · ' + p.location : ''}`);
    for (const bk of bulletKeys) {
      const b = findBulletByKey(bk);
      if (b) lines.push(`  - ${b.text}`);
    }
    lines.push('');
  };

  const workIds = selection.projectIds.filter(id => projectById(id)?.kind === 'work');
  const independentIds = selection.projectIds.filter(id => projectById(id)?.kind === 'independent');

  if (workIds.length > 0) {
    lines.push('EXPERIENCE');
    lines.push('');
    for (const id of workIds) renderEntry(id);
  }
  if (independentIds.length > 0) {
    lines.push('INDEPENDENT PRODUCTS');
    lines.push('');
    for (const id of independentIds) renderEntry(id);
  }

  if (angle) lines.push(`(Tailored for: ${angle.label})`);
  return lines.join('\n');
}
