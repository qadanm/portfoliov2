// Heuristic 3-bullet JD summary. No LLM here — that's done as an
// optional refinement step in `llm.ts`. This baseline always exists.

import { analyzeJD } from '../analyzer';

export interface JdSummary {
  text: string;
  bullets: string[];
}

// Pick the first sentence longer than 30 chars that mentions a verb-ish
// pattern, as a "what the team does" proxy.
function firstSubstantiveSentence(jd: string): string | null {
  const sentences = jd.split(/(?<=[.!?])\s+/).map(s => s.trim());
  for (const s of sentences) {
    if (s.length >= 40 && s.length <= 280) {
      if (/(build|design|ship|own|lead|operate|develop|grow|drive|create|run)/i.test(s)) return s;
    }
  }
  // Fallback: longest reasonable sentence
  return sentences
    .filter(s => s.length >= 40 && s.length <= 280)
    .sort((a, b) => b.length - a.length)[0] ?? null;
}

export function summarizeJD(jdText: string | undefined, role?: string, company?: string): JdSummary {
  const jd = (jdText ?? '').trim();
  if (jd.length < 80) {
    const lines = [
      `Role: ${role ?? 'Unspecified'}${company ? ` at ${company}` : ''}`,
      'JD text was not provided or too short to summarize.',
      'Open the listing to confirm scope before applying.',
    ];
    return { text: lines.join('\n'), bullets: lines };
  }

  const analysis = analyzeJD(jd);

  const bullets: string[] = [];
  const lede = firstSubstantiveSentence(jd);
  if (lede) bullets.push(`What the role does: ${lede.replace(/\s+/g, ' ')}`);
  else bullets.push(`What the role does: see JD for scope details.`);

  if (analysis) {
    const stack = analysis.matchedStrengths.slice(0, 6);
    if (stack.length > 0) {
      bullets.push(`Stack signals: ${stack.join(', ')}`);
    }
    const top = analysis.topKeywords.slice(0, 6).map(k => k.word);
    if (top.length > 0) {
      bullets.push(`JD themes: ${top.join(', ')}`);
    }
    const flags = analysis.riskFlags.slice(0, 2);
    if (flags.length > 0) {
      bullets.push(`Watch-outs: ${flags.join(' / ')}`);
    }
    const arrangement = `Arrangement: ${analysis.remoteSignal} · seniority: ${analysis.seniorityHint}`;
    bullets.push(arrangement);
  }

  return { text: bullets.join('\n'), bullets };
}

// Extract JD-derived keywords for use across the rest of the packet
// (resume tailoring, cover-letter "matched language" hints, etc.).
export function extractJdKeywords(jdText: string | undefined): string[] {
  const jd = (jdText ?? '').trim();
  if (jd.length < 80) return [];
  const analysis = analyzeJD(jd);
  if (!analysis) return [];
  const keys = new Set<string>();
  for (const s of analysis.matchedStrengths) keys.add(s);
  for (const k of analysis.topKeywords) keys.add(k.word);
  for (const s of (Object.values(analysis.rankedAngles[0]?.matchedSignals ?? []))) keys.add(s);
  return [...keys].slice(0, 24);
}
