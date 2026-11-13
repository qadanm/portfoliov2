# Qadan Tools roadmap

This is a planning document, not a list of shipped features. Add a tool to the home screen only after it is usable on a phone and its export path works.

## Shipped

- **Cover Studio:** deterministic Instagram car carousel covers from any photo; direct editing; photo-aware title color; U.S. state, Canadian province/territory, Mexican state, and country flags; optional plate origin; and a paired CarSpotter final slide.
- **Private tools center:** a direct entry point behind Cloudflare Access, with a separate installable Home Screen app for the center and Cover Studio.

## Candidate next tools

1. **Carousel assembler.** Select and reorder several local photos, choose a feed ratio, and export a numbered set with the Cover Studio cover and endcard in the intended order. Reuse the existing local-first export pattern. Do not make this a second cover editor.
2. **Location and plate presets.** Save frequently used city, region, country, and plate-origin combinations on the current device. Make the underlying fields editable on every cover; presets should save taps, not hide the source data.
3. **Brand and endcard library.** Preview approved Qadan Travels and CarSpotter assets, choose a final-slide treatment, and export consistent variants. Keep source credits, licenses, and the official CarSpotter logo traceable.
4. **Post copy helper.** Assemble repeatable caption sections from editable fields, with a copy action and no automatic publishing. Evaluate this only if it saves enough work compared with a text template.

The order is provisional. Choose the next tool from real repeated work, not from a desire to fill the dashboard. Avoid AI calls for tasks a template or deterministic rule can solve.

## Launch checklist for any new tool

- Define the input, editable fields, output, and one-minute phone workflow before building the UI.
- Give it a direct URL under `/tools/`, a useful empty state, visible save/export status, and controls sized for touch.
- Decide whether drafts remain device-local or need deliberate sync. Document retention and privacy before adding remote storage.
- If it is a standalone Home Screen app, add its own stable manifest ID, 180/192/512-pixel icons, `display: standalone`, build marker, update checker, and entry in `scripts/stamp-build.mjs`.
- Preserve the tools center and Cloudflare Access boundary; route Pages hostnames through the protected custom domain.
- Test a real input, a narrow viewport, the exported artifact, the installed-app reload path, and the live Access-protected URL after deployment.
- List it on the center only when the tool and its export are ready.

## Operating work

- Keep the admin build in CI. Review major dependency updates as migrations rather than bulk-merging Dependabot PRs.
- Check Cloudflare Pages dashboard settings and the deployed commit when release verification is needed; those settings are not versioned here.
- Revisit cross-device draft sync only if the owner's workflow needs it. The current IndexedDB drafts are intentionally per device, while exported PNGs are portable.
