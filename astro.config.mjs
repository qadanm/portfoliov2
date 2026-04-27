import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://qadan.co',
  integrations: [
    tailwind({ applyBaseStyles: false }),
    mdx(),
    sitemap({
      // /work/* are 301 redirects to /build/* — keep the canonical URLs in
      // the sitemap and let crawlers discover the redirect via the live site.
      filter: (page) => !page.includes('/work'),
      changefreq: 'monthly',
      priority: 0.8,
      lastmod: new Date(),
    }),
  ],
  redirects: {
    '/work': '/build',
    '/work/[slug]': '/build/[slug]',
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
