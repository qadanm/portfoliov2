# Qadan Admin

Career operating system. Runs locally by default; can be served privately at
`admin.qadan.co` behind Cloudflare Access — see [REMOTE-SETUP.md](./REMOTE-SETUP.md).

## What this is

A private Astro app that lives next to the public portfolio in this repo. It generates
angle-aware resumes, recruiter messaging, and tracks job applications. All data is
authored in source files (`src/data/`) or stored in your browser's `localStorage`.

## What this is not

- Hosted anywhere
- Authenticated
- Connected to a database
- Reachable from the public site at qadan.co

The public Astro project lives at the repo root. This admin project is a sibling, not
a subroute. The public Astro build doesn't see `/admin` and can't accidentally publish it.

## Security model — read this once

| What | Status |
|---|---|
| The dev server binds to `127.0.0.1` | Not reachable from other devices on your LAN |
| `dist/` and `node_modules/` are gitignored | Build output never enters the repo |
| `exports/` and `*.pdf` are gitignored | Generated resumes don't get committed |
| No third-party API keys, no secrets | Nothing to leak |
| No login, no auth | Because there's no remote surface to log into |

If you ever want to host this privately, two clean migrations:

1. **Cloudflare Pages + Cloudflare Access** (free for personal): deploy this Astro
   project as a separate Pages project, gate the entire domain with Access (Google
   sign-in, restricted to your email). You never see a login page; Cloudflare handles it.
2. **Vercel + Password Protection** (paid): deploy and turn on the project-level password.

Both keep the admin off the public surface entirely.

## Run

```bash
# from the admin/ directory
npm install
npm run dev
# → http://127.0.0.1:4322
```

Or from the repo root:

```bash
npm run admin
```

(That script is added to the root `package.json`.)

## What's inside

```
src/
├── data/
│   ├── identity.ts        ← contact info, links, location
│   ├── angles.ts          ← the 9 role angles + emphasis rules
│   ├── projects.ts        ← work entries with per-angle bullet variants
│   ├── skills.ts          ← skills with categories + per-angle weights
│   ├── content.ts         ← per-angle headlines + summaries
│   └── recruiter.ts       ← per-angle recruiter messaging
├── lib/
│   └── engine.ts          ← composer: takes an angle, returns a resume
├── layouts/
│   ├── Admin.astro        ← sidebar shell
│   └── Print.astro        ← no chrome, A4
├── pages/
│   ├── index.astro        ← dashboard
│   ├── resume/[angle].astro    ← resume builder, all 9 angles
│   ├── recruiter/[angle].astro ← recruiter toolkit per angle
│   ├── jobs.astro         ← job tracker (localStorage)
│   └── interview.astro    ← interview prep notes
└── styles/
    └── global.css         ← shared tokens, print stylesheet
```

## Three resume output modes

Every angle generates the same content in three formats:

1. **Beautiful** — visually aligned with qadan.co, serif headers, single column. Print to PDF for the visual version recruiters react to.
2. **ATS** — same content, plain HTML structure. Single column. System fonts. Optimized for parsers that strip CSS.
3. **Plain text** — copy-paste friendly. For job application forms with raw text fields.

To export PDF: open the resume page, hit Cmd-P, "Save as PDF". The print stylesheet hides chrome and renders at A4.

## Editing content

All angle content lives in `src/data/`. Edit there. Changes hot-reload.

Don't author per-resume; author per-angle. The engine recombines.

## Job tracker

`/jobs` uses `localStorage` only. Clearing your browser data clears the tracker. No
network calls. If you want it persistent across machines, that's the migration to
Supabase / a private backend — not added by default because it adds operational weight.
