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
      // /build/* and /design are 301 redirects to the new canonical URLs;
      // keep the canonical paths in the sitemap and let crawlers discover
      // redirects via the live site.
      filter: (page) => !page.includes('/build') && !page.includes('/design'),
      changefreq: 'monthly',
      priority: 0.8,
      lastmod: new Date(),
    }),
  ],
  redirects: {
    '/build': '/work',
    '/build/[slug]': '/work/[slug]',
    '/design': '/approach',
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
