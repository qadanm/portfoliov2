# qadan.co

Source for [qadan.co](https://qadan.co) — selected work, case studies, approach, background, and uses.

The site is a static build. No CMS, no client-side framework, no template.

## Stack

- **Astro 4** with MDX and content collections for case studies
- **Hand-written CSS** for the design system: tokens, layout primitives, typographic scale
- **TypeScript** for content schemas and utilities
- **GitHub Actions → GitHub Pages** for deploys, with the custom domain on `qadan.co`

## Local development

Requires Node 20 or later.

```bash
npm install
npm run dev       # local dev server
npm run build     # production build to dist/
npm run preview   # preview the built site
```

## Environment

Copy `.env.example` to `.env` and fill in what you need:

| Variable | Purpose |
| --- | --- |
| `PUBLIC_WEB3FORMS_KEY` | Contact form submission (Web3Forms) |
| `PUBLIC_PLAUSIBLE_DOMAIN` | Analytics hostname. Leave empty in development to skip the script entirely. |

## Content

Case studies live in `src/content` as MDX and are typed by `src/content/config.ts`. Pages are in `src/pages`; shared components and layout primitives are in `src/components` and `src/styles`.

The `admin/` directory is a separate Astro app with its own README and deployment notes.

## Deployment

A push to `main` builds the site and deploys it to GitHub Pages through `.github/workflows/deploy.yml`. The workflow requires `PUBLIC_WEB3FORMS_KEY` as a repository secret.

## Licensing

The case study copy, project imagery, and brand assets are © Moe Qadan. No license is granted for reuse. The source is public for reference.
