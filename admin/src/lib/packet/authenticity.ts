// Authenticity scrubber. Two checks:
//   1. AI red-flag phrases (Stanford research + 2026 recruiter-tell lists)
//   2. Claims that don't appear anywhere in Moe's resume data
//
// The job here is NOT to censor — it's to surface what a recruiter is likely
// to flag. The UI shows what tripped each check; the user decides whether to
// edit, override, or ignore.

import { projects } from '@/data/projects';
import { skills } from '@/data/skills';
import { education } from '@/data/education';
import { identity } from '@/data/identity';

// Lowercase, word-boundary matched. Add aggressively from real recruiter
// feedback; remove only when it produces too many false positives.
export const AI_RED_FLAG_PHRASES: string[] = [
  // Stanford-identified high-signal tells
  'delve', 'delving', 'realm', 'intricate', 'intricately',
  'showcasing', 'pivotal', 'meticulous', 'meticulously',
  'tapestry', 'multifaceted',

  // Generic AI cover-letter prose
  'results-driven', 'results driven',
  'proven track record',
  'passionate professional',
  'dynamic professional',
  'unwavering commitment',
  'spearheaded numerous initiatives',
  'leverage', 'leveraging', 'leveraged',
  'utilize', 'utilizing', 'utilized',
  'unlock', 'unlocking', 'unlocked',
  'cutting-edge', 'cutting edge',
  'state-of-the-art',
  'next-generation', 'next generation',
  'seamlessly', 'seamless integration',
  'synergy', 'synergies', 'synergistic',
  'wheelhouse',
  'circle back',
  'move the needle',
  'boots on the ground',
  'at the end of the day',
  'embark on a journey',
  'embarking on',
  'navigating the complex landscape',
  'in today\'s fast-paced', 'in todays fast paced',
  'i am writing to express my keen interest',
  'i am thrilled to apply',
  'i am excited to apply for',
  'i am writing to express my interest in the opportunity',
  'a unique opportunity to contribute',
  'a perfect fit for this role',
  'i possess a strong',
  'i bring a wealth of',
  'a wealth of experience',
  'extensive experience in',
  'highly motivated individual',
  'detail-oriented professional',
  'team player with',

  // AI-ism punctuation / structural tells
  'in conclusion',
  'overall,',
  'furthermore,',
  'moreover,',
];

export interface RedFlagHit {
  phrase: string;
  count: number;
}

export function scanForAITells(text: string): RedFlagHit[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const hits: RedFlagHit[] = [];
  for (const phrase of AI_RED_FLAG_PHRASES) {
    // Match whole phrase. For single-word entries also require word-boundary.
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = /\s/.test(phrase)
      ? new RegExp(escaped, 'g')
      : new RegExp(`\\b${escaped}\\b`, 'g');
    const matches = lower.match(pattern);
    if (matches && matches.length > 0) {
      hits.push({ phrase, count: matches.length });
    }
  }
  return hits;
}

// Build a lowercase term-set from Moe's resume data. Anything not in here
// that looks like a proper noun or tech term in generated copy gets flagged.
let _resumeVocabCache: Set<string> | null = null;
let _resumeAllowedProperCache: Set<string> | null = null;

function buildResumeVocab(): Set<string> {
  if (_resumeVocabCache) return _resumeVocabCache;
  const set = new Set<string>();
  const push = (s: string | undefined) => {
    if (!s) return;
    // Normalize: lowercase, split on non-word, drop short stopwords
    const tokens = s.toLowerCase().split(/[^a-z0-9.+#\-]+/);
    for (const t of tokens) {
      if (t.length >= 2) set.add(t);
    }
  };

  push(identity.name);
  push(identity.location);

  for (const p of projects) {
    push(p.title);
    push(p.company);
    push(p.role);
    push(p.location);
    for (const b of p.bullets) push(b.text);
  }

  for (const s of skills) push(s.name);
  for (const e of education) {
    push(e.institution);
    push(e.degree);
    push(e.location);
  }

  // Common app words that aren't strictly in resume but should pass
  const passthroughs = [
    'role', 'company', 'team', 'product', 'design', 'engineer', 'engineering',
    'designer', 'designs', 'designed', 'building', 'built', 'building',
    'shipping', 'shipped', 'work', 'worked', 'experience', 'system', 'systems',
    'years', 'year', 'time', 'work', 'love', 'enjoy', 'comfortable',
    'qadan', 'moe', 'angeles', 'los',
  ];
  for (const w of passthroughs) set.add(w);

  _resumeVocabCache = set;
  return set;
}

function buildAllowedProperNouns(): Set<string> {
  if (_resumeAllowedProperCache) return _resumeAllowedProperCache;
  const set = new Set<string>();
  const pushNoun = (s: string | undefined) => {
    if (!s) return;
    // Find capitalized-word sequences (e.g., "InvestCloud", "MagTek", "ChatOBD2")
    for (const m of s.matchAll(/\b([A-Z][a-zA-Z0-9.+#\-]{1,}|[A-Z]{2,}[a-zA-Z0-9.+#\-]*)\b/g)) {
      set.add(m[1].toLowerCase());
    }
  };
  pushNoun(identity.name);
  for (const p of projects) {
    pushNoun(p.title);
    pushNoun(p.company);
    pushNoun(p.role);
    pushNoun(p.location);
    for (const b of p.bullets) pushNoun(b.text);
  }
  for (const s of skills) pushNoun(s.name);
  for (const e of education) {
    pushNoun(e.institution);
    pushNoun(e.degree);
    pushNoun(e.location);
  }
  // Common allowed nouns
  ['English', 'Spanish', 'United', 'States', 'America', 'US', 'USA', 'I', 'My', 'Mr', 'Mrs', 'Ms']
    .forEach(w => set.add(w.toLowerCase()));
  _resumeAllowedProperCache = set;
  return set;
}

// Scan generated text for proper nouns / tech terms that don't appear in
// Moe's resume vocab. Excludes anything in the optional `contextWhitelist`
// (e.g., the target company and role from the JD, which are not in the
// resume but are obviously legitimate to reference).
// Common English words that get capitalized at sentence start. A token
// matching this list, even if capitalized, is almost never a real proper
// noun and should not be flagged as an unsupported claim.
const SENTENCE_STARTERS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'when', 'while', 'because',
  'i', 'we', 'they', 'he', 'she', 'it', 'my', 'our', 'their', 'this', 'that',
  'these', 'those', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'hi', 'hello', 'dear', 'sincerely', 'best', 'regards', 'cheers', 'thanks',
  'thank', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with', 'as', 'from',
  'after', 'before', 'since', 'until', 'though', 'although', 'most', 'some',
  'each', 'every', 'all', 'any', 'few', 'more', 'less', 'such', 'so', 'than',
  'too', 'very', 'just', 'about', 'where', 'why', 'how', 'what',
  'engineers', 'designers', 'companies', 'products', 'teams', 'roles', 'jobs',
  'years', 'people', 'work', 'place', 'time', 'today',
  'comfortable', 'earlier', 'currently', 'previously', 'right', 'now',
  'happy', 'open', 'looking', 'targeting', 'drawing', 'designed', 'built',
  // Generic business / tech abbreviations that are not "claims about a
  // specific tool". These appear naturally in cover letters describing
  // categories of work.
  'b2b', 'b2c', 'saas', 'paas', 'ui', 'ux', 'cms', 'crm', 'erp', 'mvp',
  'cli', 'gui', 'api', 'sdk', 'rest', 'graphql', 'http', 'https', 'json',
  'oss', 'pr', 'kpi', 'okr', 'roi', 'p0', 'p1', 'p2', 'p3', 'p&l', 'h1', 'h2',
  'q1', 'q2', 'q3', 'q4', 'oot', 'wip', 'mvp', 'poc',
]);

// A token "looks like" a tech/company name (rather than a plain English
// word that happens to be capitalized) if it matches any of:
//   - has 3+ consecutive uppercase letters (e.g., "AWS", "OAuth")
//   - has internal CamelCase / digits / dots / dashes (e.g., "InvestCloud",
//     "K8s", "Next.js", "TypeScript", "MagTek")
//   - is a known tech-acronym shape
function looksLikeProperNoun(token: string): boolean {
  if (!token) return false;
  // 3+ uppercase letters in a row
  if (/[A-Z]{3,}/.test(token)) return true;
  // Mixed case (upper after first char) — CamelCase
  if (token.length >= 4 && /[A-Z][a-z]+[A-Z]/.test(token)) return true;
  // Digit present (rare in regular words)
  if (/\d/.test(token)) return true;
  // Contains a dot or plus or # — looks like a tool name
  if (/[.+#]/.test(token)) return true;
  return false;
}

// Tokenize a phrase and check if every "suspicious" token is either in
// `allowed`, in the whitelist, or is a common sentence-starter / stopword.
// `atSentenceStart` tells whether the phrase appears at the beginning of a
// sentence — if so, single-capital tokens are treated more leniently
// (could be regular sentence-start words). Mid-sentence single-capital
// tokens (like "I built Kubernetes pipelines") are still flagged.
function phraseTokensAcceptable(
  phrase: string,
  allowed: Set<string>,
  whitelist: Set<string>,
  atSentenceStart: boolean,
): boolean {
  // Split on whitespace + sentence punctuation only. Keep `.` inside tokens
  // so "Next.js", "Node.js", "ASP.NET" stay intact.
  const rawTokens = phrase.split(/[\s,;:!?]+/).filter(Boolean);
  if (rawTokens.length === 0) return true;
  if (whitelist.has(phrase.toLowerCase())) return true;
  let tokenIndex = 0;
  for (const raw of rawTokens) {
    // Strip trailing `.` (end-of-sentence period); keep internal dots
    const cleanRaw = raw.replace(/\.+$/, '');
    const t = cleanRaw.toLowerCase();
    const isFirstToken = tokenIndex === 0;
    tokenIndex++;
    if (allowed.has(t)) continue;
    if (whitelist.has(t)) continue;
    if (SENTENCE_STARTERS.has(t)) continue;
    if ([...whitelist].some(w => w.split(/\s+/).includes(t))) continue;
    // Conservative at sentence-start: skip English-shape tokens.
    if (isFirstToken && atSentenceStart && !looksLikeProperNoun(cleanRaw)) continue;
    // Mid-sentence single-capital English-shape token — likely an
    // unintended capitalization or stylistic emphasis. Skip rather than
    // create false positives.
    if (!looksLikeProperNoun(cleanRaw)) continue;
    return false;
  }
  return true;
}

// Determine whether a match at `index` in `text` sits at the start of a
// sentence (preceded by sentence-ending punctuation + whitespace, or
// beginning of text).
function isSentenceStart(text: string, index: number): boolean {
  if (index <= 0) return true;
  // Walk back through whitespace
  let i = index - 1;
  while (i >= 0 && /\s/.test(text[i])) i--;
  if (i < 0) return true;
  const ch = text[i];
  return ch === '.' || ch === '!' || ch === '?' || ch === '\n';
}

export function verifyClaimsAgainstResume(
  text: string,
  contextWhitelist: string[] = [],
): string[] {
  if (!text) return [];
  const allowed = buildAllowedProperNouns();
  const whitelist = new Set<string>(contextWhitelist.map(c => c.toLowerCase()).filter(Boolean));

  const concerns = new Set<string>();
  // Match capital-led tokens. Allow internal `.` only when followed by a
  // letter (so "Next.js" stays one token but "Acme Co." stops at "Co").
  const matchRe = /\b([A-Z](?:[a-zA-Z0-9+#\-]|\.[a-zA-Z])*(?:\s+[A-Z](?:[a-zA-Z0-9+#\-]|\.[a-zA-Z])*){0,3})\b/g;
  for (const m of text.matchAll(matchRe)) {
    const phrase = m[1];
    const cleaned = phrase.replace(/[.,;:!?]+$/, '');
    if (!cleaned.includes(' ') && cleaned.length < 3) continue;
    const sentenceStart = isSentenceStart(text, m.index ?? 0);
    if (phraseTokensAcceptable(cleaned, allowed, whitelist, sentenceStart)) continue;
    concerns.add(cleaned);
  }
  return [...concerns].slice(0, 12);
}

// Convenience scorer: 0–100. Lower = more red flags.
export function authenticityScore(text: string, contextWhitelist: string[] = []): {
  score: number;
  redFlags: string[];
  authenticityConcerns: string[];
} {
  const hits = scanForAITells(text);
  const concerns = verifyClaimsAgainstResume(text, contextWhitelist);
  const redFlagsList = hits.map(h => h.count > 1 ? `${h.phrase} (×${h.count})` : h.phrase);
  // 15 pts per red-flag occurrence, 25 pts per unsupported claim.
  let score = 100;
  for (const h of hits) score -= 15 * h.count;
  score -= 25 * concerns.length;
  if (score < 0) score = 0;
  return {
    score,
    redFlags: redFlagsList,
    authenticityConcerns: concerns,
  };
}
