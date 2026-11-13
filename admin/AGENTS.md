# Qadan Tools agent handoff

Read [README.md](README.md) for architecture and deployment, [PRODUCT.md](PRODUCT.md) for the premise, [DESIGN.md](DESIGN.md) for visual rules, and [ROADMAP.md](ROADMAP.md) for proposed next tools.

## Product boundaries

- Qadan Tools is the owner's private, mobile-first workspace, separate from the public portfolio. Cover Studio is the first working tool.
- Cover creation is deterministic and runs in the browser. Do not add a per-cover AI call, photo upload, server-side rendering, or cross-device sync without a specific product decision.
- The Cover Studio draft and original photo stay in IndexedDB on the current device. Exports are portable PNGs; local drafts are not a backup.
- Do not restore the retired job-finding suite or display unfinished tools as available.

## Implementation map

- `src/pages/index.astro`, `src/layouts/ToolShell.astro`, `src/styles/global.css`: tools home.
- `public/tools/cover-studio/index.html`, `app.js`, `styles.css`: editor UI and state.
- `public/tools/cover-studio/render.js`: one Canvas renderer for preview and cover export. Keep both paths identical.
- `public/tools/cover-studio/endcards.js` and `endcards/`: the 11 branded final slides.
- `public/tools/cover-studio/assets/regions.json` and `assets/flags/`: location and plate flags. Preserve flag proportions and use a consistent height; avoid white mats.
- `public/update-check.js`, `scripts/stamp-build.mjs`, the two manifests, and `public/_worker.js`: installed-app updates, build versions, and response headers.

## Cover design decisions

The large title is centered. The optional small title sits immediately below and aligns to the **right edge of the bottom title line**, without extending beyond it. Readability comes from photo-aware lettering, outlines, and shadows; do not add broad dark bands over the photo. The location footer and flags must remain legible at Instagram grid and phone sizes. The image is arbitrary; never tune the renderer only to the example Regius photo.

## Change and release checks

1. Run `npm ci` when dependencies change, then `npm run build` from `admin/`.
2. For a visual or export change, load a real photo and check both 3:4 and 4:5 as relevant, including a narrow phone viewport. Check the exported image when the export path changes.
3. When changing a static CSS or JS asset, bump its query version in the HTML or importing module. `stamp-build.mjs` stamps the page and manifest build versions; preserve its markers.
4. Verify Cloudflare Pages has built the new commit and test through `admin.qadan.co` behind Access. A green GitHub Pages deployment check only covers the public portfolio.
5. Stage only intended files. Do not commit local test photos, generated output, credentials, or unrelated work.

For a new tool, follow the launch checklist in [ROADMAP.md](ROADMAP.md). Each tool should have a direct URL, mobile-first controls, a standalone Home Screen manifest and icon, a safe update path, and an export suited to its task.
