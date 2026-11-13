# Qadan Tools

The private tools center at `admin.qadan.co`. This directory remains named `admin/` because the existing Cloudflare Pages project builds from this repo subfolder. The user-facing product is **Qadan Tools**. Its premise is to turn the owner's recurring creative work into fast, repeatable tools that work from a phone, tablet, or laptop anywhere the owner can sign in.

Cover Studio is intentionally deterministic: a reusable layout and local image analysis replace a fresh AI request for every carousel. The center should grow one genuinely useful tool at a time. [PRODUCT.md](PRODUCT.md) states the product boundaries, [DESIGN.md](DESIGN.md) records the visual system, and [ROADMAP.md](ROADMAP.md) separates future ideas from shipped features.

## Included

- A mobile-first tools home at `/`.
- Cover Studio at `/tools/cover-studio/index.html`: choose any JPEG, PNG, WebP, or HEIC photo; tap cover text to edit; auto-adjust contrast; add location and plate flags; export the cover with one of 11 branded CarSpotter endcards. Both slides are 1080 pixels wide and share the selected ratio. The endcard is randomly selected per draft and can be changed before export.

Cover Studio runs entirely in the browser. Its current draft and photo are stored in IndexedDB on each device. No image is uploaded or synced. The same tool is available from any location where `admin.qadan.co` can be reached and the owner can sign in through Cloudflare Access.

## Code map

| Part | Source | Purpose |
| --- | --- | --- |
| Tools center | `src/pages/index.astro`, `src/layouts/ToolShell.astro`, `src/styles/global.css` | Astro page, shared shell, and responsive styling. |
| Cover editor | `public/tools/cover-studio/index.html`, `app.js`, `styles.css` | Photo input, direct text editing, flags, draft state, and export controls. |
| Cover artwork | `public/tools/cover-studio/render.js` | Photo-aware Canvas rendering for both preview and exported PNG. |
| Final slide | `public/tools/cover-studio/endcards.js`, `endcards/` | Randomly selected or manually changed CarSpotter card. |
| Build updates | `scripts/stamp-build.mjs`, `public/update-check.js`, `public/update-home.js` | Build version, update checks, and a fresh reload after a deploy. |
| Edge response | `public/_worker.js`, `public/_headers` | Pages asset serving, pages.dev redirect, cache policy, and security headers. |

Everything under `public/` is copied into the static build. The Cover Studio editor is plain browser JavaScript, not an Astro route; its direct URL is `/tools/cover-studio/index.html`.

## Home Screen apps

The center and Cover Studio each have their own web app manifest, stable app ID, 180/192/512-pixel icons, and standalone display mode. Open the desired page in iPhone or iPad Safari, use **Share → Add to Home Screen**, and leave **Open as Web App** enabled. The icons launch the center or Cover Studio directly. Each future tool can follow the same manifest and icon pattern under its own path.

Home Screen web apps can have separate browser storage from Safari, so a draft created in one installation should not be treated as a synced backup. Export the finished slides to keep them. On iPhone and iPad, the primary export opens the iOS share sheet with both PNGs; choose **Save 2 Images** to put them in Photos. Other browsers download a ZIP containing numbered PNGs. Cover-only download remains available.

## Build and deployment

- This repository has **two independent deployment paths**. The root GitHub Actions workflow builds the public portfolio and deploys `qadan.co` to GitHub Pages. It does not deploy Qadan Tools.
- Qadan Tools belongs to the existing Cloudflare Pages project `qadan-admin`. The required Pages settings are repository `qadanm/portfoliov2`, production branch `main`, root directory `admin`, build command `npm run build`, and output directory `dist`. The Git connection and its actual dashboard settings live in Cloudflare, outside this repository. `wrangler.toml` records the Pages project name and output path; it does not by itself create a deployment.
- Custom domain: `admin.qadan.co`, protected by Cloudflare Access.
- `public/_worker.js` redirects the production and preview `qadan-admin.pages.dev` hostnames to the Access-protected custom domain before serving content. It serves assets on the custom domain through `env.ASSETS`.
- The Worker sends `Cache-Control: private, no-store` for HTML, CSS, JavaScript, JSON, and manifests. `_headers` carries static security and no-index defaults; the Worker controls caching so large photos, fonts, and flags can use normal asset caching. Cover Studio also versions its stylesheet and module URLs so a phone does not pair new HTML with old code during a release.
- `npm run build` runs Astro and then `stamp-build.mjs`. Each build writes its commit SHA to `version.json` and stamps it into both Home Screen app pages and manifests. `update-check.js` checks on load, foreground return, network return, and every five minutes while open. A newer build reloads at a fresh URL. Cover Studio saves its IndexedDB draft first and waits until active editing ends. A normal Home Screen installation does not need to be recreated for later page and tool updates.
- `.github/workflows/ci.yml` builds both the portfolio and tools on pull requests and on `main`. A green GitHub Pages deployment check proves only the portfolio deployed. Confirm a tools release in Cloudflare Pages and at the Access-protected custom domain.

The retired job suite's Pages Functions and KV binding have been removed from this app. Any old data in the former KV namespace is no longer read or written by the new site.

## Local development

Requires Node 20 or newer.

```bash
cd admin
npm ci
npm run dev        # http://127.0.0.1:4322
npm run build      # static output in dist/
```

From the repo root, `npm run tools` starts the local app. A local Astro preview does not reproduce the Cloudflare Access gate or Pages Worker response headers.

## Access checks after deployment

- `https://admin.qadan.co/` should require Cloudflare Access without a valid session.
- `https://qadan-admin.pages.dev/` should redirect to `https://admin.qadan.co/`.
- Cover Studio should load at `/tools/cover-studio/index.html` and export two same-size PNGs from a selected photo, with a different CarSpotter endcard available from **Pick another**.
- The Cloudflare Pages deployment should identify the intended `main` commit; `/version.json` should contain that commit SHA after Access sign-in.

## Adding a tool

Ship a working tool before listing it on the center. Give it its own path, useful default content, touch-friendly editing, a narrow-screen layout, and an export flow that works on iOS. If it should install separately on the Home Screen, give it a stable manifest ID, scoped start URL, icons, the stamped build marker, and `update-check.js`; add its output files to `stamp-build.mjs`. Keep user media local unless a future tool explicitly requires remote storage and its privacy model is documented. See [ROADMAP.md](ROADMAP.md) for candidate tools and the launch checklist.

The source files for the bundled font, flags, and HEIC decoder have their license texts in `public/tools/cover-studio/licenses/`.
