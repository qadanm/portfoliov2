// Content script — responds to popup commands.
//
// The agent runner (agent-runner.js) runs first and handles the autonomous
// flow when an active attempt is assigned to this tab. The popup commands
// below are for MANUAL one-off operations (detect / fill / status) the
// user triggers when they want to inspect or apply outside of a session.

(function () {
  function adapter() {
    return window.__qadanAtsAdapters?.pickAdapter() || null;
  }

  function ats() { return adapter()?.name ?? 'generic'; }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      if (!msg || typeof msg !== 'object') {
        sendResponse({ ok: false, error: 'bad-msg' });
        return;
      }
      switch (msg.kind) {
        case 'ping': {
          sendResponse({
            ok: true,
            ats: ats(),
            url: location.href,
            title: document.title,
            captcha: window.__qadanAtsAdapters?.detectCaptcha?.() ?? false,
            login: window.__qadanAtsAdapters?.detectLoginWall?.() ?? false,
          });
          return;
        }
        case 'detect': {
          const a = adapter();
          if (!a) { sendResponse({ ok: false, error: 'no-adapter' }); return; }
          const fields = a.detect();
          sendResponse({ ok: true, ats: a.name, fields });
          return;
        }
        case 'fill': {
          const a = adapter();
          if (!a) { sendResponse({ ok: false, error: 'no-adapter' }); return; }
          const map = msg.map || {};
          if (Object.keys(map).length === 0) {
            sendResponse({ ok: false, error: 'empty-map' });
            return;
          }
          const filled = a.fill(map);
          sendResponse({ ok: true, filled, ats: a.name });
          return;
        }
        case 'agent.run-now': {
          // User-initiated run from popup. Delegates to agent-runner.
          if (window.__qadanAgent?.runOnce) {
            window.__qadanAgent.runOnce().then(() => sendResponse({ ok: true }));
            return true;
          }
          sendResponse({ ok: false, error: 'agent-runner-missing' });
          return;
        }
        case 'agent.recheck': {
          // After the user fixed a blocker manually — clear loop-guard
          // for this URL and run again.
          if (window.__qadanAgent?.recheck) {
            window.__qadanAgent.recheck().then(() => sendResponse({ ok: true }));
            return true;
          }
          sendResponse({ ok: false, error: 'agent-runner-missing' });
          return;
        }
        case 'm3-submit': {
          // Submit is handled by the agent runner with full gate checks.
          // Popup cannot bypass; this endpoint always refuses.
          sendResponse({ ok: false, error: 'm3-via-agent-runner', reason: 'Use Auto Apply session at L3+ for confirmed submit.' });
          return;
        }
        default:
          sendResponse({ ok: false, error: 'unknown-kind' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: 'exception', message: String(e && e.message || e) });
    }
    return true;
  });
})();
