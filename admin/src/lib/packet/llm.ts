// Client-side caller for the DeepSeek proxy at /api/draft.
//
// - Falls back to the provided baseline whenever the proxy is unavailable
//   (503 disabled, network error, schema reject by server, etc.).
// - Every call appends a structured row to the LLM audit log so Moe can
//   inspect exactly what was sent and what came back.
// - The proxy is the ONLY thing that talks to DeepSeek. The key never
//   leaves the server.

import { llmAuditStore, type LlmAuditEntry, type ApplicationPacket } from '../storage';

export type LlmTask =
  | 'cover-letter-refine'
  | 'short-answer-why-role'
  | 'short-answer-why-company'
  | 'short-answer-tell-me-about-yourself'
  | 'jd-summary'
  | 'field-question';

export interface LlmDraftRequest {
  task: LlmTask;
  jdText?: string;
  resumeContext?: string;
  baseline: string;
  packetId?: string;
  jobId?: string;
  // For field-question: the literal text of the unfamiliar question
  questionText?: string;
  // Whitelist of allowed proper nouns (target company, role) for downstream
  // authenticity check
  contextWhitelist?: string[];
}

export interface LlmDraftResponse {
  draft: string;
  notes?: string;
  modelUsed?: string;
  disabled?: boolean;
  rejectedByScrubber?: boolean;
  reason?: string;
}

const ENDPOINT = '/api/draft';

function rid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function dataSentFieldsOf(req: LlmDraftRequest): string[] {
  const out: string[] = ['task', 'baseline'];
  if (req.jdText) out.push('jdText');
  if (req.resumeContext) out.push('resumeContext');
  if (req.packetId) out.push('packetId');
  if (req.jobId) out.push('jobId');
  if (req.questionText) out.push('questionText');
  if (req.contextWhitelist) out.push('contextWhitelist');
  return out;
}

export async function tryDraft(req: LlmDraftRequest): Promise<LlmDraftResponse> {
  const at = Date.now();
  const auditBase: LlmAuditEntry = {
    id: rid(),
    at,
    task: req.task,
    jobId: req.jobId,
    packetId: req.packetId,
    status: 'ok',
    dataSentFields: dataSentFieldsOf(req),
    contextChars: (req.jdText?.length ?? 0) + (req.resumeContext?.length ?? 0) + req.baseline.length,
  };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      // Hard client-side timeout — a hung proxy must not hang the packet
      // build or the agent's question flow.
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    const e = err as Error;
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    llmAuditStore.append({
      ...auditBase,
      status: 'error',
      errorMessage: timedOut ? 'LLM request timed out (20s)' : (e?.message ?? 'fetch failed'),
    });
    return {
      draft: req.baseline,
      disabled: true,
      reason: timedOut ? 'LLM request timed out (20s); using baseline.' : 'Network error; using baseline.',
    };
  }

  const ct = res.headers.get('content-type') ?? '';
  if (res.status === 503) {
    // Proxy disabled (no DEEPSEEK_API_KEY configured) — expected & safe
    let reason = 'LLM proxy disabled.';
    if (ct.includes('application/json')) {
      try {
        const body = await res.json() as { reason?: string };
        if (body?.reason) reason = body.reason;
      } catch { /* ignore */ }
    }
    llmAuditStore.append({ ...auditBase, status: 'disabled' });
    return { draft: req.baseline, disabled: true, reason };
  }
  if (!ct.includes('application/json')) {
    llmAuditStore.append({
      ...auditBase,
      status: 'error',
      errorMessage: `Non-JSON response (${res.status})`,
    });
    return { draft: req.baseline, disabled: true, reason: 'Proxy returned non-JSON; using baseline.' };
  }

  let body: any;
  try {
    body = await res.json();
  } catch {
    llmAuditStore.append({ ...auditBase, status: 'error', errorMessage: 'Bad JSON' });
    return { draft: req.baseline, disabled: true, reason: 'Bad proxy JSON; using baseline.' };
  }

  if (!res.ok || body?.ok === false) {
    llmAuditStore.append({
      ...auditBase,
      status: 'error',
      errorMessage: body?.message ?? `HTTP ${res.status}`,
    });
    return { draft: req.baseline, disabled: true, reason: body?.message ?? 'Proxy error; using baseline.' };
  }

  if (body?.rejectedByScrubber) {
    llmAuditStore.append({
      ...auditBase,
      status: 'rejected-by-scrubber',
      modelUsed: body.modelUsed,
      draftChars: req.baseline.length,
      errorMessage: 'Authenticity scrubber rejected refined draft; using baseline.',
    });
    return { draft: req.baseline, rejectedByScrubber: true, reason: 'Refined draft tripped authenticity scrubber; using baseline.', modelUsed: body.modelUsed };
  }

  // Reject obviously-bad drafts — an empty string or a refusal marker would
  // sail through `?? baseline` and overwrite a good heuristic baseline (C8).
  const draftRaw = typeof body?.draft === 'string' ? body.draft : '';
  const draftTrimmed = draftRaw.trim();
  const baselineLen = req.baseline.trim().length;
  const rejectReason =
    draftTrimmed.length === 0
      ? 'Model returned an empty draft; keeping baseline.'
      : /\[HUMAN_REVIEW_REQUIRED\]/.test(draftRaw)
        ? 'Model flagged the task for human review; keeping baseline.'
        : baselineLen > 0 && draftTrimmed.length < baselineLen * 0.3
          ? `Model draft suspiciously short (${draftTrimmed.length} chars vs baseline ${baselineLen}); keeping baseline.`
          : null;
  if (rejectReason) {
    llmAuditStore.append({
      ...auditBase,
      status: 'rejected-by-scrubber',
      modelUsed: body?.modelUsed,
      draftChars: draftTrimmed.length,
      errorMessage: rejectReason,
    });
    return { draft: req.baseline, rejectedByScrubber: true, reason: rejectReason, modelUsed: body?.modelUsed };
  }

  const draft = draftRaw;
  llmAuditStore.append({
    ...auditBase,
    status: 'ok',
    modelUsed: body?.modelUsed,
    draftChars: draft.length,
  });
  return { draft, notes: body?.notes, modelUsed: body?.modelUsed };
}

// Convenience: run multiple LLM tasks sequentially with a shared context.
// Used by the packet builder. Each task either updates the field with a
// refined draft or leaves the heuristic baseline in place.
export async function refinePacketDrafts(
  packet: ApplicationPacket,
  resumeContext: string,
  jdText: string,
  contextWhitelist: string[],
  onProgress?: (task: LlmTask, status: 'start' | 'done', resp?: LlmDraftResponse) => void,
): Promise<ApplicationPacket> {
  const tasks: Array<{ task: LlmTask; field: keyof ApplicationPacket }> = [
    { task: 'cover-letter-refine', field: 'coverLetter' },
    { task: 'short-answer-why-role', field: 'whyRoleAnswer' },
    { task: 'short-answer-why-company', field: 'whyCompanyAnswer' },
    { task: 'short-answer-tell-me-about-yourself', field: 'tellMeAboutYourself' },
    { task: 'jd-summary', field: 'jdSummary' },
  ];

  const updated = { ...packet };
  for (const { task, field } of tasks) {
    onProgress?.(task, 'start');
    const baseline = String((updated as any)[field] ?? '');
    if (!baseline) {
      onProgress?.(task, 'done');
      continue;
    }
    const resp = await tryDraft({
      task,
      baseline,
      jdText,
      resumeContext,
      packetId: packet.id,
      jobId: packet.jobId,
      contextWhitelist,
    });
    (updated as any)[field] = resp.draft;
    if (!resp.disabled && !resp.rejectedByScrubber) {
      updated.llmUsed = [...(updated.llmUsed ?? []), { task, at: Date.now() }];
    }
    onProgress?.(task, 'done', resp);
  }
  updated.updatedAt = Date.now();
  return updated;
}
