# Remote access — admin.qadan.co

This document is the one-time setup for serving the admin remotely behind real
auth. Follow it once. After that the only thing you do is `git push` and
Cloudflare Pages rebuilds the admin automatically.

## Architecture

```
qadan.co              →  GitHub Pages          (public portfolio, unchanged)
admin.qadan.co        →  Cloudflare Pages      (this admin app)
                       →  gated by Cloudflare Access
                       →  data stored in browser localStorage at admin.qadan.co
```

- The public site is untouched.
- The admin builds from this repo's `admin/` subfolder.
- Cloudflare Access is the auth layer. It intercepts every request *before* the
  app loads. Unauthorized visitors see Cloudflare's login screen and never reach
  the application.
- Job/recruiter/letter data lives in browser `localStorage` at the
  `admin.qadan.co` origin. It is never sent anywhere. The deployed bundle
  contains only the app shell.

## Prereqs

1. Domain `qadan.co` registered (you have this).
2. A free Cloudflare account.
3. A free Cloudflare Pages project (created in the steps below).
4. Domain nameservers pointing at Cloudflare. (If they aren't yet, you'll need
   to migrate them — Cloudflare walks you through this in 5 minutes when you
   add the domain.)

## Step 1 — Add qadan.co to Cloudflare (skip if already there)

1. Cloudflare dashboard → **+ Add a site** → enter `qadan.co`.
2. Pick the Free plan.
3. Cloudflare scans your existing DNS records. **Verify the GH Pages records
   are present** before continuing:
   - `qadan.co` → `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` (GH Pages A records), or a CNAME to `<user>.github.io`.
   - `www.qadan.co` → CNAME to `<user>.github.io` (if you have one).
4. Cloudflare gives you two nameservers (e.g. `aron.ns.cloudflare.com`,
   `bea.ns.cloudflare.com`). Update them at your registrar (Namecheap / GoDaddy /
   wherever). DNS propagation: minutes to hours.
5. **Important**: leave the qadan.co A/CNAME records in **DNS-only** mode
   (gray cloud), not Proxied (orange cloud). GH Pages doesn't sit nicely behind
   Cloudflare's proxy.

After propagation, qadan.co continues to serve from GH Pages exactly as before.
Cloudflare is now in the DNS path and can manage subdomains.

## Step 2 — Create a Cloudflare Pages project for the admin

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize Cloudflare to access this GitHub repo (`portfoliov2`).
3. Configure the build:
   - **Project name:** `qadan-admin` (becomes `qadan-admin.pages.dev`)
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** `npm install && npm run build`
   - **Build output directory:** `dist`
   - **Root directory (advanced):** `admin`
   - **Environment variables:** none required
4. Save and deploy. First build takes ~1 minute. You'll get a `*.pages.dev`
   URL. Visit it — the admin loads. (At this point it's public — fix that next.)

## Step 3 — Custom domain admin.qadan.co

1. In the Cloudflare Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `admin.qadan.co`.
3. Cloudflare creates the CNAME automatically (because your nameservers are on
   Cloudflare). Confirm. Within ~1 minute, `admin.qadan.co` resolves to the
   Pages project. SSL is auto-provisioned.

The subdomain CNAME for `admin` should be **Proxied** (orange cloud) — that's
required for Cloudflare Access to intercept requests.

## Step 4 — Cloudflare Access (the real auth layer)

1. Cloudflare dashboard → **Zero Trust** → **Access** → **Applications** → **Add an application** → **Self-hosted**.
2. Configure:
   - **Application name:** `Qadan Admin`
   - **Session duration:** 24 hours (or longer if you trust the device)
   - **Application domain:** `admin.qadan.co`
   - Path: leave blank (gates the whole domain)
3. Identity providers — pick one (or both):
   - **One-time PIN** (zero setup; Cloudflare emails a code each login)
   - **Google** (if you want SSO; takes 2 minutes to set up under Settings → Authentication)
4. Create a policy:
   - **Policy name:** `Owner`
   - **Action:** `Allow`
   - **Configure rules:**
     - Include → **Emails** → `muhammedqadan@outlook.com`
     - (Add additional emails for trusted devices if needed)
5. Save.

Visit `admin.qadan.co`. You'll see Cloudflare's branded login screen. Enter
your email, get a one-time code, paste it in. The admin loads. Subsequent
visits within the session window go straight through.

Anyone visiting without a matching email gets denied at the Cloudflare edge.
The application code never reaches them.

## Step 5 — Migrate your existing local data

Your `localStorage` at `127.0.0.1:4322` is scoped to that origin. To bring
your data to `admin.qadan.co`:

1. On the local instance: open `/export` → **Download backup.json**.
2. On `admin.qadan.co`: open `/export` → choose the file → **Restore (replace)**.

After this point, the remote instance is the source of truth. Once Step 6
(KV sync) is enabled, all your devices stay in sync automatically.

## Step 6 — Cross-device sync (Cloudflare KV)

The admin includes a `/api/sync` Pages Function that mirrors your local
data into a single Cloudflare KV key. Every browser tab pulls on load,
debounces a push on every write, and polls every 60s while visible. The
sidebar shows a status indicator (`Synced 12s ago` / `Pulling…` / `Offline`).

This stage is one-time setup. Once the binding is in place, it just works.

### One-time setup in the Cloudflare dashboard

1. **Create a KV namespace.** Workers & Pages → **KV** → **Create a namespace**.
   - Name: `qadan-admin-data` (any name; only the binding matters).
2. **Bind it to the Pages project.** Workers & Pages → your Pages project
   (`qadan-admin`) → **Settings** → **Functions** → **KV namespace bindings** →
   **Add binding**.
   - **Variable name:** `KV` (must match this exactly; the function looks
     for `env.KV`)
   - **KV namespace:** the one you just created
   - Apply to **Production** (and Preview if you want).
3. **Trigger a redeploy.** Either push a commit or hit "Retry deployment"
   in the Pages dashboard. Functions only pick up new bindings on rebuild.

### Verifying it works

| Check | Expected |
|---|---|
| `curl https://admin.qadan.co/api/sync` (signed in) | `{"ok":true,"empty":true,...}` on first run; populated state after first save |
| Sidebar status indicator on `admin.qadan.co` | Green dot, "Synced Xs ago" |
| Save a job on laptop, refresh phone within 60s | Job appears on phone |
| Delete a job on laptop, refresh phone | Job disappears (tombstone propagated) |

If the sidebar shows **"Sync not set up"**, the KV binding is missing — go
back to step 2 above and confirm the variable name is exactly `KV`.

### Local testing

`astro dev` does **not** run Pages Functions. To test sync locally, build
and serve through wrangler:

```bash
npm run build
npx wrangler pages dev dist --kv KV --port 8788
```

Wrangler creates an in-memory KV that the function reads/writes against.
Open http://127.0.0.1:8788 to use the admin against the local KV.

### How conflicts are handled

- **Per-record updatedAt wins.** Each Job/Recruiter has an `updatedAt`
  timestamp. On merge, the side with the higher timestamp wins per record.
- **Tombstones for deletes.** When you delete a record, a tombstone
  `{ type, id, deletedAt }` is recorded locally and synced. Without this,
  a deleted record would resurrect itself the next time the other device
  pushed (because that device still had a copy). Tombstones expire after
  90 days.
- **Last-write-wins on the blob itself.** If two devices push within
  milliseconds, one push silently overwrites the other on KV — but the
  next pull on either device merges everything correctly via per-record
  timestamps.
- **Letters are immutable.** Saved letter drafts are union-merged by id
  (no overwrites); they have `createdAt` only, no `updatedAt`.

## Verifying everything

| Check | Expected |
|---|---|
| Visit `qadan.co` | Public portfolio loads (unchanged) |
| Visit `admin.qadan.co` in incognito | Cloudflare login screen, *not* the app |
| Login with allowed email → see app | App loads at admin.qadan.co |
| Login with unauthorized email | Denied at Cloudflare edge |
| Browser network tab on `admin.qadan.co` | No requests to your local data; everything served from Pages CDN |
| `localStorage.getItem('qa_jobs')` in console | Your data after import |
| `npm run dev` still works locally | Yes, on 127.0.0.1:4322 |

## What's deployed vs what's local-only

**Deployed in the bundle (public to authorized users):**
- App shell, layouts, CSS
- Per-angle resume content (headlines, summaries, skills)
- Per-angle recruiter packs (intro templates, fit bullets)
- Letter generator templates
- Interview prep stories
- The 9 angle definitions and project descriptions

None of the above is private — it's all derived from the same content already
on the public portfolio.

**Local-first, cross-device-synced (via Cloudflare KV when configured):**
- Your saved jobs (`qa_jobs`)
- Recruiters CRM (`qa_recruiters`)
- Saved letter drafts (`qa_letters`)
- Tombstones for propagating deletes (`qa_tombstones`)
- Schema version (`qa_schema_version`)

These live in browser localStorage as the working copy. With the KV binding
configured (Step 6), they also mirror into a single Cloudflare KV value
keyed `admin-data-v1`, gated by Cloudflare Access. Without the binding,
they stay per-device only and the sync indicator shows "Sync not set up".

## Threat model — what this defends against

- **Public discovery.** robots.txt + `X-Robots-Tag: noindex` + Cloudflare Access
  block both crawlers and humans without your email.
- **Credential leak in code.** No credentials in the code. Auth is at the edge,
  not in the bundle.
- **Repo leak.** `dist/`, `node_modules/`, `.env`, `*.pdf`, `exports/` all gitignored.
  Even if the repo were public (it isn't), there's nothing sensitive in it.
- **Tab takeover from a malicious site.** Static Astro app, no auth tokens in
  cookies/localStorage that an attacker could exfiltrate. Worst case: the
  attacker could trigger localStorage reads/writes via XSS — but the app has no
  user-typed HTML, only data fields, so XSS surface is minimal.
- **Account compromise.** If someone obtains your one-time PIN they could log in.
  If you're worried, switch the IdP to Google with 2FA.

## What this does NOT defend against

- **Device compromise.** If your laptop is compromised, your local data is too.
  Standard hygiene applies (FileVault, screen lock).
- **Stolen `pages.dev` domain bypass.** Don't share the raw `qadan-admin.pages.dev`
  URL — that goes through the same Access policy, but if Access weren't
  configured the raw `pages.dev` URL would be public. (It is configured; keep
  it that way.)

## Future: scaling beyond KV

KV stores the entire admin state as one ~10–50KB JSON blob today. That's
fine for one user with a few hundred jobs. If you ever hit ~5MB or want
real query power, the migration path is Cloudflare D1 (serverless SQLite,
same Cloudflare account, same Access gate). Three tables (`jobs`,
`recruiters`, `letters`) mirroring the TypeScript types in
[`lib/storage.ts`](src/lib/storage.ts), and replace the GET/PUT in
`functions/api/sync.ts` with per-table queries. The client `lib/sync.ts`
merge logic stays the same.

Don't pre-build. Ship KV first; migrate when the blob actually gets fat.

## Day-to-day

- **Make changes**: edit files locally, run `npm run admin`, test, commit, push.
- **Cloudflare Pages**: auto-builds on every push to `main`. Build takes ~30s.
  You'll get an email if a build fails.
- **Add a job from your phone**: open `admin.qadan.co` on mobile Safari, log in
  via the same email, paste the URL. The smart intake works on mobile too.
- **Backup**: occasional `/export` → save the JSON somewhere safe (iCloud, Drive).
