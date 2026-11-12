import { defineConfig } from 'astro/config';

// Cloudflare Pages builds this directory as a static site at admin.qadan.co.
// Cloudflare Access protects the custom domain; _worker.js redirects pages.dev.
export default defineConfig({
  output: 'static',
  site: 'https://admin.qadan.co',
  server: { host: '127.0.0.1', port: 4322 },
});
