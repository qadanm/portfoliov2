// Popup script. Talks to the content script via chrome.tabs.sendMessage.
// Holds vault locally in chrome.storage.local (set via paste-import).

(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const tabFill = $('#tab-vault');
  const tabAgent = $('#tab-agent');
  const tabImport = $('#tab-import');
  const paneFill = $('#pane-fill');
  const paneAgent = $('#pane-agent');
  const paneImport = $('#pane-import');

  tabFill.addEventListener('click', () => switchTab('fill'));
  tabAgent.addEventListener('click', () => switchTab('agent'));
  tabImport.addEventListener('click', () => switchTab('import'));

  function switchTab(tab) {
    paneFill.hidden = tab !== 'fill';
    paneAgent.hidden = tab !== 'agent';
    paneImport.hidden = tab !== 'import';
    tabFill.classList.toggle('is-active', tab === 'fill');
    tabAgent.classList.toggle('is-active', tab === 'agent');
    tabImport.classList.toggle('is-active', tab === 'import');
    if (tab === 'import') renderVaultStatus();
    if (tab === 'agent') { renderAgentStatus(); renderResumeStatus(); }
  }

  async function renderAgentStatus() {
    const tab = await activeTab();
    let attempt = null;
    let session = null;
    if (tab?.id) {
      // Popup-originated messages have no sender.tab in the SW, so the
      // active tab id must travel in the payload (C20).
      const resp = await new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({ kind: 'agent.tab.get-attempt', tabId: tab.id }, (r) => {
            if (chrome.runtime.lastError) return resolve({ ok: false });
            resolve(r || { ok: false });
          });
        } catch { resolve({ ok: false }); }
      });
      if (resp?.ok) { attempt = resp.attempt; session = resp.session; }
    }
    const line = document.getElementById('agent-status-line');
    const box = document.getElementById('agent-attempt-box');
    if (!attempt || !session) {
      line.textContent = 'No active session for this tab.';
      box.hidden = true;
      return;
    }
    line.textContent = `Session ${session.id.slice(0, 8)} · L${attempt.autonomyLevel} · ${attempt.atsType} · ${attempt.status}`;
    box.hidden = false;
    document.getElementById('agent-filled').textContent = String(attempt.filledFields?.length || 0);
    document.getElementById('agent-review').textContent = String(attempt.reviewFields?.length || 0);
    document.getElementById('agent-unk').textContent = String(attempt.unknownQuestions?.length || 0);
    document.getElementById('agent-never').textContent = String(attempt.neverFields?.length || 0);
  }
  document.getElementById('agent-run-now')?.addEventListener('click', async () => {
    const tab = await activeTab();
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { kind: 'agent.run-now' }, () => { void chrome.runtime.lastError; });
    toast('Agent re-ran on page');
    setTimeout(renderAgentStatus, 800);
  });

  // Resume file staging
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const result = fr.result;
        if (typeof result !== 'string') return reject(new Error('bad reader'));
        // result is data:application/pdf;base64,.....
        const comma = result.indexOf(',');
        if (comma < 0) return reject(new Error('bad data url'));
        resolve(result.slice(comma + 1));
      };
      fr.onerror = () => reject(fr.error || new Error('reader error'));
      fr.readAsDataURL(file);
    });
  }
  async function renderResumeStatus() {
    const out = await new Promise((resolve) => {
      try {
        chrome.storage.session.get(['stagedResume'], (r) => resolve(r?.stagedResume || null));
      } catch { resolve(null); }
    });
    const el = document.getElementById('resume-status');
    if (!el) return;
    if (!out) {
      el.textContent = 'No resume staged.';
    } else {
      el.textContent = `Staged: ${out.name} (${Math.round(out.size / 1024)} KB)`;
    }
  }
  document.getElementById('resume-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast('Pick a PDF file.');
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      await new Promise((resolve, reject) => {
        try {
          chrome.storage.session.set({
            stagedResume: { name: file.name, type: file.type || 'application/pdf', size: file.size, base64 },
          }, () => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError); else resolve();
          });
        } catch (err) { reject(err); }
      });
      toast(`Staged ${file.name}`);
      renderResumeStatus();
    } catch (err) {
      toast(`Failed: ${err.message || err}`);
    }
  });
  document.getElementById('clear-resume')?.addEventListener('click', async () => {
    try { chrome.storage.session.remove(['stagedResume']); } catch {}
    renderResumeStatus();
    toast('Cleared resume.');
  });

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('is-visible');
    setTimeout(() => el.classList.remove('is-visible'), 1500);
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function sendMsg(msg) {
    const tab = await activeTab();
    if (!tab?.id) return { ok: false, error: 'no-tab' };
    return new Promise(resolve => {
      try {
        chrome.tabs.sendMessage(tab.id, msg, (resp) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: 'no-content-script', message: chrome.runtime.lastError.message });
            return;
          }
          resolve(resp || { ok: false, error: 'no-response' });
        });
      } catch (e) {
        resolve({ ok: false, error: 'send-failed', message: e.message });
      }
    });
  }

  async function ping() {
    const tab = await activeTab();
    const host = tab?.url ? new URL(tab.url).hostname : 'unknown';
    document.getElementById('url-host').textContent = host;
    const resp = await sendMsg({ kind: 'ping' });
    if (resp?.ok) {
      document.getElementById('ats-label').textContent = `ATS: ${resp.ats}`;
    } else {
      document.getElementById('ats-label').textContent = 'Not an ATS page';
    }
  }

  // ── Detect ────────────────────────────────────────────────────
  let lastFields = [];
  document.getElementById('detect-btn').addEventListener('click', async () => {
    const resp = await sendMsg({ kind: 'detect' });
    if (!resp?.ok) {
      toast(resp?.message || 'Could not detect (not on a known ATS?)');
      return;
    }
    lastFields = resp.fields || [];
    renderSummary(resp.ats, lastFields);
    renderFields(lastFields);
    document.getElementById('fill-actions').hidden = false;
  });

  function renderSummary(ats, fields) {
    const counts = { high: 0, medium: 0, low: 0, never: 0 };
    for (const f of fields) counts[f.confidence] = (counts[f.confidence] || 0) + 1;
    const el = document.getElementById('detect-summary');
    el.innerHTML = `
      <div class="is-high"><strong>${counts.high || 0}</strong><span class="lbl">Safe</span></div>
      <div class="is-medium"><strong>${counts.medium || 0}</strong><span class="lbl">Review</span></div>
      <div class="is-low"><strong>${counts.low || 0}</strong><span class="lbl">Manual</span></div>
      <div class="is-never"><strong>${counts.never || 0}</strong><span class="lbl">Never</span></div>
    `;
    el.hidden = false;
  }

  function renderFields(fields) {
    const el = document.getElementById('field-list');
    if (fields.length === 0) {
      el.innerHTML = '<div class="muted" style="padding:8px;">No fields detected.</div>';
      return;
    }
    el.innerHTML = fields.map(f => `
      <div class="field" title="${esc(f.label)}">
        <span class="field__label">${esc(f.label || f.key || '(unlabeled)')}</span>
        <span class="field__conf is-${esc(f.confidence)}">${esc(f.confidence)}</span>
      </div>
    `).join('');
  }

  // ── Fill ──────────────────────────────────────────────────────
  document.getElementById('fill-btn').addEventListener('click', async () => {
    const { vault, settings } = await getStored();
    if (!vault) {
      toast('No vault saved. Switch to the Vault tab.');
      return;
    }
    const map = buildMapFromVault(vault);
    const allowSensitive = document.getElementById('allow-sensitive')?.checked;
    if (allowSensitive) map.__allowSensitive = true;
    const resp = await sendMsg({ kind: 'fill', map });
    if (!resp?.ok) {
      toast(resp?.message || 'Fill failed');
      return;
    }
    toast(`Filled ${resp.filled} field${resp.filled === 1 ? '' : 's'}`);
    // Re-detect to refresh state
    document.getElementById('detect-btn').click();
  });

  function buildMapFromVault(v) {
    const map = {};
    if (!v) return map;
    const split = (s) => {
      const parts = String(s || '').trim().split(/\s+/);
      return { first: parts[0] || '', last: parts.slice(1).join(' ') };
    };
    const name = split(v.displayName || 'Moe Qadan');
    map.firstName = v.legalFirstName || name.first;
    map.lastName = v.legalLastName || name.last;
    map.preferredName = v.preferredName || v.displayName || 'Moe';
    map.fullName = v.displayName || 'Moe Qadan';
    if (v.email) map.email = v.email;
    if (v.phone) map.phone = v.phone;
    if (v.city) map.city = v.city;
    if (v.state) map.state = v.state;
    if (v.country) map.country = v.country;
    if (v.city || v.state) map.location = [v.city, v.state].filter(Boolean).join(', ');
    if (v.linkedin) map.linkedin = v.linkedin;
    if (v.portfolio) map.portfolio = v.portfolio;
    if (v.github) map.github = v.github;
    if (v.personalSite) map.personalSite = v.personalSite;
    if (v.currentEmployer) map.currentEmployer = v.currentEmployer;
    if (v.currentTitle) map.currentTitle = v.currentTitle;
    if (v.yearsExperience != null) map.yearsExperience = String(v.yearsExperience);
    // Work auth — only include if user explicitly allowed
    if (v.workAuthAutofillAllowed && v.workAuthAnswer) map.workAuth = v.workAuthAnswer;
    if (v.workAuthAutofillAllowed && v.sponsorshipAnswer) map.sponsorship = v.sponsorshipAnswer;
    return map;
  }

  // ── Vault import ──────────────────────────────────────────────
  document.getElementById('import-btn').addEventListener('click', async () => {
    const raw = document.getElementById('import-text').value.trim();
    if (!raw) { toast('Paste a vault JSON blob first.'); return; }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      toast('Not valid JSON.');
      return;
    }
    const vault = parsed?.vault;
    if (!vault || typeof vault !== 'object') {
      toast('Missing "vault" object in blob.');
      return;
    }
    await chrome.storage.local.set({ vault, vaultImportedAt: Date.now() });
    toast('Vault saved.');
    renderVaultStatus();
  });

  document.getElementById('clear-vault').addEventListener('click', async () => {
    if (!confirm('Clear stored vault from this extension?')) return;
    await chrome.storage.local.set({ vault: null, vaultImportedAt: null });
    document.getElementById('import-text').value = '';
    renderVaultStatus();
    toast('Vault cleared.');
  });

  async function getStored() {
    return new Promise(resolve => {
      chrome.storage.local.get(['vault', 'settings', 'vaultImportedAt'], resolve);
    });
  }

  async function renderVaultStatus() {
    const { vault, vaultImportedAt } = await getStored();
    const el = document.getElementById('vault-status');
    if (!vault) {
      el.textContent = 'No vault saved yet.';
    } else {
      const when = vaultImportedAt ? new Date(vaultImportedAt).toLocaleString() : 'unknown';
      const name = vault.displayName || 'unknown';
      const age = vaultImportedAt ? Math.floor((Date.now() - vaultImportedAt) / 86400_000) : 0;
      const stale = age > 7 ? ' · ⚠ >7d old, re-export from admin' : '';
      el.textContent = `Saved: ${name} · imported ${when}${stale}`;
    }
  }

  // Boot
  ping();
})();
