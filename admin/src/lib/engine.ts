import { angleById, type Angle, type EmphasisKey } from '@/data/angles';
import { projects, type Project, type Bullet } from '@/data/projects';
import { skills, type Skill } from '@/data/skills';
import { headlines, summaries, kickers } from '@/data/content';
import { identity } from '@/data/identity';
import { education, type EducationEntry } from '@/data/education';

export interface ResumeProject {
  id: string;
  title: string;
  company?: string;
  role: string;
  period: string;
  location?: string;
  bullets: string[];
}

export interface ResumeSkillGroup {
  category: Skill['category'];
  label: string;
  items: string[];
}

export interface Resume {
  identity: typeof identity;
  angle: Angle;
  headline: string;
  summary: string;
  kicker: string;
  projects: ResumeProject[];
  skillGroups: ResumeSkillGroup[];
  education: EducationEntry[];
}

const CATEGORY_LABELS: Record<Skill['category'], string> = {
  design: 'Design',
  frontend: 'Frontend',
  platform: 'Platform',
  ai: 'AI workflow',
  tools: 'Tools',
  practice: 'Practice',
};

// Score a bullet for an angle: sum of emphasis weights for the keys it serves,
// multiplied by its declared weight.
function scoreBullet(bullet: Bullet, angle: Angle): number {
  let emphasisScore = 0;
  for (const key of bullet.serves) {
    emphasisScore += angle.emphasis[key as EmphasisKey] ?? 0;
  }
  return emphasisScore * bullet.weight;
}

function scoreSkill(skill: Skill, angle: Angle): number {
  let emphasisScore = 0;
  for (const key of skill.serves) {
    emphasisScore += angle.emphasis[key] ?? 0;
  }
  return emphasisScore * skill.weight;
}

function priorityCount(p: Project, angleId: string): number {
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

function selectBullets(p: Project, angle: Angle): string[] {
  const max = priorityCount(p, angle.id);
  if (max === 0) return [];
  const ranked = [...p.bullets]
    .map(b => ({ b, score: scoreBullet(b, angle) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(x => x.b.text);
  return ranked;
}

function selectProjects(angle: Angle): ResumeProject[] {
  return projects
    .filter(p => p.role_priority[angle.id] !== 'omit')
    .slice() // copy
    .sort((a, b) => priorityRank(a, angle.id) - priorityRank(b, angle.id))
    .map(p => ({
      id: p.id,
      title: p.title,
      company: p.company,
      role: p.role,
      period: p.period,
      location: p.location,
      bullets: selectBullets(p, angle),
    }));
}

function selectSkills(angle: Angle): ResumeSkillGroup[] {
  // Group by category, rank within group, take top 4–6 per group.
  const grouped: Record<Skill['category'], Skill[]> = {
    design: [],
    frontend: [],
    platform: [],
    ai: [],
    tools: [],
    practice: [],
  };
  for (const s of skills) grouped[s.category].push(s);

  const result: ResumeSkillGroup[] = [];
  for (const cat of Object.keys(grouped) as Skill['category'][]) {
    const ranked = grouped[cat]
      .map(s => ({ s, score: scoreSkill(s, angle) }))
      .sort((a, b) => b.score - a.score)
      .filter(x => x.score > 0)
      .slice(0, 6)
      .map(x => x.s.name);
    if (ranked.length > 0) {
      result.push({ category: cat, label: CATEGORY_LABELS[cat], items: ranked });
    }
  }
  // Order categories by total score for this angle so the most relevant group leads.
  result.sort((a, b) => {
    const aSc = grouped[a.category].reduce((acc, s) => acc + scoreSkill(s, angle), 0);
    const bSc = grouped[b.category].reduce((acc, s) => acc + scoreSkill(s, angle), 0);
    return bSc - aSc;
  });
  return result;
}

export function buildResume(angleId: string): Resume | null {
  const angle = angleById(angleId);
  if (!angle) return null;
  return {
    identity,
    angle,
    headline: headlines[angleId] ?? '',
    summary: summaries[angleId] ?? '',
    kicker: kickers[angleId] ?? '',
    projects: selectProjects(angle),
    skillGroups: selectSkills(angle),
    education,
  };
}

// Plain-text serializer. Used by /resume/[angle]?mode=text.
export function resumeToText(r: Resume): string {
  const out: string[] = [];
  const sep = '\n' + '-'.repeat(60) + '\n';

  out.push(r.identity.fullName.toUpperCase());
  out.push(r.angle.label);
  out.push(`${r.identity.location} · ${r.identity.email}`);
  out.push(`${r.identity.site} · ${r.identity.linkedin} · ${r.identity.github}`);
  out.push(sep);
  out.push('SUMMARY');
  out.push(r.summary);
  out.push(sep);
  out.push('EXPERIENCE');

  for (const p of r.projects) {
    out.push('');
    const company = p.company ? ` · ${p.company}` : '';
    out.push(`${p.title}${company}`);
    out.push(`${p.role} · ${p.period}${p.location ? ' · ' + p.location : ''}`);
    for (const b of p.bullets) out.push(`  - ${b}`);
  }

  out.push(sep);
  out.push('SKILLS');
  for (const g of r.skillGroups) {
    out.push(`${g.label}: ${g.items.join(', ')}`);
  }

  if (r.education.length > 0) {
    out.push(sep);
    out.push('EDUCATION');
    for (const e of r.education) {
      out.push('');
      const inst = e.type ? `${e.institution} · ${e.type}` : e.institution;
      out.push(inst);
      out.push(e.degree);
      const meta = e.location ? `${e.period} · ${e.location}` : e.period;
      out.push(meta);
    }
  }

  return out.join('\n');
}
