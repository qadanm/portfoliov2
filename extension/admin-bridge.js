// Admin-bridge content script. Runs ONLY on admin pages
// (localhost:4322 / admin.qadan.co) and brokers messages between the
// admin's window context and the extension's service worker.
//
// Protocol:
//   Admin → Extension:  window.postMessage({ source: 'qa-admin', kind, ... })
//   Extension → Admin:  window.postMessage({ source: 'qa-ext', kind, ... })
//
// Bridge contract:
//   - `ping` → returns `pong` immediately (so the admin can detect presence)
//   - `session-start | session-pause | session-resume | session-stop`
//        → forwarded to service worker for runtime state
//   - `attempt-retry` → asks SW to re-queue a specific attempt
//   - On page load and every 60s, drains the SW's queue of log/attempt
//     updates that could not be delivered while no admin tab was open
//     (`agent.pending.flush`) and dispatches them through the normal
//     state-update path so outcomes get recorded late rather than never.

(function () {
  if (window.__qadanAdminBridgeInstalled) return;
  window.__qadanAdminBridgeInstalled = true;

  function send(kind, payload) {
    window.postMessage({ source: 'qa-ext', kind, ...payload }, '*');
  }

  function ask(kind, payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ kind, ...payload }, (resp) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(resp || { ok: false, error: 'empty' });
        });
      } catch (e) {
        resolve({ ok: false, error: String(e && e.message || e) });
      }
    });
  }

  window.addEventListener('message', async (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.source !== 'qa-admin') return;
    // First qa-admin message proves the page has live agent handlers —
    // safe to start draining the SW's pending queue (C6).
    markPageReady();
    if (d.kind === 'ping') {
      send('pong', { version: '0.2.0' });
      return;
    }
    if (d.kind === 'session-start') {
      const resp = await ask('agent.session.start', { sessionId: d.sessionId });
      send('session-start-ack', { sessionId: d.sessionId, ok: !!resp?.ok });
      return;
    }
    if (d.kind === 'session-pause') {
      await ask('agent.session.pause', { sessionId: d.sessionId });
      send('session-pause-ack', { sessionId: d.sessionId });
      return;
    }
    if (d.kind === 'session-resume') {
      await ask('agent.session.resume', { sessionId: d.sessionId });
      send('session-resume-ack', { sessionId: d.sessionId });
      return;
    }
    if (d.kind === 'session-stop') {
      await ask('agent.session.stop', { sessionId: d.sessionId });
      send('session-stop-ack', { sessionId: d.sessionId });
      return;
    }
    if (d.kind === 'attempt-retry') {
      await ask('agent.attempt.retry', { sessionId: d.sessionId, attemptId: d.attemptId });
      send('attempt-retry-ack', { sessionId: d.sessionId, attemptId: d.attemptId });
      return;
    }
    if (d.kind === 'agent.attempt.open') {
      const resp = await ask('agent.attempt.open', {
        sessionId: d.sessionId, attemptId: d.attemptId, jobId: d.jobId,
        url: d.url, autonomyLevel: d.autonomyLevel, atsType: d.atsType,
      });
      send('attempt-open-ack', { attemptId: d.attemptId, ok: !!resp?.ok, error: resp?.error });
      return;
    }
    if (d.kind === 'agent.session.snapshot.push') {
      // Admin pushed a full snapshot. Forward to SW.
      await ask('agent.session.snapshot', {
        session: d.session,
        attempts: d.attempts,
        packets: d.packets,
        vault: d.vault,
        resume: d.resume,
        gateContext: d.gateContext,
      });
      return;
    }
    if (d.kind === 'agent.bridge.question-result') {
      // Admin's interpreter returned. Forward to SW so it can resolve the
      // pending runner request.
      try {
        chrome.runtime.sendMessage({
          kind: 'agent.bridge.question-result',
          requestId: d.requestId,
          ok: d.ok,
          interpretation: d.interpretation,
        });
      } catch { /* ignore */ }
      return;
    }
  });

  // Listen for SW-initiated messages and forward to admin window.
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || typeof msg !== 'object') return;
      const forwardKinds = new Set([
        'agent.bridge.state-update',
        'agent.bridge.log',
        'agent.bridge.request-snapshot',
        'agent.bridge.interpret-question',
      ]);
      if (forwardKinds.has(msg.kind)) {
        // Forward as window event for the admin page
        window.postMessage({ source: 'qa-ext', ...msg }, '*');
        try { sendResponse({ ok: true }); } catch {}
      }
    });
  } catch { /* ignore */ }

  // Drain log/attempt updates the SW queued while no admin tab was open.
  // Each queued item is dispatched through the same window-message path a
  // live update would take, so dateApplied/outcomes get recorded late
  // rather than never (C6). Armed by the page's first qa-admin message —
  // flushing into a page without agent handlers would lose the queue.
  let pageReady = false;
  async function flushPending() {
    const resp = await ask('agent.pending.flush', {});
    if (!resp || !resp.ok) return;
    for (const entry of (resp.logs || [])) {
      if (entry) send('agent.bridge.log', { entry });
    }
    for (const u of (resp.updates || [])) {
      const attemptUpdate = u && u.attemptUpdate ? u.attemptUpdate : u;
      if (attemptUpdate && attemptUpdate.id) send('agent.bridge.state-update', { attemptUpdate });
    }
  }
  function markPageReady() {
    if (pageReady) return;
    pageReady = true;
    // Give the page's listeners a beat, then drain now + every ~60s.
    setTimeout(flushPending, 800);
    setInterval(flushPending, 60_000);
  }

  // Announce presence
  send('bridge-ready', { version: '0.2.0' });
})();
