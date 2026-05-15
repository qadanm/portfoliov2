// Build the Apply Session checklist for a packet, blending generic items
// with ATS-specific friction points from the playbook.

import type { ApplicationPacket, PacketChecklistItem, AtsType } from '../storage';
import { playbookFor } from './playbooks';

function rid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

export function buildChecklist(ats: AtsType): PacketChecklistItem[] {
  const pb = playbookFor(ats);
  const items: PacketChecklistItem[] = [];

  // Universal opener
  items.push({ id: rid(), label: 'Open job listing in new tab', done: false });
  items.push({ id: rid(), label: 'Review packet warnings before applying', done: false });

  // ATS-specific workflow steps (max 4 to avoid clutter)
  for (const step of pb.workflow.slice(0, 4)) {
    items.push({ id: rid(), label: step, done: false });
  }

  // Copy targets
  items.push({ id: rid(), label: 'Copy resume text', done: false, copyTarget: 'resume' });
  items.push({ id: rid(), label: 'Copy cover letter', done: false, copyTarget: 'cover-letter' });
  items.push({ id: rid(), label: 'Copy "why role" answer', done: false, copyTarget: 'why-role' });
  items.push({ id: rid(), label: 'Copy "why company" answer', done: false, copyTarget: 'why-company' });
  items.push({ id: rid(), label: 'Copy salary line', done: false, copyTarget: 'salary' });

  // Submit
  items.push({ id: rid(), label: 'Submit application manually in the ATS', done: false });
  items.push({ id: rid(), label: 'Mark applied here', done: false });

  return items;
}

// Helper: refresh checklist (e.g., after ATS type changes) without losing
// completed state. Match by label; new labels start un-done.
export function mergeChecklist(prev: PacketChecklistItem[], next: PacketChecklistItem[]): PacketChecklistItem[] {
  const byLabel = new Map<string, PacketChecklistItem>();
  for (const p of prev) byLabel.set(p.label, p);
  return next.map(n => {
    const prior = byLabel.get(n.label);
    if (!prior) return n;
    return { ...n, done: prior.done, doneAt: prior.doneAt };
  });
}

export function isChecklistComplete(c: PacketChecklistItem[]): boolean {
  return c.length > 0 && c.every(i => i.done);
}

export function checklistProgress(c: PacketChecklistItem[]): { done: number; total: number; pct: number } {
  const total = c.length;
  const done = c.filter(i => i.done).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// Quick reference for what's in each packet, used by /today and /packet/session
export function checklistFromPacket(p: ApplicationPacket | undefined): { done: number; total: number; pct: number } {
  if (!p) return { done: 0, total: 0, pct: 0 };
  return checklistProgress(p.checklist ?? []);
}
