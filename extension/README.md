# Qadan Apply Assist

A Manifest V3 Chrome extension that fills standard fields on ATS forms after explicit user action. Built for Moe Qadan's Job Search Command Center.

## What it does

- Detects fields on Greenhouse, Lever, Ashby, Workday, SmartRecruiters, and LinkedIn Easy Apply pages
- Shows a preview of which fields it will autofill (with confidence levels)
- Fills only after you click **Fill safe fields**
- Marks every filled input with a yellow outline so you can see what changed
- **Never** auto-submits
- **Never** autofills race, gender, ethnicity, disability, veteran, age, DOB, SSN, pronouns, religion, marital status fields
- Autofills work authorization / sponsorship answers only if you've explicitly enabled the toggle in your vault

## Install (developer mode)

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Pick this `extension/` directory
5. Pin the extension to the toolbar

## Set up your vault

1. Open the admin app (e.g. `http://localhost:4322/vault`)
2. Fill the Profile Vault sections
3. Click **Export for extension** → copy the JSON blob
4. Click the extension icon → **Vault** tab → paste the JSON → **Save vault**

The vault never auto-syncs. You re-export when you change something.

## Daily use

1. From the admin, click **Start Apply Session** to begin processing today's queue
2. Open the listing — the extension's content script is already running on supported ATS pages
3. Click the extension icon → **Detect fields**
4. Review the preview (Safe / Review / Manual / Never)
5. Click **Fill safe fields** — high-confidence fields populate, the rest stay blank
6. Manually fill the rest in the form
7. Click **Submit** in the ATS yourself
8. Back in the admin, click **Mark applied**

## What it will NOT do

- Submit applications (M3 Confirmed-Submit Assist is stubbed but disabled in this prototype)
- Read admin pages automatically (vault is paste-imported)
- Fill demographic / EEOC / legal questions
- Solve CAPTCHAs or bypass login flows
- Create accounts on your behalf

## File structure

| File | Purpose |
|---|---|
| `manifest.json` | M3 declaration, host permissions, content scripts |
| `background.js` | Service worker (no-op for now) |
| `content.js` | Page-side message handler |
| `ats-adapters.js` | Per-ATS field detection + filling |
| `red-flags.js` | Hard-coded "never autofill" patterns |
| `popup.html` / `popup.js` / `popup.css` | Extension UI |
| `icons/` | Toolbar icons |

## License

Personal use for Moe Qadan. Not published.
