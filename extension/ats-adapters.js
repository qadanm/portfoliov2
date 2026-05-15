// Per-ATS field adapters. Each adapter knows the selectors for the standard
// fields on its platform. The generic adapter is the fallback when nothing
// else matches.
//
// IMPORTANT: All adapters must:
//   - return field metadata only when `detect()` is called
//   - fill fields only when `fill()` is called with an explicit map
//   - NEVER click submit unless the per-app M3 confirmation flow opts in

(function () {
  function $(sel, doc) { return (doc || document).querySelector(sel); }
  function $$(sel, doc) { return Array.from((doc || document).querySelectorAll(sel)); }

  // Find the closest semantic label for an input element. Multiple
  // fallback strategies because real ATS pages are inconsistent:
  //   1. <label for=id> — Greenhouse, Ashby standard
  //   2. wrapper <label> — common in custom forms
  //   3. aria-labelledby chain (multiple IDs allowed)
  //   4. aria-label
  //   5. closest <fieldset><legend> — Workday, some Lever
  //   6. preceding-sibling <label>/<span>/<div> with "label" class — React Hook Form
  //   7. ancestor with "field" / "form-row" pattern containing a header
  //   8. placeholder
  //   9. name / id
  function labelFor(input) {
    if (!input) return '';
    // 1. <label for=id>
    if (input.id) {
      try {
        const lab = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        if (lab) return lab.textContent.trim();
      } catch { /* invalid id */ }
    }
    // 2. Wrapper <label>
    const wrap = input.closest('label');
    if (wrap) {
      const clone = wrap.cloneNode(true);
      clone.querySelectorAll('input, textarea, select').forEach(n => n.remove());
      const t = clone.textContent.trim();
      if (t) return t;
    }
    // 3. aria-labelledby (may be space-separated list)
    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      const parts = labelledBy.split(/\s+/).map(id => {
        const el = document.getElementById(id);
        return el?.textContent?.trim();
      }).filter(Boolean);
      if (parts.length > 0) return parts.join(' ');
    }
    // 4. aria-label
    const al = input.getAttribute('aria-label');
    if (al) return al;
    // 5. fieldset + legend — must be a DIRECT-child legend; nested fieldsets
    // (EEO blocks inside an outer wrapper) would otherwise leak their legend
    // to every field above them.
    const fieldset = input.closest('fieldset');
    if (fieldset) {
      let legend = null;
      for (const child of fieldset.children) {
        if (child.tagName.toLowerCase() === 'legend') { legend = child; break; }
      }
      if (legend) {
        const t = legend.textContent?.trim();
        if (t) return t;
      }
    }
    // 6. preceding sibling label-ish (covers React Hook Form, Tailwind UI)
    let sib = input.previousElementSibling;
    let hops = 0;
    while (sib && hops < 3) {
      const tag = sib.tagName.toLowerCase();
      const cls = (sib.className && typeof sib.className === 'string') ? sib.className.toLowerCase() : '';
      if (tag === 'label' || /label|fieldlabel|field__label/.test(cls)) {
        const t = sib.textContent?.trim();
        if (t) return t;
      }
      sib = sib.previousElementSibling; hops++;
    }
    // 7. ancestor "field" container with leading label
    const fieldContainer = input.closest('[class*="field" i], [class*="form-row" i], [class*="form-group" i]');
    if (fieldContainer) {
      const headerNode = fieldContainer.querySelector('label, [class*="label" i], legend, h3, h4');
      if (headerNode) {
        const clone = headerNode.cloneNode(true);
        clone.querySelectorAll('input, textarea, select').forEach(n => n.remove());
        const t = clone.textContent?.trim();
        if (t) return t;
      }
    }
    return input.placeholder || input.name || input.id || '';
  }

  // Dispatch React-friendly input + change so controlled inputs see the value.
  // Returns true on success. If the element is detached or rejects the set,
  // verifies post-set and reports failure so the caller can re-find.
  function setValue(el, value) {
    if (!el) return false;
    // Detached node?
    if (!el.isConnected) return false;
    const tag = el.tagName.toLowerCase();
    try {
      if (tag === 'select') {
        el.value = value;
      } else {
        const desc = Object.getOwnPropertyDescriptor(el, 'value')
          || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
        if (desc && desc.set) desc.set.call(el, value);
        else el.value = value;
      }
      // Some React forms also need a blur to commit the value (RHF, Formik).
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    } catch (e) {
      return false;
    }
    // Verify the value actually stuck (React-controlled fields can reset)
    if (tag !== 'select' && el.value !== value && !el.value.startsWith(value.slice(0, 8))) {
      // Try once more with a small delay
      try {
        el.focus();
        const desc = Object.getOwnPropertyDescriptor(el, 'value')
          || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
        if (desc && desc.set) desc.set.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch { /* ignore */ }
    }
    el.setAttribute('data-qa-filled', 'true');
    if (!el.style.outline) el.style.outline = '2px solid rgba(245, 158, 11, 0.6)';
    return true;
  }

  // Standard "best-effort match" for a list of selectors. Returns the first
  // visible matching element, ignoring hidden/disabled.
  function pick(selectors, doc) {
    for (const sel of selectors) {
      const els = $$(sel, doc);
      for (const el of els) {
        if (!el) continue;
        if (el.disabled) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        return el;
      }
    }
    return null;
  }

  // ── Generic adapter ─────────────────────────────────────────────
  // Heuristic-based; reads labels and matches to canonical keys.
  const FIELD_KEY_MATCHERS = [
    { key: 'firstName', tests: [/^first[\s_-]?name/i, /^given[\s_-]?name/i] },
    { key: 'lastName', tests: [/^last[\s_-]?name/i, /^surname/i, /^family[\s_-]?name/i] },
    { key: 'preferredName', tests: [/preferred[\s_-]?name/i, /^nickname/i] },
    { key: 'fullName', tests: [/^full[\s_-]?name/i, /^name$/i] },
    { key: 'email', tests: [/^e-?mail/i] },
    { key: 'phone', tests: [/^phone/i, /mobile/i, /\bcell\b/i] },
    { key: 'city', tests: [/^city/i, /\btown\b/i] },
    { key: 'state', tests: [/^state/i, /province/i] },
    { key: 'country', tests: [/^country/i] },
    { key: 'location', tests: [/^location/i, /^address/i] },
    { key: 'linkedin', tests: [/linkedin/i] },
    { key: 'portfolio', tests: [/portfolio/i, /personal\s*site/i, /^website/i, /\burl\b/i] },
    { key: 'github', tests: [/github/i] },
    { key: 'currentEmployer', tests: [/current\s*employer/i, /current\s*company/i, /^company$/i] },
    { key: 'currentTitle', tests: [/current\s*title/i, /job\s*title/i, /^position/i, /^title$/i] },
    { key: 'yearsExperience', tests: [/years\s*(of\s*)?experience/i, /\byoe\b/i] },
    { key: 'source', tests: [/how\s*did\s*you\s*hear/i, /how\s*you\s*hear/i, /referral\s*source/i, /where\s*did\s*you\s*find/i] },
    // Long-form packet fields — agent will paste from packet
    { key: 'coverLetterText', tests: [/cover\s*letter/i, /letter\s*of\s*interest/i] },
    { key: 'whyRole', tests: [/why.*(this|the).*(role|position|job)/i, /interest.*role/i] },
    { key: 'whyCompany', tests: [/why.*(this|the|us)\s*(company|team)?/i, /interest.*company/i, /why\s+us\b/i] },
    { key: 'tellMeAboutYourself', tests: [/tell\s*us?\s*about\s*your(self|s)/i, /brief\s*(intro|bio)/i, /^bio\b/i] },
    { key: 'salaryExpectation', tests: [/salary\s*(expectation|range|requirement|requirements)/i, /expected\s*(pay|salary)/i, /comp\s*expectation/i, /target\s*(pay|salary)/i] },
  ];

  const PACKET_FIELD_KEYS = new Set([
    'coverLetterText', 'whyRole', 'whyCompany', 'tellMeAboutYourself', 'salaryExpectation',
  ]);

  function classifyLabel(label) {
    if (!label) return null;
    for (const { key, tests } of FIELD_KEY_MATCHERS) {
      if (tests.some(t => t.test(label))) return key;
    }
    return null;
  }

  function detectGeneric(doc) {
    const fields = [];
    const inputs = $$('input, textarea, select', doc).filter(el => {
      const type = (el.type || '').toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) return false;
      // File inputs are kept — the runner uploads to them separately
      if (el.disabled || el.readOnly) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const rf = window.__qadanRedFlags;
    for (const el of inputs) {
      const label = labelFor(el);
      const key = classifyLabel(label);
      const isFile = (el.type || '').toLowerCase() === 'file';
      const isTextarea = el.tagName.toLowerCase() === 'textarea';
      let confidence = 'low';
      if (key) {
        if (['firstName', 'lastName', 'email', 'phone', 'city', 'state', 'country', 'location', 'linkedin', 'portfolio', 'github', 'fullName', 'preferredName'].includes(key)) {
          confidence = 'high';
        } else if (['currentEmployer', 'currentTitle', 'yearsExperience', 'source'].includes(key)) {
          confidence = 'medium';
        } else if (PACKET_FIELD_KEYS.has(key)) {
          // Packet-paste fields: agent fills from packet without ambiguity
          confidence = 'packet';
        }
      }
      if (rf?.isNeverAutofill(label)) confidence = 'never';
      else if (rf?.isSensitive(label)) confidence = 'medium';
      // Resume / file inputs — flag explicitly
      if (isFile) {
        const isResume = /resume|cv\b/i.test(label) || /resume|cv\b/i.test(el.name || '') || /resume|cv\b/i.test(el.id || '');
        confidence = isResume ? 'resume-upload' : 'file-other';
      }
      fields.push({
        selector: el.id ? `#${CSS.escape(el.id)}` : null,
        label,
        key,
        confidence,
        type: isFile ? 'file' : (isTextarea ? 'textarea' : (el.type || el.tagName.toLowerCase())),
        currentValue: el.value || '',
      });
    }
    return fields;
  }

  // Intelligently truncate text to fit a maxlength. Prefer to cut at a
  // sentence boundary or whitespace near the limit; never mid-word.
  function truncateToFit(text, limit) {
    if (!text || text.length <= limit) return text;
    if (limit <= 80) {
      const cut = text.slice(0, Math.max(0, limit - 1)).trimEnd();
      return cut;
    }
    // Try to end on a period within the last 20% of the limit
    const lookback = Math.max(40, Math.floor(limit * 0.2));
    const window = text.slice(0, limit);
    const lastPeriod = window.lastIndexOf('.', limit);
    if (lastPeriod > limit - lookback && lastPeriod > 0) {
      return text.slice(0, lastPeriod + 1);
    }
    const lastSpace = window.lastIndexOf(' ');
    if (lastSpace > limit - lookback) return text.slice(0, lastSpace).trimEnd() + '…';
    return text.slice(0, limit - 1).trimEnd() + '…';
  }

  function fillGeneric(map, doc, opts) {
    opts = opts || {};
    const truncations = [];
    let filled = 0;
    const inputs = $$('input, textarea, select', doc).filter(el => {
      const type = (el.type || '').toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(type)) return false;
      if (el.disabled || el.readOnly) return false;
      return true;
    });
    const rf = window.__qadanRedFlags;
    for (const el of inputs) {
      const label = labelFor(el);
      if (rf?.isNeverAutofill(label)) continue;
      const key = classifyLabel(label);
      if (!key) continue;
      let val = map[key];
      if (!val) continue;
      // Sensitive — only fill if M2 has 'medium' enabled per per-field flag
      if (rf?.isSensitive(label) && !map.__allowSensitive) continue;
      // Packet-paste fields: only if caller opted in
      if (PACKET_FIELD_KEYS.has(key) && !map.__allowPacketPaste) continue;
      // Respect maxlength
      const maxlen = Number(el.getAttribute('maxlength') || 0);
      if (maxlen > 0 && val.length > maxlen) {
        const before = val.length;
        val = truncateToFit(val, maxlen);
        truncations.push({ key, label, before, after: val.length, maxlen });
      }
      setValue(el, val);
      filled++;
    }
    if (opts.collectTruncations) return { filled, truncations };
    return filled;
  }

  // Find file input(s) on the page that look like resume slots.
  // ATS commonly hide the native <input> and show a styled drop zone instead.
  // We accept hidden inputs because DataTransfer.files works even on a
  // visually-hidden input. We also surface drag/drop widgets so the runner
  // can pause with a clear message when programmatic upload won't take.
  function findResumeInput(doc = document) {
    const inputs = $$('input[type=file]', doc);
    // Pass 1: explicit resume-labelled input
    for (const el of inputs) {
      const label = labelFor(el).toLowerCase();
      const name = (el.name || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      if (/resume|cv\b/.test(label + ' ' + name + ' ' + id) && !el.disabled) {
        return el;
      }
    }
    // Pass 2: any single visible file input on a form that mentions "resume"
    const formText = doc.body?.innerText?.toLowerCase() ?? '';
    if (!/resume|cv\b|upload your/.test(formText)) return null;
    const visible = inputs.filter(el => {
      if (el.disabled) return false;
      const rect = el.getBoundingClientRect();
      return rect.width >= 0; // hidden ones are still OK for DataTransfer
    });
    return visible[0] || null;
  }

  // Detect custom-select widgets (React Select, Downshift, Headless UI
  // Listbox, etc.) — these aren't native <select> and can't be filled by
  // setting .value. The agent pauses on these rather than silently failing.
  function detectCustomSelects(doc = document) {
    const out = [];
    const seen = new Set();
    // Common React-Select patterns
    const candidates = [
      ...$$('[class*="react-select" i]', doc),
      ...$$('[role="combobox"]', doc),
      ...$$('[role="listbox"]', doc),
      ...$$('[aria-haspopup="listbox"]', doc),
    ];
    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // Skip if a native select sits inside it (already handled by detectGeneric)
      if (el.querySelector('select')) continue;
      // Use parent label or aria-label or self text
      const label = labelFor(el) || el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 60);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push({ label, role: el.getAttribute('role') || 'custom-select' });
      if (out.length >= 6) break;
    }
    return out;
  }

  // Detect a drag/drop upload widget without a corresponding native file
  // input we can target. Used to pause with a useful message rather than
  // try to do something the browser will refuse.
  function detectUnboundDropzone(doc = document) {
    const candidates = $$('[data-testid*="drop" i], [class*="dropzone" i], [aria-label*="drag" i]', doc);
    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // Look for an associated <input type=file> within or near the widget.
      const nearbyInput = el.querySelector('input[type=file]') ||
        el.closest('form')?.querySelector('input[type=file]');
      if (!nearbyInput) return { label: el.getAttribute('aria-label') || el.textContent?.slice(0, 80) || 'drag-drop widget' };
    }
    return null;
  }

  // Upload a File to a file input using DataTransfer. Works in Chrome content
  // scripts for synthetic events.
  function uploadFileToInput(input, file) {
    if (!input || !file) return false;
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.setAttribute('data-qa-filled', 'resume');
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── Shared advance / submit / detect helpers ──────────────────
  //
  // Each adapter declares button selectors. The agent calls `findNext`
  // / `findSubmit` to locate the right button; the agent decides whether
  // to click it based on gates + autonomy level.

  function clickButton(btn) {
    if (!btn) return false;
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;
    // Skip buttons whose ancestor `[aria-busy]` is true (loading states).
    let cur = btn;
    while (cur && cur !== document.documentElement) {
      if (cur.getAttribute && cur.getAttribute('aria-busy') === 'true') return false;
      cur = cur.parentElement;
    }
    const rect = btn.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    btn.click();
    return true;
  }

  // Look for validation error messages on the page. ATS forms typically
  // surface these with role="alert" or class names containing "error".
  function detectValidationErrors(doc = document) {
    const seen = new Set();
    const out = [];
    const candidates = [
      ...$$('[role="alert"]', doc),
      ...$$('.error, .field-error, .form-error, .invalid-feedback, [class*="errorText" i], [class*="error-message" i]', doc),
    ];
    for (const el of candidates) {
      const rect = el.getBoundingClientRect?.();
      if (!rect || rect.width === 0 || rect.height === 0) continue;
      const text = (el.textContent || '').trim();
      if (!text || text.length < 2) continue;
      if (seen.has(text)) continue;
      seen.add(text);
      out.push(text.slice(0, 200));
      if (out.length >= 6) break;
    }
    return out;
  }

  // Rich-text editors (Lever, Workday sometimes) — usually contenteditable
  // divs labeled as the cover-letter / answer field. We DO NOT try to type
  // into these; instead we pause and tell the user.
  function detectRichTextEditors(doc = document) {
    const out = [];
    const els = $$('[contenteditable="true"]', doc);
    for (const el of els) {
      if (el.disabled) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 30) continue; // tiny ones are decorations
      out.push({ label: labelFor(el) || '(rich-text editor)' });
    }
    return out;
  }

  // Find a button whose visible text matches one of `labels` (case-insensitive
  // substring). Returns the first visible enabled match.
  function findButtonByLabels(labels, doc = document) {
    const matchers = labels.map(l => l.toLowerCase());
    const candidates = [
      ...$$('button[type=submit]', doc),
      ...$$('button', doc),
      ...$$('input[type=submit]', doc),
      ...$$('a[role=button]', doc),
    ];
    for (const el of candidates) {
      const text = (el.textContent || el.value || el.getAttribute('aria-label') || '').toLowerCase().trim();
      if (!text) continue;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (matchers.some(m => text.includes(m))) return el;
    }
    return null;
  }

  // CAPTCHA / login detection — universal. Any adapter can defer to this.
  function detectCaptcha(doc = document) {
    if (doc.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"]')) return true;
    if (doc.querySelector('.g-recaptcha, .h-captcha, [data-sitekey]')) return true;
    if (doc.querySelector('[id*="captcha" i], [class*="captcha" i]')) {
      // Some pages have a hidden form field literally named "captcha". Make
      // sure it's visible before we declare CAPTCHA present.
      const els = $$('[id*="captcha" i], [class*="captcha" i]', doc);
      for (const el of els) {
        const rect = el.getBoundingClientRect?.();
        if (rect && rect.width > 0 && rect.height > 0) return true;
      }
    }
    return false;
  }

  function detectLoginWall(doc = document) {
    // Visible password input on the current page
    const pwds = $$('input[type="password"]', doc);
    for (const pw of pwds) {
      if (pw.disabled || pw.readOnly) continue;
      const rect = pw.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return true;
    }
    // Known login text
    const txt = doc.body?.innerText?.slice(0, 600).toLowerCase() ?? '';
    if (/sign in to (continue|apply)/i.test(txt) && pwds.length === 0) {
      // Could be SSO wall — flag conservatively
      return true;
    }
    return false;
  }

  function detectPageError(doc = document) {
    const txt = doc.body?.innerText?.slice(0, 400).toLowerCase() ?? '';
    if (/page not found|404|access denied|something went wrong/i.test(txt)) {
      // Only treat as error if NO form is visible
      const hasForm = doc.querySelector('form, [role="form"]');
      if (!hasForm) return true;
    }
    return false;
  }

  // Count required fields the classifier didn't recognize.
  function countUnknownRequiredFields(fields) {
    return fields.filter(f => f.confidence === 'low' && f.required).length;
  }
  function countDemographicRequired(fields) {
    return fields.filter(f => f.confidence === 'never' && f.required).length;
  }

  // Mark required state on detected fields. Helper used by per-ATS detect.
  function annotateRequired(fields, doc = document) {
    const inputs = $$('input, textarea, select', doc);
    const inputByEl = new Map();
    for (const el of inputs) {
      if (el.id) inputByEl.set(`#${el.id}`, el);
    }
    return fields.map(f => {
      const el = (f.selector && inputByEl.get(f.selector)) || null;
      const required = !!(el?.required || el?.getAttribute('aria-required') === 'true');
      return { ...f, required };
    });
  }

  // ── Greenhouse adapter ─────────────────────────────────────────
  const greenhouse = {
    name: 'greenhouse',
    matches: () => /greenhouse\.io/.test(location.hostname),
    detect: () => annotateRequired(detectGeneric(document)),
    fill: (map) => fillGeneric(map, document),
    findNext: () => findButtonByLabels(['save & continue', 'continue', 'next']),
    findSubmit: () => findButtonByLabels(['submit application', 'submit', 'send application']),
  };

  // ── Lever adapter ──────────────────────────────────────────────
  const lever = {
    name: 'lever',
    matches: () => /lever\.co/.test(location.hostname),
    detect: () => annotateRequired(detectGeneric(document)),
    fill: (map) => fillGeneric(map, document),
    findNext: () => findButtonByLabels(['continue', 'next']),
    findSubmit: () => findButtonByLabels(['submit application', 'submit']),
  };

  // ── Ashby adapter ──────────────────────────────────────────────
  const ashby = {
    name: 'ashby',
    matches: () => /ashbyhq\.com/.test(location.hostname),
    detect: () => annotateRequired(detectGeneric(document)),
    fill: (map) => fillGeneric(map, document),
    // Ashby is single-page; "next" usually doesn't exist.
    findNext: () => null,
    findSubmit: () => findButtonByLabels(['submit application', 'submit', 'send application']),
  };

  // ── Workday adapter ────────────────────────────────────────────
  const workday = {
    name: 'workday',
    matches: () => /myworkdayjobs\.com|workday\.com/.test(location.hostname),
    detect: () => annotateRequired(detectGeneric(document)),
    fill: (map) => fillGeneric(map, document),
    // Workday's next is usually "Save and Continue". Submit is "Submit".
    findNext: () => findButtonByLabels(['save and continue', 'continue', 'next']),
    findSubmit: () => findButtonByLabels(['submit', 'review and submit']),
  };

  // ── SmartRecruiters adapter ────────────────────────────────────
  const smartrecruiters = {
    name: 'smartrecruiters',
    matches: () => /smartrecruiters\.com/.test(location.hostname),
    detect: () => annotateRequired(detectGeneric(document)),
    fill: (map) => fillGeneric(map, document),
    findNext: () => findButtonByLabels(['next', 'continue']),
    findSubmit: () => findButtonByLabels(['submit', 'apply']),
  };

  // ── LinkedIn Easy Apply adapter ────────────────────────────────
  const linkedin = {
    name: 'linkedin-easy',
    matches: () => /linkedin\.com\/jobs/.test(location.href),
    detect: () => annotateRequired(detectGeneric(document)),
    fill: (map) => {
      const safeMap = { ...map };
      // LinkedIn screening questions are knockout-style; never autofill
      // numeric years-experience or yes/no answers.
      delete safeMap.yearsExperience;
      return fillGeneric(safeMap, document);
    },
    findNext: () => findButtonByLabels(['next', 'review']),
    findSubmit: () => findButtonByLabels(['submit application', 'submit']),
  };

  const generic = {
    name: 'generic',
    matches: () => true,
    detect: () => annotateRequired(detectGeneric(document)),
    fill: (map) => fillGeneric(map, document),
    findNext: () => findButtonByLabels(['continue', 'next', 'save and continue']),
    findSubmit: () => findButtonByLabels(['submit application', 'submit']),
  };

  const ADAPTERS = [greenhouse, lever, ashby, workday, smartrecruiters, linkedin, generic];

  window.__qadanAtsAdapters = {
    pickAdapter() {
      return ADAPTERS.find(a => a.matches()) || generic;
    },
    ADAPTERS,
    // Shared utilities used by the agent runner
    detectCaptcha,
    detectLoginWall,
    detectPageError,
    countUnknownRequiredFields,
    countDemographicRequired,
    clickButton,
    findResumeInput,
    uploadFileToInput,
    detectValidationErrors,
    detectRichTextEditors,
    detectUnboundDropzone,
    detectCustomSelects,
    truncateToFit,
    PACKET_FIELD_KEYS,
  };
})();
