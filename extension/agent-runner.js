// Agent runner. Executes the per-tab attempt loop on ATS pages.
//
// The flow per ATS page load:
//   1. Ask SW: "is there an active attempt for this tab?"
//   2. If yes: load vault from chrome.storage
//   3. Detect ATS adapter
//   4. Check CAPTCHA / login / page error → pause if any
//   5. Detect fields, classify, count required-unknown
//   6. Fill safe fields (high-confidence only by default)
//   7. Report progress to SW (which forwards to admin)
//   8. If autonomy >= 2 and a "next" button exists → click it
//      (page reloads/changes; SW persists attempt and runner re-runs on next page)
//   9. If autonomy >= 3 and a "submit" button exists → check ALL gates;
//      if any gate fails → pause/needs-review. If all pass → click submit,
//      verify submit success, mark attempt submitted.
//
// Boundaries enforced HERE (in addition to admin-side gates):
//   - Never click submit if CAPTCHA or login is present
//   - Never autofill `never`-classified fields
//   - Never fill demographic / EEOC fields
//   - Pause for unknown required fields
//   - Pause if upload would be required but no file is selected
//   - If autonomy < 3, NEVER click submit
//
// The runner reports back via chrome.runtime.sendMessage to background.

(function () {
  if (window.__qadanAgentRunnerInstalled) return;
  window.__qadanAgentRunnerInstalled = true;

  const ADAPTERS = window.__qadanAtsAdapters;
  if (!ADAPTERS) {
    console.warn('[qa-agent] ATS adapters not loaded');
    return;
  }

  function send(kind, payload = {}) {
    try {
      chrome.runtime.sendMessage({ kind, ...payload }, (_resp) => {
        if (chrome.runtime.lastError) {
          // SW may be sleeping; that's fine — retry next event
        }
      });
    } catch (e) {
      // Silent — SW may not be ready
    }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Detect if the page looks like the FINAL "thanks for applying" page.
  function detectSubmitConfirmation(doc = document) {
    const txt = doc.body?.innerText?.slice(0, 800).toLowerCase() ?? '';
    return /thank you|thanks for applying|application (received|submitted)|we (have )?received|your application has been (received|submitted)|application complete/i.test(txt);
  }

  // Wait until page settles after a navigation. Uses a MutationObserver
  // to wait for DOM activity to stop for `quiet` ms, capped at `cap`.
  // Real ATS pages hydrate progressively — naive setTimeout misses fields
  // added 800ms+ after document idle.
  function waitForSettle(opts) {
    opts = opts || {};
    const cap = opts.cap || 4000;
    const quiet = opts.quiet || 700;
    return new Promise((resolve) => {
      let lastChange = Date.now();
      let resolved = false;
      const target = document.body || document.documentElement;
      let mo;
      try {
        mo = new MutationObserver(() => { lastChange = Date.now(); });
        mo.observe(target, { childList: true, subtree: true, attributes: true });
      } catch { /* ignore */ }
      const start = Date.now();
      const tick = () => {
        if (resolved) return;
        const idle = Date.now() - lastChange;
        if (idle >= quiet || Date.now() - start >= cap) {
          resolved = true;
          try { mo && mo.disconnect(); } catch { /* ignore */ }
          resolve();
          return;
        }
        setTimeout(tick, 120);
      };
      setTimeout(tick, 120);
    });
  }

  // Wait until at least one input/textarea is visible. Some ATS pages
  // render an empty shell first and only attach the form after JS bundles
  // resolve — without this we'd report "no fields" and pause prematurely.
  function waitForFormVisible(timeoutMs = 5000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        const any = document.querySelector('form input:not([type=hidden]), form textarea, form select, [role="form"] input:not([type=hidden]), [role="form"] textarea');
        if (any && any.getBoundingClientRect().width > 0) return resolve(true);
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(check, 200);
      };
      check();
    });
  }

  async function runOnce() {
    // Wait for hydration before we ask the SW anything — content scripts
    // often fire on document_idle, which is BEFORE React hydrates form fields.
    await waitForFormVisible(3500);
    await waitForSettle({ quiet: 700, cap: 3500 });

    // 1. Ask SW for active attempt
    const ctx = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ kind: 'agent.tab.get-attempt' }, (resp) => {
          if (chrome.runtime.lastError) return resolve(null);
          resolve(resp || null);
        });
      } catch { resolve(null); }
    });
    if (!ctx || !ctx.ok || !ctx.attempt) {
      send('agent.runner.idle');
      return;
    }

    const { attempt, session, vault, packet } = ctx;
    const adapter = ADAPTERS.pickAdapter();

    send('agent.runner.page-loaded', {
      attemptId: attempt.id,
      ats: adapter.name,
      url: location.href,
      title: document.title,
    });

    // Confirm-submit page reached after a prior submit
    if (detectSubmitConfirmation()) {
      send('agent.runner.submitted-detected', { attemptId: attempt.id, url: location.href });
      return;
    }

    // 2. Pre-flight: CAPTCHA / login / error / dropzone / rich-text
    if (ADAPTERS.detectCaptcha()) {
      send('agent.runner.pause', { attemptId: attempt.id, blockReason: 'captcha', message: 'CAPTCHA detected — solve it manually, then click Retry.' });
      return;
    }
    if (ADAPTERS.detectLoginWall()) {
      send('agent.runner.pause', { attemptId: attempt.id, blockReason: 'login-required', message: 'Sign-in required — sign in, then click Retry.' });
      return;
    }
    if (ADAPTERS.detectPageError()) {
      send('agent.runner.pause', { attemptId: attempt.id, blockReason: 'page-error', message: 'Page returned an error.' });
      return;
    }

    // Rich-text editors can't be safely typed into; pause if any are present
    // and they look like answer fields (not just decorative).
    const rte = ADAPTERS.detectRichTextEditors?.() || [];
    if (rte.length > 0) {
      send('agent.runner.pause', {
        attemptId: attempt.id,
        blockReason: 'unknown-required-field',
        message: `Rich-text editor present (${rte[0].label}). Paste the cover letter manually, then click Retry.`,
      });
      return;
    }

    // Custom selects (React Select etc.) can't be filled by setting .value
    // — they require a chain of click events that's brittle. Flag them so
    // the user knows what to fill manually.
    const customSelects = ADAPTERS.detectCustomSelects?.() || [];
    // We don't pause for these — we just record them as review fields.

    // 3. Detect fields
    const fields = adapter.detect();
    const counts = {
      high: 0, medium: 0, low: 0, never: 0,
      requiredUnknown: ADAPTERS.countUnknownRequiredFields(fields),
      requiredDemographic: ADAPTERS.countDemographicRequired(fields),
    };
    for (const f of fields) counts[f.confidence] = (counts[f.confidence] || 0) + 1;
    send('agent.runner.fields-detected', { attemptId: attempt.id, counts });

    // 4. Build map from vault + packet
    if (!vault) {
      send('agent.runner.pause', { attemptId: attempt.id, blockReason: 'gates-failed', message: 'Vault not imported into extension.' });
      return;
    }
    const map = buildMapFromVault(vault, packet);
    // Allow packet-paste tier when we have a packet
    if (packet) map.__allowPacketPaste = true;

    // 5. Fill safe + packet-paste fields
    const fillResult = adapter.fill(map, document, { collectTruncations: true });
    const filledCount = typeof fillResult === 'number' ? fillResult : fillResult.filled;
    const truncations = typeof fillResult === 'number' ? [] : fillResult.truncations || [];
    const filledKeys = Array.from(new Set(fields
      .filter(f => (f.confidence === 'high' || f.confidence === 'packet') && f.key)
      .map(f => f.key)));
    const reviewKeys = fields.filter(f => f.confidence === 'medium').map(f => f.key || f.label).slice(0, 8);
    for (const cs of customSelects.slice(0, 4)) reviewKeys.push(`select: ${cs.label}`);
    send('agent.runner.fields-filled', {
      attemptId: attempt.id,
      filledCount,
      filledKeys,
      reviewKeys,
      neverKeys: fields.filter(f => f.confidence === 'never').map(f => f.key || f.label).slice(0, 12),
      truncations,
      customSelects: customSelects.length,
    });

    // 5b. Resume upload — only when a session file is staged via popup
    const resumeInput = ADAPTERS.findResumeInput?.();
    const dropzone = !resumeInput ? ADAPTERS.detectUnboundDropzone?.() : null;
    if (resumeInput) {
      const fileStaged = await getStagedResumeFile();
      if (fileStaged) {
        const uploaded = ADAPTERS.uploadFileToInput(resumeInput, fileStaged);
        send('agent.runner.upload', {
          attemptId: attempt.id,
          ok: uploaded,
          fileName: fileStaged.name,
        });
        if (!uploaded) {
          send('agent.runner.pause', {
            attemptId: attempt.id,
            blockReason: 'upload-failed',
            message: 'Browser refused programmatic upload. Drop the PDF on the upload area, then click Retry.',
          });
          return;
        }
        // Verify the upload landed
        await sleep(300);
        if (!resumeInput.files || resumeInput.files.length === 0) {
          send('agent.runner.pause', {
            attemptId: attempt.id,
            blockReason: 'upload-failed',
            message: 'Upload did not register on the form. Drop the PDF manually, then click Retry.',
          });
          return;
        }
      } else {
        // Resume slot present but no staged file — pause and ask user once
        send('agent.runner.pause', {
          attemptId: attempt.id,
          blockReason: 'upload-failed',
          message: 'Resume upload required. Open the extension popup → Agent → Pick resume PDF, then click Retry.',
        });
        return;
      }
    } else if (dropzone) {
      // Drag-drop widget with no addressable file input — programmatic
      // upload won't take. Pause with a clear message.
      send('agent.runner.pause', {
        attemptId: attempt.id,
        blockReason: 'upload-failed',
        message: `Drag-drop upload area detected (${dropzone.label}). Drop the resume manually, then click Retry.`,
      });
      return;
    }

    // 5c. Unknown required textareas — ask admin for interpretation
    const unknownTextareas = fields.filter(f =>
      f.type === 'textarea' && f.confidence === 'low' && f.required && f.label
    );
    if (unknownTextareas.length > 0) {
      const drafts = await Promise.all(unknownTextareas.slice(0, 4).map(async f => {
        const interp = await askAdminForQuestion(attempt.id, f.label);
        return { field: f, interp };
      }));
      let pasted = 0;
      const pendingReview = [];
      for (const { field, interp } of drafts) {
        if (!interp || interp.needsHuman) {
          pendingReview.push({ label: field.label, reason: interp?.reason || 'unknown' });
          continue;
        }
        const el = field.selector ? document.querySelector(field.selector) : null;
        if (el && interp.draft && interp.draft.length > 5) {
          setValueViaAdapter(el, interp.draft);
          pasted++;
        }
      }
      if (pendingReview.length > 0) {
        send('agent.runner.pause', {
          attemptId: attempt.id,
          blockReason: 'unknown-required-field',
          message: `${pendingReview.length} question(s) need review: ${pendingReview.map(p => p.label).slice(0, 3).join(' | ')}`,
          unknownQuestions: pendingReview.map(p => p.label),
        });
        return;
      }
      if (pasted > 0) {
        send('agent.runner.questions-answered', {
          attemptId: attempt.id,
          answered: pasted,
        });
      }
    }

    // Settle so React/state updates land
    await sleep(500);

    // 6. Decide next action based on autonomy + gates
    const autonomy = attempt.autonomyLevel;

    // L1: stop here. User submits manually.
    if (autonomy < 2) {
      send('agent.runner.pause', { attemptId: attempt.id, blockReason: 'user-paused', message: 'Level 1 — fill only. Awaiting user submit.' });
      return;
    }

    // Loop guard — track how many times the runner has fired on this same
    // URL during this session. After 3 fires without progress, stop.
    const loopGuardOk = await registerLoopFire(session.id, attempt.id, location.href);
    if (!loopGuardOk) {
      send('agent.runner.pause', {
        attemptId: attempt.id,
        blockReason: 'page-changed',
        message: 'Possible navigation loop — agent ran 3× on the same URL without progress. Stopped.',
      });
      return;
    }

    // Look for submit button first — if present, this is the final page
    const submitBtn = adapter.findSubmit?.();
    if (submitBtn) {
      // Check unresolved required fields BEFORE we consider submitting
      if (counts.requiredUnknown > 0) {
        send('agent.runner.pause', {
          attemptId: attempt.id,
          blockReason: 'unknown-required-field',
          message: `${counts.requiredUnknown} unknown required field(s) on submit page.`,
        });
        return;
      }
      if (counts.requiredDemographic > 0) {
        send('agent.runner.pause', {
          attemptId: attempt.id,
          blockReason: 'demographic-required',
          message: `${counts.requiredDemographic} demographic field(s) required.`,
        });
        return;
      }

      // L2: pause before submit
      if (autonomy < 3) {
        send('agent.runner.pause', {
          attemptId: attempt.id,
          blockReason: 'user-paused',
          message: 'Level 2 — ready to submit. Awaiting user submit click.',
        });
        return;
      }

      // L3+: ask SW for the final go/no-go gate decision
      const gateRes = await new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({
            kind: 'agent.runner.request-submit-gate',
            attemptId: attempt.id,
            pageState: {
              captchaPresent: false,
              loginPresent: false,
              unknownRequiredFields: counts.requiredUnknown,
              demographicFieldsRequired: counts.requiredDemographic,
              legalFieldsRequired: 0,
              uploadFailed: false,
              pageError: false,
            },
          }, (resp) => {
            if (chrome.runtime.lastError) return resolve({ ok: false });
            resolve(resp || { ok: false });
          });
        } catch { resolve({ ok: false }); }
      });

      if (!gateRes || !gateRes.ok) {
        send('agent.runner.pause', {
          attemptId: attempt.id,
          blockReason: gateRes?.blockReason || 'gates-failed',
          message: gateRes?.reasons?.join(' · ') || 'Gates rejected submit.',
        });
        return;
      }

      // All gates passed → click submit. (gate-eval enforces dry-run.)
      send('agent.runner.submit-attempted', { attemptId: attempt.id, url: location.href });
      const clicked = ADAPTERS.clickButton(submitBtn);
      if (!clicked) {
        send('agent.runner.pause', {
          attemptId: attempt.id,
          blockReason: 'gates-failed',
          message: 'Submit button found but not clickable (likely disabled or in a loading state).',
        });
        return;
      }

      // Wait for the post-submit page
      await sleep(2500);
      // Validation errors take precedence — common pattern is the submit
      // click triggers required-field validation rather than navigating.
      const submitErrors = ADAPTERS.detectValidationErrors?.() || [];
      if (submitErrors.length > 0) {
        send('agent.runner.pause', {
          attemptId: attempt.id,
          blockReason: 'unknown-required-field',
          message: `Form rejected submit with errors: ${submitErrors.slice(0, 2).join(' · ')}`,
        });
        return;
      }
      if (detectSubmitConfirmation()) {
        send('agent.runner.submitted', { attemptId: attempt.id, url: location.href });
      } else {
        send('agent.runner.pause', {
          attemptId: attempt.id,
          blockReason: 'page-changed',
          message: 'Submit clicked but no confirmation seen. Check the page and click Retry.',
        });
      }
      return;
    }

    // No submit button on this page → try to advance
    if (autonomy < 2) {
      send('agent.runner.pause', { attemptId: attempt.id, blockReason: 'user-paused', message: 'Filled. Awaiting user.' });
      return;
    }

    if (counts.requiredUnknown > 0) {
      send('agent.runner.pause', {
        attemptId: attempt.id,
        blockReason: 'unknown-required-field',
        message: `${counts.requiredUnknown} unknown required field(s).`,
      });
      return;
    }

    const nextBtn = adapter.findNext?.();
    if (!nextBtn) {
      send('agent.runner.pause', {
        attemptId: attempt.id,
        blockReason: 'page-changed',
        message: 'No advance or submit button found. Verify manually, then click Retry.',
      });
      return;
    }
    const nextLabel = (nextBtn.textContent || nextBtn.value || '').trim();
    send('agent.runner.advance', { attemptId: attempt.id, buttonText: nextLabel });
    ADAPTERS.clickButton(nextBtn);

    // After clicking Next, the page may either navigate (causing this
    // script to be re-injected) or surface validation errors in place.
    // Wait briefly and re-check; if errors are visible, pause and don't
    // retry — retrying would create a click loop.
    await sleep(900);
    const errors = ADAPTERS.detectValidationErrors?.() || [];
    if (errors.length > 0) {
      send('agent.runner.pause', {
        attemptId: attempt.id,
        blockReason: 'unknown-required-field',
        message: `Validation: ${errors.slice(0, 2).join(' · ')}`,
      });
    }
  }

  // Loop guard — uses chrome.storage.session keyed by attempt + url.
  async function registerLoopFire(sessionId, attemptId, url) {
    return new Promise((resolve) => {
      try {
        const key = `loopguard:${sessionId}:${attemptId}:${url}`;
        chrome.storage.session.get([key], (out) => {
          const prior = Number(out?.[key] || 0);
          const next = prior + 1;
          chrome.storage.session.set({ [key]: next }, () => {
            // 3rd run on the same URL without progress = loop. Allow first
            // and second, block third+.
            resolve(next <= 2);
          });
        });
      } catch { resolve(true); }
    });
  }

  // Ask SW to retrieve a staged resume file for this session. The popup
  // stores a base64 + filename payload in chrome.storage.session.
  async function getStagedResumeFile() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ kind: 'agent.runner.get-staged-resume' }, (resp) => {
          if (chrome.runtime.lastError || !resp?.ok || !resp.file) return resolve(null);
          try {
            const { name, type, base64 } = resp.file;
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: type || 'application/pdf' });
            const file = new File([blob], name || 'resume.pdf', { type: type || 'application/pdf' });
            resolve(file);
          } catch { resolve(null); }
        });
      } catch { resolve(null); }
    });
  }

  // Ask the admin (via SW + admin-bridge) to interpret an unknown question
  // text and return a draft. Times out at 8s and falls back to "needsHuman".
  async function askAdminForQuestion(attemptId, questionText) {
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        resolve({ needsHuman: true, reason: 'timeout', draft: '' });
      }, 8000);
      try {
        chrome.runtime.sendMessage({
          kind: 'agent.runner.interpret-question',
          attemptId,
          questionText,
        }, (resp) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          if (chrome.runtime.lastError || !resp?.ok) {
            resolve({ needsHuman: true, reason: 'no-bridge', draft: '' });
            return;
          }
          resolve(resp.interpretation || { needsHuman: true, reason: 'unknown', draft: '' });
        });
      } catch {
        clearTimeout(timer);
        if (!done) { done = true; resolve({ needsHuman: true, reason: 'exception', draft: '' }); }
      }
    });
  }

  // Use the adapter's value-setter so React-controlled textareas update.
  function setValueViaAdapter(el, value) {
    const tag = el.tagName.toLowerCase();
    const desc = Object.getOwnPropertyDescriptor(el, 'value')
      || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.setAttribute('data-qa-filled', 'true');
    if (!el.style.outline) el.style.outline = '2px solid rgba(245, 158, 11, 0.6)';
  }

  function buildMapFromVault(vault, packet) {
    const map = {};
    const parts = String(vault.displayName || 'Moe Qadan').trim().split(/\s+/);
    map.firstName = vault.legalFirstName || parts[0] || '';
    map.lastName = vault.legalLastName || parts.slice(1).join(' ') || '';
    map.preferredName = vault.preferredName || vault.displayName || 'Moe';
    map.fullName = vault.displayName || 'Moe Qadan';
    if (vault.email) map.email = vault.email;
    if (vault.phone) map.phone = vault.phone;
    if (vault.city) map.city = vault.city;
    if (vault.state) map.state = vault.state;
    if (vault.country) map.country = vault.country;
    if (vault.city || vault.state) map.location = [vault.city, vault.state].filter(Boolean).join(', ');
    if (vault.linkedin) map.linkedin = vault.linkedin;
    if (vault.portfolio) map.portfolio = vault.portfolio;
    if (vault.github) map.github = vault.github;
    if (vault.personalSite) map.personalSite = vault.personalSite;
    if (vault.currentEmployer) map.currentEmployer = vault.currentEmployer;
    if (vault.currentTitle) map.currentTitle = vault.currentTitle;
    if (vault.yearsExperience != null) map.yearsExperience = String(vault.yearsExperience);
    if (vault.workAuthAutofillAllowed && vault.workAuthAnswer) map.workAuth = vault.workAuthAnswer;
    if (vault.workAuthAutofillAllowed && vault.sponsorshipAnswer) map.sponsorship = vault.sponsorshipAnswer;
    // Packet-paste tier
    if (packet?.coverLetter) map.coverLetterText = packet.coverLetter;
    if (packet?.whyRoleAnswer) map.whyRole = packet.whyRoleAnswer;
    if (packet?.whyCompanyAnswer) map.whyCompany = packet.whyCompanyAnswer;
    if (packet?.tellMeAboutYourself) map.tellMeAboutYourself = packet.tellMeAboutYourself;
    if (packet?.salaryGuidance) map.salaryExpectation = packet.salaryGuidance;
    return map;
  }

  // Auto-run shortly after page idle. The content script imports this BEFORE
  // content.js, so content.js can also call into this if needed.
  // recheck() = clear loop-guard for the current URL and re-run.
  async function recheck() {
    try {
      const url = location.href;
      const all = await new Promise((resolve) => {
        chrome.storage.session.get(null, (out) => resolve(out || {}));
      });
      const toClear = Object.keys(all).filter(k => k.startsWith('loopguard:') && k.endsWith(`:${url}`));
      if (toClear.length > 0) {
        await new Promise((resolve) => chrome.storage.session.remove(toClear, resolve));
      }
    } catch { /* ignore */ }
    return runOnce();
  }
  window.__qadanAgent = { runOnce, recheck };

  // Fire once after a settle, unless the popup explicitly tells us to wait.
  waitForSettle().then(() => runOnce().catch(err => {
    send('agent.runner.error', { message: String(err && err.message || err) });
  }));
})();
