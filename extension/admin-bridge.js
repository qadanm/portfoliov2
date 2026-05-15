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
//   - Periodically polls SW for pending log/attempt updates and pushes them
//     into the admin via custom DOM events so admin scripts re-render.

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
    if (d.kind === 'agent.session.snapshot.push') {
      // Admin pushed a full snapshot. Forward to SW.
      await ask('agent.session.snapshot', {
        session: d.session,
        attempts: d.attempts,
        packets: d.packets,
        vault: d.vault,
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

  // Announce presence
  send('bridge-ready', { version: '0.2.0' });
})();
