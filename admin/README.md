# Qadan Tools

The private tools center at `admin.qadan.co`. This directory remains named `admin/` because the existing Cloudflare Pages project builds from this repo subfolder. The user-facing product is **Qadan Tools**.

## Included

- A mobile-first tools home at `/`.
- Cover Studio at `/tools/cover-studio/index.html`: choose any JPEG, PNG, WebP, or HEIC photo; tap cover text to edit; auto-adjust contrast; add location and plate flags; export a 1080-pixel-wide PNG.

Cover Studio runs entirely in the browser. Its current draft and photo are stored in IndexedDB on each device. No image is uploaded or synced. The same tool is available from any location where `admin.qadan.co` can be reached and the owner can sign in through Cloudflare Access.

## Home Screen apps

The center and Cover Studio each have their own web app manifest, stable app ID, 180/192/512-pixel icons, and standalone display mode. Open the desired page in iPhone or iPad Safari, use **Share → Add to Home Screen**, and leave **Open as Web App** enabled. The icons launch the center or Cover Studio directly. Each future tool can follow the same manifest and icon pattern under its own path.

Home Screen web apps can have separate browser storage from Safari, so a draft created in one installation should not be treated as a synced backup. Export the PNG to keep the finished cover.

## Existing infrastructure

- Cloudflare Pages project: `qadan-admin`, built from this `admin/` directory with output `dist/`.
- Custom domain: `admin.qadan.co`, protected by Cloudflare Access.
- `public/_worker.js` redirects the production and preview `qadan-admin.pages.dev` hostnames to the Access-protected custom domain before serving content. It serves assets on the custom domain through `env.ASSETS`.
- `public/_headers` sets no-index and browser security headers.

The retired job suite's Pages Functions and KV binding have been removed from this app. Any old data in the former KV namespace is no longer read or written by the new site.

## Local development

Requires Node 20 or newer.

```bash
cd admin
npm ci
npm run dev        # http://127.0.0.1:4322
npm run build      # static output in dist/
```

From the repo root, `npm run tools` starts the local app. Cloudflare Pages builds this subdirectory on pushes to `main`.

## Access checks after deployment

- `https://admin.qadan.co/` should require Cloudflare Access without a valid session.
- `https://qadan-admin.pages.dev/` should redirect to `https://admin.qadan.co/`.
- Cover Studio should load at `/tools/cover-studio/index.html` and export a PNG from a selected photo.

The source files for the bundled font, flags, and HEIC decoder have their license texts in `public/tools/cover-studio/licenses/`.
