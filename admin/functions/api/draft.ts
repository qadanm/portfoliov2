// Cloudflare Pages Function — DeepSeek-backed draft proxy.
//
// Reads env.DEEPSEEK_API_KEY. If the key is not set, returns 503 with
// `{ disabled: true }` so the client falls back to heuristics. When the
// key is set, calls DeepSeek's chat-completions endpoint with a strict
// system prompt that forbids fabrication and the Stanford red-flag list.
//
// Security:
//   - API key never leaves the server.
//   - Body schema is allowlisted; unexpected fields are dropped.
//   - Response is scanned for unsupported claims and red-flag phrases.
//     If the scrubber rejects, the client gets back its own baseline.
//   - No logging of API key, raw key, or sensitive identifiers.

type PagesFunction<Env = unknown> = (ctx: {
  request: Request;
  env: Env;
}) => Response | Promise<Response>;

interface Env {
  DEEPSEEK_API_KEY?: string;
  // Optional model override; defaults to deepseek-chat
  DEEPSEEK_MODEL?: string;
}

type LlmTask =
  | 'cover-letter-refine'
  | 'short-answer-why-role'
  | 'short-answer-why-company'
  | 'short-answer-tell-me-about-yourself'
  | 'jd-summary'
  | 'field-question';

interface DraftRequest {
  task: LlmTask;
  baseline: string;
  jdText?: string;
  resumeContext?: string;
  packetId?: string;
  jobId?: string;
  questionText?: string;
  contextWhitelist?: string[];
}

const ALLOWED_TASKS = new Set<LlmTask>([
  'cover-letter-refine',
  'short-answer-why-role',
  'short-answer-why-company',
  'short-answer-tell-me-about-yourself',
  'jd-summary',
  'field-question',
]);

// Stanford-identified red-flag phrases + 2026 recruiter-tell list.
// Duplicated here (and in admin/src/lib/packet/authenticity.ts) on purpose:
// the server-side scrubber must not depend on shared TS modules from /admin
// because Pages Functions bundle separately.
const AI_RED_FLAG_PHRASES = [
  'delve', 'delving', 'realm', 'intricate', 'intricately',
  'showcasing', 'pivotal', 'meticulous', 'meticulously',
  'tapestry', 'multifaceted',
  'results-driven', 'results driven',
  'proven track record',
  'passionate professional',
  'dynamic professional',
  'unwavering commitment',
  'leverage', 'leveraging', 'leveraged',
  'unlock', 'unlocking', 'unlocked',
  'cutting-edge', 'cutting edge',
  'state-of-the-art',
  'next-generation',
  'seamlessly', 'seamless integration',
  'synergy', 'synergies', 'synergistic',
  'wheelhouse',
  'embark on a journey',
  'navigating the complex landscape',
  'i am thrilled to apply',
  'i am writing to express my keen interest',
  'a wealth of experience',
];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function normalizeRequest(raw: unknown): DraftRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const task = r.task;
  const baseline = r.baseline;
  if (typeof task !== 'string' || !ALLOWED_TASKS.has(task as LlmTask)) return null;
  if (typeof baseline !== 'string') return null;
  return {
    task: task as LlmTask,
    // Capped like the other free-text fields — an unbounded baseline can
    // blow the model context and the request body.
    baseline: baseline.slice(0, 16000),
    jdText: typeof r.jdText === 'string' ? r.jdText.slice(0, 16000) : undefined,
    resumeContext: typeof r.resumeContext === 'string' ? r.resumeContext.slice(0, 24000) : undefined,
    packetId: typeof r.packetId === 'string' ? r.packetId : undefined,
    jobId: typeof r.jobId === 'string' ? r.jobId : undefined,
    questionText: typeof r.questionText === 'string' ? r.questionText.slice(0, 2000) : undefined,
    contextWhitelist: Array.isArray(r.contextWhitelist) ? r.contextWhitelist.filter(s => typeof s === 'string').slice(0, 40) as string[] : undefined,
  };
}

function systemPromptFor(task: LlmTask): string {
  const base = [
    `You are drafting application copy for Moe Qadan, a Product Designer / UX Engineer.`,
    `You MUST NOT invent skills, tools, employers, projects, titles, or metrics.`,
    `You MAY only reference companies and projects from the provided RESUME_CONTEXT and CONTEXT_WHITELIST.`,
    `Voice rules: grounded, anti-buzzword, no em dashes, no fabricated tenure.`,
    `You MUST avoid these AI red-flag phrases: ${AI_RED_FLAG_PHRASES.slice(0, 12).join(', ')}, etc.`,
    `Do NOT use sentences like "I am writing to express my keen interest" or "results-driven professional".`,
    `You MUST NOT answer EEOC, work-authorization, sponsorship, salary commitment,`,
    `disability, veteran, race, ethnicity, gender, age, or any demographic question.`,
    `If asked any such question, output exactly: [HUMAN_REVIEW_REQUIRED]`,
    `Output JSON only. Schema: { "draft": "<text>", "notes": "<one-line>" }.`,
  ];
  switch (task) {
    case 'cover-letter-refine':
      base.push(`Task: refine the BASELINE cover letter for tone/flow. Keep ALL claims and facts. Do not add new projects, metrics, or skills. Length: similar to baseline. Use the company and role exactly as written.`);
      break;
    case 'short-answer-why-role':
      base.push(`Task: write a "why this role" answer in 60-90 words. Concrete, specific to the JD themes, no generic enthusiasm. Reference the role/company by name once.`);
      break;
    case 'short-answer-why-company':
      base.push(`Task: write a "why this company" answer in 60-100 words. If you don't have a concrete observation about the company, leave a [ADD ONE CONCRETE OBSERVATION] placeholder rather than inventing one.`);
      break;
    case 'short-answer-tell-me-about-yourself':
      base.push(`Task: write a "tell me about yourself" answer in 90-140 words for screen-stage use. Anchor it on the most relevant projects from RESUME_CONTEXT (the independent iOS products and MagTek) plus any matching themes from the JD. No generic openers.`);
      break;
    case 'jd-summary':
      base.push(`Task: summarize the JD in 3-4 bullet lines. Bullets only. Focus on what the role does, what stack/process is implied, what the team values, and any red flags.`);
      break;
    case 'field-question':
      base.push(`Task: draft an answer to the given form QUESTION_TEXT. If the question is legal/demographic/sensitive, output [HUMAN_REVIEW_REQUIRED]. Otherwise, 80-180 words, specific, grounded in resume context.`);
      break;
  }
  return base.join('\n');
}

function userMessageFor(req: DraftRequest): string {
  const parts: string[] = [];
  parts.push(`TASK: ${req.task}`);
  if (req.questionText) parts.push(`QUESTION_TEXT: ${req.questionText}`);
  if (req.contextWhitelist && req.contextWhitelist.length > 0) {
    parts.push(`CONTEXT_WHITELIST (allowed proper nouns beyond resume vocab): ${req.contextWhitelist.join(', ')}`);
  }
  if (req.jdText) parts.push(`JD_TEXT:\n${req.jdText}`);
  if (req.resumeContext) parts.push(`RESUME_CONTEXT:\n${req.resumeContext}`);
  parts.push(`BASELINE:\n${req.baseline}`);
  parts.push(`Return JSON only.`);
  return parts.join('\n\n');
}

function containsRedFlag(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const p of AI_RED_FLAG_PHRASES) {
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = /\s/.test(p) ? new RegExp(escaped, 'g') : new RegExp(`\\b${escaped}\\b`, 'g');
    if (pattern.test(lower)) hits.push(p);
  }
  return hits;
}

interface DeepSeekChoice {
  message?: { content?: string };
}
interface DeepSeekResponse {
  choices?: DeepSeekChoice[];
  model?: string;
  error?: { message?: string };
}

async function callDeepSeek(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<{ draft: string; model: string; raw: string } | { error: string }> {
  let res: Response;
  try {
    res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
      // Upstream timeout — a hung DeepSeek call must not hold the worker
      // (and the waiting client) open indefinitely.
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    const e = err as Error;
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      return { error: 'DeepSeek request timed out after 25s.' };
    }
    return { error: `DeepSeek fetch failed: ${e.message}` };
  }
  if (!res.ok) {
    let msg = `DeepSeek HTTP ${res.status}`;
    try {
      const body = await res.json() as DeepSeekResponse;
      if (body?.error?.message) msg = body.error.message;
    } catch { /* ignore */ }
    return { error: msg };
  }
  let body: DeepSeekResponse;
  try {
    body = await res.json() as DeepSeekResponse;
  } catch {
    return { error: 'DeepSeek returned non-JSON.' };
  }
  const content = body?.choices?.[0]?.message?.content;
  if (!content) return { error: 'DeepSeek returned empty content.' };
  let parsed: { draft?: string; notes?: string };
  try {
    parsed = JSON.parse(content);
  } catch {
    // Model violated json mode — returning the raw prose as `draft` would
    // hand unvetted output straight into packet fields. Error out so the
    // client falls back to its baseline.
    return { error: 'DeepSeek returned a non-JSON draft payload.' };
  }
  if (typeof parsed.draft !== 'string') return { error: 'DeepSeek output missing draft field.' };
  return { draft: parsed.draft, model: body.model ?? model, raw: content };
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const apiKey = ctx.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return json({
      ok: false,
      disabled: true,
      reason: 'LLM proxy is disabled. Set DEEPSEEK_API_KEY in Cloudflare Pages → Settings → Environment variables to enable.',
    }, 503);
  }

  let raw: unknown;
  try {
    raw = await ctx.request.json();
  } catch {
    return json({ ok: false, error: 'bad-json' }, 400);
  }
  const req = normalizeRequest(raw);
  if (!req) return json({ ok: false, error: 'bad-shape', message: 'Body must include task + baseline.' }, 400);

  const model = ctx.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
  const result = await callDeepSeek(apiKey, model, systemPromptFor(req.task), userMessageFor(req));
  if ('error' in result) {
    return json({ ok: false, error: 'proxy-error', message: result.error }, 502);
  }

  // Server-side authenticity scrub: reject drafts containing red-flag phrases
  const flagged = containsRedFlag(result.draft);
  if (flagged.length >= 3) {
    return json({
      ok: true,
      rejectedByScrubber: true,
      reason: `Authenticity scrubber rejected (${flagged.length} red-flag phrases: ${flagged.slice(0, 4).join(', ')}). Using baseline.`,
      modelUsed: result.model,
    });
  }

  return json({
    ok: true,
    draft: result.draft,
    notes: '',
    modelUsed: result.model,
    redFlagHits: flagged,
  });
};

// GET → simple health/status endpoint
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  return json({
    ok: true,
    configured: Boolean(ctx.env.DEEPSEEK_API_KEY),
    model: ctx.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
  });
};
