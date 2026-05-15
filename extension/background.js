// Service worker — the agent's brain.
//
// Maintains per-tab attempt context and serves it to:
//   - content scripts (agent-runner asks "what should I do here?")
//   - admin-bridge (admin page asks "start this session")
//   - popup (user asks for status / controls)
//
// Hard rules:
//   - Never auto-submit without an attempt whose autonomyLevel >= 3
//   - Never act on a tab that isn't part of a known attempt
//   - All gate decisions are computed against admin-side session settings
//     read from a snapshot the admin pushes (or a fetch from the admin
//     storage origin via the admin-bridge polling pattern)
//
// State model:
//   activeAttempts: Map<tabId, { sessionId, attemptId, jobId, packetId,
//                                autonomyLevel, atsType, settings }>
//   sessionState:   { id, status, settings, vault, packets, gateContext }
//
// Persistence: state lives in chrome.storage.local under `qa_agent_state`
// so the service worker can recover after sleep.

const STORAGE_KEY = 'qa_agent_state';

// Default in-memory state
const DEFAULT_STATE = {
  activeSession: null,         // { id, status, settings, jobIdsLeft, currentAttemptId }
  activeAttempts: {},          // tabId → attempt info
  pendingLogs: [],             // batched log entries to push to admin
  vault: null,                 // mirrored vault from chrome.storage.local
  packetsByJob: {},            // jobId → packet snapshot
  attemptsById: {},            // attemptId → attempt snapshot (lightweight)
};

async function readState() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY, 'vault'], (out) => {
      const persisted = out?.[STORAGE_KEY] || {};
      resolve({
        ...DEFAULT_STATE,
        ...persisted,
        vault: out?.vault ?? null,
      });
    });
  });
}

async function writeState(state) {
  return new Promise((resolve) => {
    const { vault, ...rest } = state;
    chrome.storage.local.set({ [STORAGE_KEY]: rest }, resolve);
  });
}

function rid() {
  return (crypto.randomUUID && crypto.randomUUID()) || (Math.random().toString(36).slice(2));
}

// ── Admin notify ─────────────────────────────────────────────────────
// Send a message to any admin-bridge content scripts that are alive on
// admin tabs. They will forward to the admin page via window.postMessage.
async function notifyAdmin(payload) {
  try {
    const tabs = await chrome.tabs.query({
      url: ['http://localhost:4322/*', 'http://127.0.0.1:4322/*', 'https://admin.qadan.co/*'],
    });
    for (const t of tabs) {
      if (!t.id) continue;
      try {
        chrome.tabs.sendMessage(t.id, payload, () => { void chrome.runtime.lastError; });
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

function pushLog(state, entry) {
  state.pendingLogs.push(entry);
  if (state.pendingLogs.length > 200) state.pendingLogs = state.pendingLogs.slice(-200);
  notifyAdmin({ kind: 'agent.bridge.log', entry });
}

function attemptOf(state, tabId) {
  return state.activeAttempts[String(tabId)] || null;
}

// ── Gate evaluation ──────────────────────────────────────────────────
// Mirror of admin's gatesForSubmit. Lightweight; relies on packet snapshot.
function evaluateSubmitGate(state, attempt, packet, pageState) {
  const session = state.activeSession;
  if (!session) return { ok: false, reasons: ['No active session.'], blockReason: 'gates-failed' };
  const s = session.settings;
  if (attempt.autonomyLevel < 3) {
    return { ok: false, reasons: [`Autonomy L${attempt.autonomyLevel}`], blockReason: 'gates-failed' };
  }
  if (s.dryRun) {
    return { ok: false, reasons: ['Dry-run mode is on — agent fills + advances but will not submit.'], blockReason: 'user-paused' };
  }
  // Tier check
  const tier = ATS_TIER[attempt.atsType] || 3;
  const tierAllowed =
    (tier === 1 && s.allowAutoSubmitTier1) ||
    (tier === 2 && s.allowAutoSubmitTier2) ||
    (tier === 3 && s.allowAutoSubmitTier3);
  if (!tierAllowed) {
    return { ok: false, reasons: [`Tier ${tier} auto-submit disabled`], blockReason: 'unsupported-ats' };
  }
  if (!packet) return { ok: false, reasons: ['No packet'], blockReason: 'packet-not-ready' };
  if (packet.status === 'archived' || packet.status === 'submitted') {
    return { ok: false, reasons: [`packet status ${packet.status}`], blockReason: 'packet-not-ready' };
  }
  if (packet.scores.fit < s.fitThreshold) {
    return { ok: false, reasons: [`fit ${packet.scores.fit}<${s.fitThreshold}`], blockReason: 'low-fit' };
  }
  if (packet.scores.authenticity < s.authenticityThreshold) {
    return { ok: false, reasons: [`authenticity ${packet.scores.authenticity}<${s.authenticityThreshold}`], blockReason: 'low-authenticity' };
  }
  if (packet.scores.quality < s.qualityThreshold) {
    return { ok: false, reasons: [`quality ${packet.scores.quality}<${s.qualityThreshold}`], blockReason: 'low-fit' };
  }
  if (packet.warnings?.authenticityConcerns?.length > 0) {
    return { ok: false, reasons: ['unsupported claims'], blockReason: 'low-authenticity' };
  }
  if (s.autoSubmitDenylist?.includes(attempt.jobId)) {
    return { ok: false, reasons: ['denylisted'], blockReason: 'gates-failed' };
  }
  if (pageState?.captchaPresent) return { ok: false, reasons: ['captcha'], blockReason: 'captcha' };
  if (pageState?.loginPresent) return { ok: false, reasons: ['login'], blockReason: 'login-required' };
  if (pageState?.pageError) return { ok: false, reasons: ['page error'], blockReason: 'page-error' };
  if (pageState?.unknownRequiredFields > 0) {
    return { ok: false, reasons: [`${pageState.unknownRequiredFields} unknown required`], blockReason: 'unknown-required-field' };
  }
  if (pageState?.demographicFieldsRequired > 0) {
    return { ok: false, reasons: [`${pageState.demographicFieldsRequired} demographic required`], blockReason: 'demographic-required' };
  }
  if (pageState?.uploadFailed) return { ok: false, reasons: ['upload failed'], blockReason: 'upload-failed' };

  return { ok: true, reasons: [] };
}

const ATS_TIER = {
  ashby: 1, greenhouse: 1, lever: 1,
  smartrecruiters: 2, 'linkedin-easy': 2,
  workday: 3, generic: 3,
};

// ── Message router ───────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Async wrapper
  (async () => {
    const state = await readState();

    // Tab-side queries
    if (msg.kind === 'agent.tab.get-attempt') {
      const tabId = sender?.tab?.id;
      const a = attemptOf(state, tabId);
      if (!a) { sendResponse({ ok: false, error: 'no-attempt' }); return; }
      const packet = state.packetsByJob[a.jobId] || null;
      sendResponse({
        ok: true,
        attempt: state.attemptsById[a.attemptId] || a,
        session: state.activeSession,
        vault: state.vault,
        packet,
      });
      return;
    }

    // Runner events
    if (msg.kind === 'agent.runner.idle') {
      sendResponse({ ok: true }); return;
    }
    if (msg.kind === 'agent.runner.page-loaded') {
      const a = attemptOf(state, sender?.tab?.id);
      if (a) {
        // Friendly title — short, prefix ATS name
        const hostShort = (() => {
          try { return new URL(msg.url).hostname.replace(/^www\./, ''); } catch { return ''; }
        })();
        pushLog(state, {
          id: rid(), at: Date.now(),
          sessionId: state.activeSession?.id,
          attemptId: a.attemptId,
          kind: 'attempt-page-loaded',
          message: `Opened ${msg.ats} page on ${hostShort || msg.url}`,
          meta: { url: msg.url, ats: msg.ats },
        });
        await writeState(state);
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg.kind === 'agent.runner.fields-detected') {
      const a = attemptOf(state, sender?.tab?.id);
      if (a) {
        const c = msg.counts || {};
        const parts = [];
        if (c.high) parts.push(`${c.high} safe`);
        if (c.packet) parts.push(`${c.packet} packet`);
        if (c.medium) parts.push(`${c.medium} review`);
        if (c.never) parts.push(`${c.never} never-fill`);
        if (c.requiredUnknown) parts.push(`${c.requiredUnknown} unknown required`);
        const message = `Scanned form — ${parts.length ? parts.join(', ') : 'no fields'}`;
        pushLog(state, {
          id: rid(), at: Date.now(),
          sessionId: state.activeSession?.id,
          attemptId: a.attemptId,
          kind: 'attempt-fields-detected',
          message,
          meta: msg.counts,
        });
        await writeState(state);
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg.kind === 'agent.runner.fields-filled') {
      const a = attemptOf(state, sender?.tab?.id);
      if (a) {
        const baseMsg = `Filled ${msg.filledCount} field${msg.filledCount === 1 ? '' : 's'}`;
        const keyList = (msg.filledKeys || []).slice(0, 6).join(', ');
        const truncMsg = (msg.truncations || []).length
          ? ` · truncated ${msg.truncations.length} long field(s) to fit limit`
          : '';
        pushLog(state, {
          id: rid(), at: Date.now(),
          sessionId: state.activeSession?.id,
          attemptId: a.attemptId,
          kind: 'attempt-fields-filled',
          message: keyList ? `${baseMsg}: ${keyList}${truncMsg}` : `${baseMsg}${truncMsg}`,
          meta: { filledKeys: msg.filledKeys, reviewKeys: msg.reviewKeys, neverKeys: msg.neverKeys, truncations: msg.truncations },
        });
        // Push attempt-level field metadata back to admin so it shows in /review
        notifyAdmin({
          kind: 'agent.bridge.state-update',
          attemptUpdate: {
            id: a.attemptId,
            filledFields: msg.filledKeys,
            reviewFields: msg.reviewKeys,
            neverFields: msg.neverKeys,
            currentUrl: sender?.tab?.url,
          },
        });
        await writeState(state);
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg.kind === 'agent.runner.pause') {
      const a = attemptOf(state, sender?.tab?.id);
      if (a) {
        pushLog(state, {
          id: rid(), at: Date.now(),
          sessionId: state.activeSession?.id,
          attemptId: a.attemptId,
          kind: 'attempt-paused',
          message: `Pause: ${msg.blockReason} · ${msg.message}`,
          meta: { blockReason: msg.blockReason },
        });
        notifyAdmin({
          kind: 'agent.bridge.state-update',
          attemptUpdate: {
            id: a.attemptId,
            status: 'needs-review',
            blockReason: msg.blockReason,
            blockNote: msg.message,
            currentUrl: sender?.tab?.url,
          },
        });
        await writeState(state);
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg.kind === 'agent.runner.advance') {
      const a = attemptOf(state, sender?.tab?.id);
      if (a) {
        pushLog(state, {
          id: rid(), at: Date.now(),
          sessionId: state.activeSession?.id,
          attemptId: a.attemptId,
          kind: 'attempt-advance',
          message: `Advancing: clicked "${msg.buttonText}"`,
        });
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg.kind === 'agent.runner.request-submit-gate') {
      const a = attemptOf(state, sender?.tab?.id);
      const attempt = a ? state.attemptsById[a.attemptId] : null;
      const packet = a ? state.packetsByJob[a.jobId] : null;
      if (!attempt) { sendResponse({ ok: false, reasons: ['no attempt'], blockReason: 'gates-failed' }); return; }
      const res = evaluateSubmitGate(state, attempt, packet, msg.pageState);
      pushLog(state, {
        id: rid(), at: Date.now(),
        sessionId: state.activeSession?.id,
        attemptId: attempt.id,
        kind: res.ok ? 'attempt-submit-attempted' : 'attempt-paused',
        message: res.ok ? 'Gates passed; preparing to submit.' : `Gates rejected submit: ${res.reasons.join(', ')}`,
      });
      await writeState(state);
      sendResponse(res);
      return;
    }
    if (msg.kind === 'agent.runner.submit-attempted') {
      const a = attemptOf(state, sender?.tab?.id);
      if (a) {
        pushLog(state, {
          id: rid(), at: Date.now(),
          sessionId: state.activeSession?.id,
          attemptId: a.attemptId,
          kind: 'attempt-submit-attempted',
          message: `Clicking submit on ${msg.url}`,
        });
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg.kind === 'agent.runner.submitted' || msg.kind === 'agent.runner.submitted-detected') {
      const a = attemptOf(state, sender?.tab?.id);
      if (a) {
        pushLog(state, {
          id: rid(), at: Date.now(),
          sessionId: state.activeSession?.id,
          attemptId: a.attemptId,
          kind: 'attempt-submitted',
          message: `Submitted (${msg.url || sender?.tab?.url || 'unknown'})`,
        });
        notifyAdmin({
          kind: 'agent.bridge.state-update',
          attemptUpdate: {
            id: a.attemptId,
            status: 'submitted',
            currentUrl: sender?.tab?.url,
          },
        });
        // Clear this tab from active attempts
        delete state.activeAttempts[String(sender.tab.id)];
        await writeState(state);
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg.kind === 'agent.runner.upload') {
      const a = attemptOf(state, sender?.tab?.id);
      if (a) {
        pushLog(state, {
          id: rid(), at: Date.now(),
          sessionId: state.activeSession?.id,
          attemptId: a.attemptId,
          kind: 'attempt-fields-filled',
          message: msg.ok ? `Resume uploaded: ${msg.fileName}` : `Upload failed: ${msg.fileName}`,
          meta: { upload: msg.ok ? 'ok' : 'failed', fileName: msg.fileName },
        });
        await writeState(state);
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg.kind === 'agent.runner.questions-answered') {
      const a = attemptOf(state, sender?.tab?.id);
      if (a) {
        pushLog(state, {
          id: rid(), at: Date.now(),
          sessionId: state.activeSession?.id,
          attemptId: a.attemptId,
          kind: 'attempt-question-answered',
          message: `Answered ${msg.answered} custom question(s) via DeepSeek + scrubber`,
        });
        await writeState(state);
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg.kind === 'agent.runner.get-staged-resume') {
      // Resume file is stored in chrome.storage.session (cleared on browser close).
      try {
        const stored = await new Promise((resolve) => {
          chrome.storage.session.get(['stagedResume'], (out) => resolve(out?.stagedResume || null));
        });
        sendResponse({ ok: true, file: stored });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return;
    }
    if (msg.kind === 'agent.runner.interpret-question') {
      // Forward to admin bridge for DeepSeek interpretation.
      try {
        const adminTabs = await chrome.tabs.query({
          url: ['http://localhost:4322/*', 'http://127.0.0.1:4322/*', 'https://admin.qadan.co/*'],
        });
        if (adminTabs.length === 0) {
          sendResponse({ ok: false, interpretation: { needsHuman: true, reason: 'no-admin-tab', draft: '' } });
          return;
        }
        const adminTabId = adminTabs[0].id;
        const result = await new Promise((resolve) => {
          let resolved = false;
          const requestId = rid();
          const listener = (m, s) => {
            if (m?.kind === 'agent.bridge.question-result' && m.requestId === requestId) {
              if (!resolved) { resolved = true; resolve(m); }
              chrome.runtime.onMessage.removeListener(listener);
            }
          };
          chrome.runtime.onMessage.addListener(listener);
          chrome.tabs.sendMessage(adminTabId, {
            kind: 'agent.bridge.interpret-question',
            requestId,
            attemptId: msg.attemptId,
            questionText: msg.questionText,
          }, () => { void chrome.runtime.lastError; });
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              chrome.runtime.onMessage.removeListener(listener);
              resolve({ ok: false });
            }
          }, 9000);
        });
        if (!result || !result.ok) {
          sendResponse({ ok: false, interpretation: { needsHuman: true, reason: 'no-result', draft: '' } });
        } else {
          sendResponse({ ok: true, interpretation: result.interpretation });
        }
      } catch (e) {
        sendResponse({ ok: false, interpretation: { needsHuman: true, reason: 'exception', draft: '' } });
      }
      return;
    }
    if (msg.kind === 'agent.runner.error') {
      const a = attemptOf(state, sender?.tab?.id);
      if (a) {
        pushLog(state, {
          id: rid(), at: Date.now(),
          sessionId: state.activeSession?.id,
          attemptId: a.attemptId,
          kind: 'attempt-failed',
          message: `Runner error: ${msg.message}`,
        });
        notifyAdmin({
          kind: 'agent.bridge.state-update',
          attemptUpdate: { id: a.attemptId, status: 'failed', blockNote: msg.message },
        });
        await writeState(state);
      }
      sendResponse({ ok: true });
      return;
    }

    // Admin commands (from admin-bridge → SW)
    if (msg.kind === 'agent.session.start') {
      // Admin tab provides full session+attempts+vault snapshot via storage.
      // SW just records the active session id and reads everything else on demand.
      const adminTab = sender?.tab;
      // Pull snapshot from admin-bridge: admin-bridge will push it via a follow-up
      // message right after this ack. To keep this simple, ask the admin to also
      // dispatch a `agent.session.snapshot` with the full state.
      sendResponse({ ok: true, awaiting: 'snapshot' });
      // Request snapshot
      if (adminTab?.id) {
        chrome.tabs.sendMessage(adminTab.id, { kind: 'agent.bridge.request-snapshot', sessionId: msg.sessionId }, () => { void chrome.runtime.lastError; });
      }
      return;
    }
    if (msg.kind === 'agent.session.snapshot') {
      // The bridge pushes the latest session + attempts + vault + packets here.
      state.activeSession = msg.session || null;
      state.attemptsById = {};
      for (const a of (msg.attempts || [])) state.attemptsById[a.id] = a;
      state.packetsByJob = {};
      for (const p of (msg.packets || [])) state.packetsByJob[p.jobId] = p;
      if (msg.vault) state.vault = msg.vault;
      await writeState(state);
      sendResponse({ ok: true });
      return;
    }
    if (msg.kind === 'agent.session.pause') {
      if (state.activeSession?.id === msg.sessionId) state.activeSession.status = 'paused';
      await writeState(state);
      sendResponse({ ok: true });
      return;
    }
    if (msg.kind === 'agent.session.resume') {
      if (state.activeSession?.id === msg.sessionId) state.activeSession.status = 'running';
      await writeState(state);
      sendResponse({ ok: true });
      return;
    }
    if (msg.kind === 'agent.session.stop') {
      if (state.activeSession?.id === msg.sessionId) {
        state.activeSession.status = 'stopped';
        // Clear all active attempts
        state.activeAttempts = {};
      }
      await writeState(state);
      sendResponse({ ok: true });
      return;
    }
    if (msg.kind === 'agent.attempt.assign') {
      // Admin tells SW: "this attempt is now associated with tabId"
      if (msg.tabId && msg.attemptId && msg.jobId) {
        state.activeAttempts[String(msg.tabId)] = {
          sessionId: msg.sessionId,
          attemptId: msg.attemptId,
          jobId: msg.jobId,
          autonomyLevel: msg.autonomyLevel ?? 2,
          atsType: msg.atsType,
        };
      }
      await writeState(state);
      sendResponse({ ok: true });
      return;
    }
    if (msg.kind === 'agent.attempt.open') {
      // Admin asks SW to open the URL in a new tab and bind it to attempt.
      // This is the entry point for L2-L4 sessions — admin can't open the
      // tab itself and tell SW the tabId, so SW creates it.
      if (!msg.url || !msg.attemptId || !msg.jobId) {
        sendResponse({ ok: false, error: 'missing fields' });
        return;
      }
      try {
        const tab = await chrome.tabs.create({ url: msg.url, active: true });
        const tabId = tab?.id;
        if (!tabId) {
          sendResponse({ ok: false, error: 'no tab id' });
          return;
        }
        state.activeAttempts[String(tabId)] = {
          sessionId: msg.sessionId,
          attemptId: msg.attemptId,
          jobId: msg.jobId,
          autonomyLevel: msg.autonomyLevel ?? 2,
          atsType: msg.atsType,
        };
        // Update attempt status → running
        if (state.attemptsById[msg.attemptId]) {
          state.attemptsById[msg.attemptId].status = 'running';
          state.attemptsById[msg.attemptId].tabId = tabId;
        }
        pushLog(state, {
          id: rid(), at: Date.now(),
          sessionId: msg.sessionId,
          attemptId: msg.attemptId,
          kind: 'attempt-started',
          message: `Opened tab ${tabId} → ${msg.url}`,
        });
        notifyAdmin({
          kind: 'agent.bridge.state-update',
          attemptUpdate: { id: msg.attemptId, status: 'running', tabId, currentUrl: msg.url },
        });
        await writeState(state);

        // Unsupported-host timeout: if the content script doesn't ping
        // within 6s, the extension has no permission for this host and
        // the agent literally cannot run. Mark as unsupported.
        setTimeout(async () => {
          const fresh = await readState();
          const stillAssigned = fresh.activeAttempts[String(tabId)];
          if (!stillAssigned) return; // tab closed or replaced
          // Did the runner produce any log entry for this attempt? If not, host is unsupported.
          const sawRunner = fresh.pendingLogs.some(l =>
            l.attemptId === msg.attemptId && (l.kind === 'attempt-page-loaded' || l.kind === 'attempt-fields-detected'));
          if (sawRunner) return;
          // Still no runner activity — mark unsupported, free the tabId mapping.
          delete fresh.activeAttempts[String(tabId)];
          pushLog(fresh, {
            id: rid(), at: Date.now(),
            sessionId: msg.sessionId,
            attemptId: msg.attemptId,
            kind: 'attempt-blocked',
            message: 'Host not in extension permissions — agent can\'t inject. Mark this job manually.',
          });
          notifyAdmin({
            kind: 'agent.bridge.state-update',
            attemptUpdate: {
              id: msg.attemptId,
              status: 'unsupported',
              blockReason: 'unsupported-ats',
              blockNote: `Extension has no content-script permission on this host. Supported: Greenhouse / Lever / Ashby / Workday / SmartRecruiters / LinkedIn.`,
            },
          });
          await writeState(fresh);
        }, 6500);

        sendResponse({ ok: true, tabId });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
      return;
    }
    if (msg.kind === 'agent.attempt.retry') {
      // Admin asks to retry an attempt; reset SW-side block state if any
      // The actual retry happens when the tab loads again.
      sendResponse({ ok: true });
      return;
    }

    // External page connections (admin.qadan.co or localhost) — handled by
    // chrome.runtime.onMessageExternal below
    sendResponse({ ok: false, error: 'unknown-kind' });
  })();
  return true; // async response
});

// External messages from admin (via externally_connectable)
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  // Same shape — but origin should be one of admin hosts. The manifest
  // restricts this to known matches.
  if (msg && typeof msg === 'object') {
    chrome.runtime.sendMessage(msg, (resp) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse(resp);
      }
    });
    return true;
  }
  sendResponse({ ok: false, error: 'bad-msg' });
  return true;
});

// Recover state on install / startup
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({
      installedAt: Date.now(),
      vault: null,
    });
  }
});
