# Repository guide for agents

This repository contains two separately deployed sites. Read the relevant guide before changing either one.

| Site | Source | Production | Build and deploy |
| --- | --- | --- | --- |
| Public portfolio | Repository root, `src/` and `public/` | `https://qadan.co/` | Root `npm run build`; GitHub Actions deploys `dist/` to GitHub Pages on `main`. |
| Private Qadan Tools | `admin/` | `https://admin.qadan.co/` | `admin/npm run build`; the existing Cloudflare Pages project builds `admin/` to `admin/dist/`. See [admin/AGENTS.md](admin/AGENTS.md). |

The GitHub Pages workflow does **not** deploy Qadan Tools. Cloudflare Pages deployment settings and Cloudflare Access policies live outside this repository; verify them in Cloudflare when deployment behavior matters. `admin/wrangler.toml` records the Pages project name and output directory.

Run the build for each site you change. Pull requests run both builds in `.github/workflows/ci.yml`. Do not commit generated `dist/`, local environment files, user photos, or unrelated untracked files. Treat major dependency updates as migrations: validate both builds and the affected runtime behavior before merging them.
