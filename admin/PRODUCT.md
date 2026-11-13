# Qadan Tools

## Purpose
A private, mobile-first home for the owner's repeatable utilities, accessible through the existing Cloudflare Pages and Access setup from any device.

## Current tool
Cover Studio creates Instagram carousel covers from arbitrary car photos without per-cover AI calls. The owner chooses a local image, taps the cover text to edit it, adds spotted and optional plate-origin flags, and exports a 1080-pixel-wide cover. A randomly chosen one of 11 branded CarSpotter final slides can be changed before exporting the two numbered PNGs together. On iOS the primary export uses the share sheet so both images can be saved to Photos.

## Constraints
- Keep the public portfolio separate.
- Keep the protected custom domain and existing Pages build root.
- Never bundle a user's test photo or job-search data.
- Keep browser-local photos on the device; no new backend or upload path for this release.
- Do not show placeholder tools as working features.
- Keep the photo visible. Prefer photo-aware type, outlines, and shadows over broad dark bands. Preserve a centered large title and a small title line right-aligned beneath its bottom line.
- Future tool ideas live in [ROADMAP.md](ROADMAP.md); they are proposals until implemented and tested.
