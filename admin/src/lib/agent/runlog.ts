// Append-only log of agent events. Streamed from the extension into the
// admin via the admin-bridge content script, then persisted via the
// agentLogStore. Also feeds the live log on /auto-apply.

import { agentLogStore, type AgentEventKind, type AgentLogEntry } from '../storage';

function rid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

export interface LogInput {
  sessionId: string;
  attemptId?: string;
  kind: AgentEventKind;
  message: string;
  meta?: Record<string, unknown>;
}

export function appendLog(input: LogInput): AgentLogEntry {
  const now = Date.now();
  const entry: AgentLogEntry = {
    id: rid(),
    sessionId: input.sessionId,
    attemptId: input.attemptId,
    at: now,
    kind: input.kind,
    message: input.message,
    meta: input.meta,
    updatedAt: now,
  };
  agentLogStore.append(entry);
  // Broadcast in-page so live UIs can refresh immediately.
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('qa-agent-log', { detail: entry }));
    } catch { /* ignore */ }
  }
  return entry;
}

export function appendManyLogs(inputs: LogInput[]): void {
  const now = Date.now();
  const entries: AgentLogEntry[] = inputs.map(input => ({
    id: rid(),
    sessionId: input.sessionId,
    attemptId: input.attemptId,
    at: now,
    kind: input.kind,
    message: input.message,
    meta: input.meta,
    updatedAt: now,
  }));
  agentLogStore.appendMany(entries);
  if (typeof window !== 'undefined') {
    try {
      for (const e of entries) {
        window.dispatchEvent(new CustomEvent('qa-agent-log', { detail: e }));
      }
    } catch { /* ignore */ }
  }
}
