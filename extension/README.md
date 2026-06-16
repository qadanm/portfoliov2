# Qadan Apply Assist

A Manifest V3 Chrome extension that acts as an **autonomous job-application agent** for Moe Qadan's Job Search Command Center (the `admin/` cockpit). It is driven from the admin's **Auto-Apply** page: you pick a queue and an autonomy level, and the agent fills fields, advances multi-page forms, uploads the résumé, and — only when you opt in and every safety gate passes — submits.

It is **not** a passive "click to fill" tool. The popup still exists for vault/résumé staging and manual control, but normal operation is hands-off from the admin.

## Autonomy levels

Set per session on the admin Auto-Apply page. Higher levels require explicit confirmation in the UI.

| Level | Behavior |
|---|---|
| **L1** | Fill safe fields only. You advance and submit. |
| **L2** | Fill **and** auto-advance pages. Pauses before submit. *(Recommended; default.)* |
| **L3** | Confirmed Auto-Submit. Submits **one job at a time**, only when all gates pass. |
| **L4** | Batch Auto-Apply. Processes the whole queue and submits every job that passes all gates. |

**Dry run** is a separate checkbox (on by default): fill + advance + reach the submit page, but never click submit. Use it to rehearse a session before enabling real submission.

## Safety gates (auto-submit)

Auto-submit (L3/L4, dry-run off) only fires when **all** of these pass:

- **Fit / authenticity / quality** scores each meet their thresholds (set per session)
- **Daily submit cap** and **per-source cap** not exceeded
- The job URL has not already been applied to (duplicate detection mirrored from the admin)
- The ATS is in an **allowed tier** (Tier 1: Ashby/Greenhouse/Lever — on by default; Tier 2: SmartRecruiters/LinkedIn — opt-in; Tier 3: Workday/Generic — opt-in, not recommended)
- No CAPTCHA, login wall, or demographic/EEOC question is blocking the form

If any gate fails, the agent **pauses the attempt** and surfaces the reason in the admin — it does not guess or push through.

## Supported sites

Greenhouse, Lever, Ashby, Workday, SmartRecruiters, and **LinkedIn Easy Apply**.

- **Direct ATS** (Greenhouse/Lever/Ashby/Workday/SmartRecruiters) are multi-page navigations; the agent fills each page, auto-uploads the staged résumé into file inputs, and advances.
- **LinkedIn Easy Apply** is a same-URL modal: the agent opens the **Easy Apply** dialog and drives its steps in-process (no page navigation between steps).

## Install (developer mode)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → pick this `extension/` directory
4. Pin the extension to the toolbar
5. After any code change, click **Reload** on the extension card and confirm the version bumped

## Set up your vault

The vault (contact info, work authorization, address, salary) reaches the extension two ways:

- **Auto-sync from the admin** — when you start a session on the Auto-Apply page, the admin pushes a snapshot (session + attempts + vault + résumé) to the service worker via the page bridge. This is the normal path; no manual export needed.
- **Manual paste-import** — admin **Vault** page → **Export for extension** → copy JSON → extension popup → **Vault** tab → paste → **Save vault**. Useful when running the agent without an open admin tab.

## Stage the résumé

The agent needs a résumé file to upload on direct-ATS forms. Two ways to stage it:

- **From the admin (hands-off)** — Auto-Apply page → **Master résumé** → pick the PDF once. It is stored in the admin and rides along in every session snapshot, so batch runs need no popup step. *(LinkedIn Easy Apply uses LinkedIn's own stored résumés and does not need this.)*
- **From the popup** — extension icon → **Agent** → **Pick resume PDF** (stored in `chrome.storage.session`, cleared on browser close).

## Daily use

1. Open the admin **Auto-Apply** page; stage the résumé and confirm the vault is complete (health row at the top)
2. Pick jobs from the saved queue, choose an autonomy level, and set the gates
3. Click **Start session →** — the agent opens each job tab and works it
4. Watch progress in the admin; the agent pauses for anything uncertain (CAPTCHA, login, an unknown question it can't answer confidently, a failed gate)
5. For paused attempts, resolve in the tab and click **Retry**, or skip

**Do not fight the agent for the tab** while a session runs (e.g. driving the same tab with another automation tool) — let it finish or pause first.

## What it will NOT do

- Submit when dry-run is on, or when any safety gate fails
- Autofill race, gender, ethnicity, disability, veteran, age, DOB, SSN, pronouns, religion, or marital-status fields — ever
- Answer work-authorization / sponsorship questions unless you've explicitly enabled that toggle in the vault
- Solve CAPTCHAs or bypass login flows
- Create accounts on your behalf

## File structure

| File | Purpose |
|---|---|
| `manifest.json` | MV3 declaration, host permissions, content scripts |
| `background.js` | Service worker — session state, gate mirror, résumé/vault storage, snapshot intake |
| `admin-bridge.js` | Content script on admin pages — relays session/snapshot/control messages between the page and the SW |
| `agent-runner.js` | Page-side autonomous runner — detect, fill, upload, advance, submit, pause |
| `ats-adapters.js` | Per-ATS field detection, filling, navigation, and submit-button resolution |
| `content.js` | Page-side message handler / runner entry |
| `red-flags.js` | Hard-coded "never autofill" patterns (demographics/EEOC/sensitive) |
| `popup.html` / `popup.js` / `popup.css` | Extension UI (vault, résumé staging, manual control) |
| `icons/` | Toolbar icons |

## License

Personal use for Moe Qadan. Not published.
